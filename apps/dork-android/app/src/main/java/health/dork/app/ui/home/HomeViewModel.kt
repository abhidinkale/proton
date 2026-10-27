package health.dork.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.FollowUpCheckIn
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.NextAction
import health.dork.app.core.data.model.NextActionKind
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.data.model.RefillRequest
import health.dork.app.core.data.model.VisitIntake
import health.dork.app.core.data.repository.AuthRepository
import health.dork.app.core.data.repository.CareRepository
import health.dork.app.core.data.repository.ClinicRepository
import health.dork.app.core.data.repository.FollowUpRepository
import health.dork.app.core.data.repository.IntakeRepository
import health.dork.app.core.data.repository.MedicationRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.data.repository.RecordRepository
import health.dork.app.core.data.repository.RefillRepository
import health.dork.app.core.data.repository.SettingsRepository
import health.dork.app.core.data.util.DateCalculators
import health.dork.app.core.designsystem.components.MedicationDoseState
import health.dork.app.core.loop.CareLoopEngine
import health.dork.app.core.loop.CareLoopSnapshot
import health.dork.app.core.loop.CareLoopState
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime

data class HomeUiState(
  val patient: PatientProfile? = null,
  val nextAppointment: AppointmentItem? = null,
  val nextDose: MedicationDose? = null,
  val todayAppointments: List<AppointmentItem> = emptyList(),
  val todayDoses: List<MedicationDose> = emptyList(),
  val recentRecords: List<HealthRecordItem> = emptyList(),
  val checkInStatus: String? = null,
  val todayAppointmentCount: Int = 0,
  val todayDoseCount: Int = 0,
  val takenDoseCount: Int = 0,
  val skippedDoseCount: Int = 0,
  val isDemoMode: Boolean = false,
  val medicationRemindersEnabled: Boolean = true,
  val loop: CareLoopState? = null,
  val openRefills: Int = 0,
  val followUpDue: FollowUpCheckIn? = null,
  val clinicLinked: Boolean = false,
  val isLoading: Boolean = false
) {
  val firstName: String
    get() = patient?.fullName?.trim()?.substringBefore(" ")?.ifBlank { "there" } ?: "there"

  val nextAction: NextAction?
    get() = loop?.nextAction
}

class HomeViewModel(
  private val patientRepository: PatientRepository,
  private val careRepository: CareRepository,
  private val medicationRepository: MedicationRepository,
  private val recordRepository: RecordRepository,
  private val settingsRepository: SettingsRepository,
  private val authRepository: AuthRepository,
  private val intakeRepository: IntakeRepository,
  private val followUpRepository: FollowUpRepository,
  private val refillRepository: RefillRepository,
  private val clinicRepository: ClinicRepository
) : ViewModel() {

  init {
    viewModelScope.launch {
      followUpRepository.syncWithAppointments(careRepository.appointments.value)
    }
    viewModelScope.launch {
      careRepository.appointments.collect { appointments ->
        followUpRepository.syncWithAppointments(appointments)
      }
    }
  }

  private data class CoreState(
    val patient: PatientProfile?,
    val appointments: List<AppointmentItem>,
    val doses: List<MedicationDose>,
    val records: List<HealthRecordItem>,
    val checkIn: String?
  )

  private data class LoopSource(
    val intakes: List<VisitIntake>,
    val checkIns: List<FollowUpCheckIn>,
    val refills: List<RefillRequest>,
    val plans: List<health.dork.app.core.data.model.MedicationPlan>,
    val clinicLinked: Boolean
  )

  private val coreStream = combine(
    patientRepository.profile,
    careRepository.appointments,
    medicationRepository.todayDoses,
    recordRepository.timelineRecords,
    settingsRepository.todayCheckIn
  ) { patient, appointments, doses, records, checkIn ->
    CoreState(patient, appointments, doses, records, checkIn)
  }

  private val loopStream = combine(
    intakeRepository.intakes,
    followUpRepository.checkIns,
    refillRepository.requests,
    medicationRepository.medicationPlans,
    clinicRepository.link
  ) { intakes, checkIns, refills, plans, link ->
    LoopSource(intakes, checkIns, refills, plans, link != null)
  }

  private val baseState = combine(coreStream, loopStream) { core, loop ->
    val now = LocalDateTime.now()
    val today = now.toLocalDate()

    val activeAppointments = core.appointments.filter { it.status.name != "Cancelled" }
    val todayAppointments = activeAppointments
      .filter { appointmentDate(it) == today }
      .sortedBy { it.dateIso }
    val nextAppointment = activeAppointments
      .filter { appointmentDateTime(it)?.isAfter(now) == true }
      .minByOrNull { it.dateIso }

    val dueOrUpcoming = core.doses
      .filter { it.state == MedicationDoseState.Due || it.state == MedicationDoseState.Upcoming }
      .minByOrNull { DateCalculators.parseClinicTime(it.scheduledTime) ?: java.time.LocalTime.MAX }

    val loopState = CareLoopEngine.evaluate(
      CareLoopSnapshot(
        now = now,
        patientFirstName = core.patient?.fullName?.substringBefore(" ") ?: "there",
        appointments = core.appointments,
        doses = core.doses,
        plans = loop.plans,
        intakes = loop.intakes,
        followUps = loop.checkIns,
        refills = loop.refills,
        clinicLinked = loop.clinicLinked
      )
    )

    HomeUiState(
      patient = core.patient,
      nextAppointment = nextAppointment,
      nextDose = dueOrUpcoming,
      todayAppointments = todayAppointments,
      todayDoses = core.doses,
      recentRecords = core.records.sortedByDescending { it.dateIso }.take(3),
      checkInStatus = core.checkIn,
      todayAppointmentCount = todayAppointments.size,
      todayDoseCount = core.doses.size,
      takenDoseCount = core.doses.count {
        it.state == MedicationDoseState.Taken || it.state == MedicationDoseState.Completed
      },
      skippedDoseCount = core.doses.count { it.state == MedicationDoseState.Skipped },
      loop = loopState,
      openRefills = loop.refills.count { it.isOpen },
      followUpDue = loopState.openFollowUp,
      clinicLinked = loop.clinicLinked,
      isLoading = false
    )
  }

  val uiState: StateFlow<HomeUiState> = combine(
    baseState,
    authRepository.isDemoMode,
    settingsRepository.medicationReminders
  ) { state, demoMode, remindersEnabled ->
    state.copy(isDemoMode = demoMode, medicationRemindersEnabled = remindersEnabled)
  }.stateIn(
    scope = viewModelScope,
    started = SharingStarted.WhileSubscribed(5000),
    initialValue = HomeUiState(isLoading = true)
  )

  fun onCheckInClick(feeling: String) {
    settingsRepository.setCheckIn(feeling)
  }

  fun markDoseTaken(doseId: String) {
    viewModelScope.launch { medicationRepository.markDoseTaken(doseId) }
  }

  fun skipDose(doseId: String) {
    viewModelScope.launch { medicationRepository.markDoseSkipped(doseId) }
  }

  /**
   * Runs the primary call-to-action on the "next step" card. Actions that need a
   * screen are surfaced to the navigator; the two that can be completed in place
   * (take a dose, mark a reminder) are handled here.
   */
  fun performInPlace(action: NextAction): Boolean {
    return when (action.kind) {
      NextActionKind.TAKE_DOSE -> {
        action.doseId?.let { markDoseTaken(it) }
        true
      }
      else -> false
    }
  }

  fun refreshFollowUps() {
    viewModelScope.launch {
      followUpRepository.syncWithAppointments(careRepository.appointments.value)
    }
  }

  private fun appointmentDateTime(appointment: AppointmentItem): LocalDateTime? =
    runCatching { LocalDateTime.parse(appointment.dateIso) }.getOrNull()

  private fun appointmentDate(appointment: AppointmentItem): LocalDate? =
    appointmentDateTime(appointment)?.toLocalDate()
}
