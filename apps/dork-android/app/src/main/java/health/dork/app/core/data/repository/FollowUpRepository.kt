package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.FollowUpAnswer
import health.dork.app.core.data.model.FollowUpCheckIn
import health.dork.app.core.data.model.ShareState
import health.dork.app.core.designsystem.components.AppointmentStatus
import health.dork.app.core.sync.NoOpSyncEnqueuer
import health.dork.app.core.sync.SyncEnqueuer
import health.dork.app.core.sync.enqueueFollowUp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import java.time.LocalDateTime

/**
 * The 48-hour after-visit check-in.
 *
 * Check-ins are materialised from the appointment list rather than seeded, so a
 * visit booked and completed inside the app produces a real follow-up two days
 * later. Only visits inside [LOOKBACK_DAYS] are considered — an unanswered
 * question about a visit a year ago is noise, not care.
 */
interface FollowUpRepository {
  val checkIns: StateFlow<List<FollowUpCheckIn>>

  /** Creates any missing check-ins for recently completed visits. */
  suspend fun syncWithAppointments(appointments: List<AppointmentItem>)

  fun checkInFor(appointmentId: String): FollowUpCheckIn?

  suspend fun answer(appointmentId: String, answer: FollowUpAnswer): Result<FollowUpCheckIn>

  suspend fun markShared(appointmentId: String)

  fun dueCheckIn(): FollowUpCheckIn?
}

class DorkFollowUpRepository(
  private val store: DorkStore = DorkStore(),
  private val now: () -> LocalDateTime = { LocalDateTime.now() },
  private val sync: SyncEnqueuer = NoOpSyncEnqueuer
) : FollowUpRepository {

  private val serializer = ListSerializer(FollowUpCheckIn.serializer())

  private val _checkIns = MutableStateFlow(store.read(KEY, serializer) ?: emptyList())
  override val checkIns: StateFlow<List<FollowUpCheckIn>> = _checkIns.asStateFlow()

  override suspend fun syncWithAppointments(appointments: List<AppointmentItem>) {
    val current = now()
    val eligible = appointments.filter { appointment ->
      val start = runCatching { LocalDateTime.parse(appointment.dateIso) }.getOrNull()
        ?: return@filter false
      val completed = appointment.status == AppointmentStatus.Fulfilled ||
        (start.isBefore(current) && appointment.status != AppointmentStatus.Cancelled)
      completed && start.isBefore(current) &&
        start.isAfter(current.minusDays(LOOKBACK_DAYS.toLong()))
    }

    val existingIds = _checkIns.value.map { it.appointmentId }.toSet()
    val created = eligible
      .filter { it.id !in existingIds }
      .map { appointment ->
        val start = LocalDateTime.parse(appointment.dateIso)
        FollowUpCheckIn(
          id = "fu-${appointment.id}",
          appointmentId = appointment.id,
          doctorName = appointment.doctorName,
          visitDateIso = appointment.dateIso,
          dueAtIso = start.plusHours(FOLLOW_UP_AFTER_HOURS).toString()
        )
      }

    if (created.isNotEmpty()) {
      _checkIns.value = (_checkIns.value + created).sortedByDescending { it.visitDateIso }
      persist()
    }
  }

  override fun checkInFor(appointmentId: String): FollowUpCheckIn? =
    _checkIns.value.find { it.appointmentId == appointmentId }

  override suspend fun answer(
    appointmentId: String,
    answer: FollowUpAnswer
  ): Result<FollowUpCheckIn> {
    val existing = _checkIns.value.find { it.appointmentId == appointmentId }
      ?: return Result.failure(IllegalArgumentException("No check-in is due for that visit."))
    if (existing.answer != null) {
      return Result.failure(IllegalStateException("This check-in has already been answered."))
    }
    val updated = existing.copy(answer = answer, state = ShareState.Completed)
    _checkIns.value = _checkIns.value.map { if (it.id == updated.id) updated else it }
    persist()
    return Result.success(updated)
  }

  override suspend fun markShared(appointmentId: String) {
    val existing = _checkIns.value.find { it.appointmentId == appointmentId } ?: return
    if (existing.state != ShareState.Completed) return
    val updated = existing.copy(state = ShareState.Shared, sharedAtIso = now().toString())
    _checkIns.value = _checkIns.value.map { if (it.id == updated.id) updated else it }
    persist()
    sync.enqueueFollowUp(updated, now().toString())
  }

  override fun dueCheckIn(): FollowUpCheckIn? {
    val current = now()
    return _checkIns.value
      .filter { it.answer == null }
      .filter { runCatching { LocalDateTime.parse(it.dueAtIso) }.getOrNull()?.isBefore(current) == true }
      .minByOrNull { it.dueAtIso }
  }

  private fun persist() {
    store.write(KEY, serializer, _checkIns.value)
  }

  private companion object {
    const val KEY = "care:followups"
    const val FOLLOW_UP_AFTER_HOURS = 48L
    const val LOOKBACK_DAYS = 14
  }
}
