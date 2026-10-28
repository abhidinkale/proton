package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ClinicDayHours
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.model.PreConsultationData
import health.dork.app.core.data.seed.DorkSeedData
import health.dork.app.core.data.util.DoctorAvailability
import health.dork.app.core.data.util.SlotOption
import health.dork.app.core.designsystem.components.AppointmentStatus
import health.dork.app.core.sync.NoOpSyncEnqueuer
import health.dork.app.core.sync.SyncEnqueuer
import health.dork.app.core.sync.enqueueBooking
import health.dork.app.core.sync.enqueueCancel
import health.dork.app.core.sync.enqueueReschedule
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import java.time.LocalDate
import java.time.LocalDateTime

/** Reasons a booking or reschedule can be legitimately refused. */
sealed class BookingFailure(message: String) : Exception(message) {
  class UnknownDoctor : BookingFailure("That clinician is not in your care team.")
  class SlotInPast : BookingFailure("That time has already passed. Pick a later slot.")
  class SlotTaken : BookingFailure("That slot was just taken. Pick another time.")
  class Closed(val day: LocalDate) : BookingFailure("The clinic is closed on that day.")
  class MissingReason : BookingFailure("Add a reason for the visit.")
  class NotFound : BookingFailure("That appointment is no longer saved on this device.")
  class NotReschedulable : BookingFailure("This appointment can no longer be moved.")
}

interface CareRepository {
  val doctors: StateFlow<List<Doctor>>
  val appointments: StateFlow<List<AppointmentItem>>
  val specialties: List<String>

  suspend fun getDoctorById(id: String): Doctor?

  /** Days in the booking horizon that still have at least one open slot. */
  fun openDays(doctorId: String, horizonDays: Int = DoctorAvailability.HORIZON_DAYS): List<LocalDate>

  /** Bookable slots for one clinician on one day. */
  fun slotsFor(doctorId: String, date: LocalDate): List<SlotOption>

  /** Human label for the next open slot, e.g. "Tomorrow · 10:00 AM". */
  fun nextSlotLabel(doctorId: String): String

  suspend fun bookAppointment(
    doctorId: String,
    startIso: String,
    consultationType: ConsultationType,
    reason: String,
    symptoms: List<String> = emptyList()
  ): Result<AppointmentItem>

  suspend fun rescheduleAppointment(
    appointmentId: String,
    startIso: String
  ): Result<AppointmentItem>

  suspend fun cancelAppointment(appointmentId: String): Result<Unit>

  suspend fun submitPreConsultation(data: PreConsultationData): Result<Unit>

  /**
   * Upserts appointments owned by the clinic. Local-only appointments and any
   * appointment in [protectedIds] (a local edit still sitting in the outbox)
   * are never overwritten. Never deletes.
   */
  fun mergeRemoteAppointments(remote: List<AppointmentItem>, protectedIds: Set<String>): Int

  /**
   * Applies server clinic hours for known clinicians, keyed by doctor id. An
   * empty list is ignored rather than interpreted as "closed forever".
   */
  fun mergeRemoteAvailability(remote: Map<String, List<ClinicDayHours>>): Int
}

class DorkCareRepository(
  private val store: DorkStore = DorkStore(),
  private val now: () -> LocalDateTime = { LocalDateTime.now() },
  private val sync: SyncEnqueuer = NoOpSyncEnqueuer,
  /**
   * The patient's own profile, read at booking time so the clinician sees a
   * name and a safety history. Null in tests and before onboarding finishes.
   */
  private val patientProvider: () -> PatientProfile? = { null }
) : CareRepository {

  private val appointmentSerializer = ListSerializer(AppointmentItem.serializer())
  private val hoursSerializer = MapSerializer(
    String.serializer(),
    ListSerializer(ClinicDayHours.serializer())
  )

  private var remoteHours: Map<String, List<ClinicDayHours>> =
    store.read(KEY_DOCTOR_HOURS, hoursSerializer).orEmpty()

  private val _doctors = MutableStateFlow(
    DorkSeedData.doctors.map { doctor ->
      remoteHours[doctor.id]?.takeIf { it.isNotEmpty() }
        ?.let { doctor.copy(weeklyHours = it) }
        ?: doctor
    }
  )
  override val doctors: StateFlow<List<Doctor>> = _doctors.asStateFlow()

  private val _appointments = MutableStateFlow(
    store.read(KEY_APPOINTMENTS, appointmentSerializer) ?: DorkSeedData.appointments
  )
  override val appointments: StateFlow<List<AppointmentItem>> = _appointments.asStateFlow()

  override val specialties: List<String> = listOf(
    "All Specialties",
    "General Medicine",
    "Cardiology",
    "Dermatology",
    "Orthopedics",
    "Neurology",
    "Pediatrics",
    "Gynecology",
    "Mental Health"
  )

  override suspend fun getDoctorById(id: String): Doctor? =
    _doctors.value.find { it.id == id }

  override fun openDays(doctorId: String, horizonDays: Int): List<LocalDate> {
    val doctor = _doctors.value.find { it.id == doctorId } ?: return emptyList()
    return DoctorAvailability.openDays(doctor, _appointments.value, now(), horizonDays)
  }

  override fun slotsFor(doctorId: String, date: LocalDate): List<SlotOption> {
    val doctor = _doctors.value.find { it.id == doctorId } ?: return emptyList()
    return DoctorAvailability.slotsFor(doctor, date, _appointments.value, now())
  }

  override fun nextSlotLabel(doctorId: String): String {
    val doctor = _doctors.value.find { it.id == doctorId } ?: return "No open slots"
    return DoctorAvailability.nextSlotLabel(doctor, _appointments.value, now())
  }

  override suspend fun bookAppointment(
    doctorId: String,
    startIso: String,
    consultationType: ConsultationType,
    reason: String,
    symptoms: List<String>
  ): Result<AppointmentItem> {
    val doctor = _doctors.value.find { it.id == doctorId }
      ?: return Result.failure(BookingFailure.UnknownDoctor())

    if (reason.isBlank()) return Result.failure(BookingFailure.MissingReason())

    val start = runCatching { LocalDateTime.parse(startIso) }.getOrNull()
      ?: return Result.failure(BookingFailure.SlotInPast())

    if (start.isBefore(now())) return Result.failure(BookingFailure.SlotInPast())
    if (!DoctorAvailability.isOpen(doctor, start.toLocalDate())) {
      return Result.failure(BookingFailure.Closed(start.toLocalDate()))
    }
    if (isSlotTaken(start)) return Result.failure(BookingFailure.SlotTaken())

    val appointment = AppointmentItem(
      id = "apt-${java.util.UUID.randomUUID().toString().take(8)}",
      doctorId = doctor.id,
      doctorName = doctor.name,
      specialty = doctor.specialty,
      dateTimeString = start.toString(),
      dateIso = start.toString(),
      clinicLocation = if (consultationType == ConsultationType.VIDEO) {
        "Telehealth video room"
      } else {
        doctor.clinicName
      },
      consultationType = consultationType,
      status = AppointmentStatus.Booked,
      reasonForVisit = reason.trim(),
      symptoms = symptoms
    )

    _appointments.value = (_appointments.value + appointment).sortedBy { it.dateIso }
    persistAppointments()
    sync.enqueueBooking(appointment, now().toString(), patientProvider())
    return Result.success(appointment)
  }

  override suspend fun rescheduleAppointment(
    appointmentId: String,
    startIso: String
  ): Result<AppointmentItem> {
    val existing = _appointments.value.find { it.id == appointmentId }
      ?: return Result.failure(BookingFailure.NotFound())

    if (existing.status == AppointmentStatus.Cancelled ||
      existing.status == AppointmentStatus.Fulfilled
    ) {
      return Result.failure(BookingFailure.NotReschedulable())
    }

    val start = runCatching { LocalDateTime.parse(startIso) }.getOrNull()
      ?: return Result.failure(BookingFailure.SlotInPast())
    if (start.isBefore(now())) return Result.failure(BookingFailure.SlotInPast())
    if (isSlotTaken(start, ignoreId = appointmentId)) return Result.failure(BookingFailure.SlotTaken())

    val updated = existing.copy(
      dateIso = start.toString(),
      dateTimeString = start.toString(),
      status = AppointmentStatus.Booked
    )
    _appointments.value = _appointments.value
      .map { if (it.id == appointmentId) updated else it }
      .sortedBy { it.dateIso }
    persistAppointments()
    sync.enqueueReschedule(appointmentId, start.toString(), now().toString())
    return Result.success(updated)
  }

  override suspend fun cancelAppointment(appointmentId: String): Result<Unit> {
    if (_appointments.value.none { it.id == appointmentId }) {
      return Result.failure(BookingFailure.NotFound())
    }
    _appointments.value = _appointments.value.map {
      if (it.id == appointmentId) it.copy(status = AppointmentStatus.Cancelled) else it
    }
    persistAppointments()
    sync.enqueueCancel(appointmentId, now().toString())
    return Result.success(Unit)
  }

  override suspend fun submitPreConsultation(data: PreConsultationData): Result<Unit> {
    _appointments.value = _appointments.value.map { apt ->
      if (apt.id == data.appointmentId) {
        val summary = buildString {
          append("Chief complaint: ${data.chiefComplaint}.")
          append(" Onset: ${data.onsetDuration}.")
          append(" Severity: ${data.severityScale}/10.")
          if (data.selectedSymptoms.isNotEmpty()) {
            append(" Symptoms: ${data.selectedSymptoms.joinToString()}.")
          }
        }
        apt.copy(preConsultationSummary = summary, symptoms = data.selectedSymptoms)
      } else {
        apt
      }
    }
    persistAppointments()
    return Result.success(Unit)
  }

  override fun mergeRemoteAppointments(
    remote: List<AppointmentItem>,
    protectedIds: Set<String>
  ): Int {
    if (remote.isEmpty()) return 0

    val merged = _appointments.value.associateBy { it.id }.toMutableMap()
    var applied = 0
    remote.forEach { serverAppointment ->
      if (serverAppointment.id in protectedIds) return@forEach
      merged[serverAppointment.id] = serverAppointment
      applied++
    }
    if (applied > 0) {
      _appointments.value = merged.values.sortedBy { it.dateIso }
      persistAppointments()
    }
    return applied
  }

  override fun mergeRemoteAvailability(remote: Map<String, List<ClinicDayHours>>): Int {
    val usable = remote.filterValues { it.isNotEmpty() }
    if (usable.isEmpty()) return 0

    // Merge, never replace: a server response that omits a clinician must not
    // erase the hours this device already knows.
    val next = remoteHours + usable
    remoteHours = next
    store.write(KEY_DOCTOR_HOURS, hoursSerializer, next)
    _doctors.value = _doctors.value.map { doctor ->
      next[doctor.id]?.let { doctor.copy(weeklyHours = it) } ?: doctor
    }
    return usable.keys.count { id -> _doctors.value.any { it.id == id } }
  }

  private fun isSlotTaken(start: LocalDateTime, ignoreId: String? = null): Boolean =
    _appointments.value.any { appointment ->
      appointment.id != ignoreId &&
        appointment.status != AppointmentStatus.Cancelled &&
        runCatching { LocalDateTime.parse(appointment.dateIso) }.getOrNull() == start
    }

  private fun persistAppointments() {
    store.write(KEY_APPOINTMENTS, appointmentSerializer, _appointments.value)
  }

  private companion object {
    const val KEY_APPOINTMENTS = "care:appointments"
    const val KEY_DOCTOR_HOURS = "sync:doctor_hours"
  }
}
