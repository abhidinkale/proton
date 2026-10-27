package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.ShareState
import health.dork.app.core.data.model.VisitIntake
import health.dork.app.core.sync.NoOpSyncEnqueuer
import health.dork.app.core.sync.SyncEnqueuer
import health.dork.app.core.sync.enqueueIntake
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import java.time.LocalDateTime

/**
 * Pre-visit intake, persisted per appointment.
 *
 * A draft survives a process death, so a patient can start answering on the bus
 * and finish at reception. "Shared" is only ever set by a real hand-off action,
 * never by opening a screen.
 */
interface IntakeRepository {
  val intakes: StateFlow<List<VisitIntake>>

  fun intakeFor(appointmentId: String): VisitIntake

  suspend fun saveDraft(intake: VisitIntake)

  suspend fun complete(intake: VisitIntake): Result<VisitIntake>

  suspend fun markShared(appointmentId: String)

  suspend fun clearFor(appointmentId: String)
}

class DorkIntakeRepository(
  private val store: DorkStore = DorkStore(),
  private val now: () -> LocalDateTime = { LocalDateTime.now() },
  private val sync: SyncEnqueuer = NoOpSyncEnqueuer
) : IntakeRepository {

  private val serializer = ListSerializer(VisitIntake.serializer())

  private val _intakes = MutableStateFlow(store.read(KEY, serializer) ?: emptyList())
  override val intakes: StateFlow<List<VisitIntake>> = _intakes.asStateFlow()

  override fun intakeFor(appointmentId: String): VisitIntake =
    _intakes.value.find { it.appointmentId == appointmentId }
      ?: VisitIntake(appointmentId = appointmentId)

  override suspend fun saveDraft(intake: VisitIntake) {
    val next = intake.copy(
      state = if (intake.state == ShareState.Shared) ShareState.Shared else ShareState.Draft
    )
    upsert(next)
  }

  override suspend fun complete(intake: VisitIntake): Result<VisitIntake> {
    if (intake.mainConcern.isBlank()) {
      return Result.failure(IllegalArgumentException("Describe what you want to discuss."))
    }
    if (intake.onset == null || intake.pattern == null) {
      return Result.failure(IllegalArgumentException("Answer the onset and pattern questions."))
    }
    val completed = intake.copy(
      state = ShareState.Completed,
      completedAtIso = intake.completedAtIso ?: now().toString()
    )
    upsert(completed)
    return Result.success(completed)
  }

  override suspend fun markShared(appointmentId: String) {
    val current = _intakes.value.find { it.appointmentId == appointmentId } ?: return
    if (current.state == ShareState.Draft) return
    val shared = current.copy(state = ShareState.Shared, sharedAtIso = now().toString())
    upsert(shared)
    // Only the explicit "send to clinic" action enqueues. Completing a form
    // never claims, or quietly arranges, that the clinic has seen it.
    sync.enqueueIntake(shared, now().toString())
  }

  override suspend fun clearFor(appointmentId: String) {
    _intakes.value = _intakes.value.filterNot { it.appointmentId == appointmentId }
    persist()
  }

  private fun upsert(intake: VisitIntake) {
    val existing = _intakes.value.any { it.appointmentId == intake.appointmentId }
    _intakes.value = if (existing) {
      _intakes.value.map { if (it.appointmentId == intake.appointmentId) intake else it }
    } else {
      _intakes.value + intake
    }
    persist()
  }

  private fun persist() {
    store.write(KEY, serializer, _intakes.value)
  }

  private companion object {
    const val KEY = "care:intakes"
  }
}
