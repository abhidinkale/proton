package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.MedicationPlan
import health.dork.app.core.data.model.RefillRequest
import health.dork.app.core.data.model.RefillStatus
import health.dork.app.core.sync.NoOpSyncEnqueuer
import health.dork.app.core.sync.SyncEnqueuer
import health.dork.app.core.sync.enqueueRefill
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Refill requests raised from the medication list.
 *
 * One open request per medication. A request moves to [RefillStatus.SHARED] only
 * when the patient actually sends it, so "Sent to clinic" is never a lie.
 */
interface RefillRepository {
  val requests: StateFlow<List<RefillRequest>>

  fun openRequestFor(medicationId: String): RefillRequest?

  suspend fun requestRefill(
    plan: MedicationPlan,
    pharmacy: String,
    note: String
  ): Result<RefillRequest>

  suspend fun markShared(requestId: String)

  suspend fun markFilled(requestId: String)

  suspend fun cancel(requestId: String)

  /** True when the plan runs out inside [days] and has no open request. */
  fun needsRefill(plan: MedicationPlan, withinDays: Long = 5): Boolean
}

class DorkRefillRepository(
  private val store: DorkStore = DorkStore(),
  private val now: () -> LocalDateTime = { LocalDateTime.now() },
  private val sync: SyncEnqueuer = NoOpSyncEnqueuer
) : RefillRepository {

  private val serializer = ListSerializer(RefillRequest.serializer())

  private val _requests = MutableStateFlow(store.read(KEY, serializer) ?: emptyList())
  override val requests: StateFlow<List<RefillRequest>> = _requests.asStateFlow()

  override fun openRequestFor(medicationId: String): RefillRequest? =
    _requests.value.firstOrNull { it.medicationId == medicationId && it.isOpen }

  override suspend fun requestRefill(
    plan: MedicationPlan,
    pharmacy: String,
    note: String
  ): Result<RefillRequest> {
    if (openRequestFor(plan.id) != null) {
      return Result.failure(IllegalStateException("A refill request for this medication is already open."))
    }
    val request = RefillRequest(
      id = "refill-${plan.id}-${java.util.UUID.randomUUID().toString().take(6)}",
      medicationId = plan.id,
      medicationName = plan.name,
      dosage = plan.dosage,
      prescriber = plan.prescribingDoctor,
      pharmacy = pharmacy.ifBlank { "Clinic pharmacy" },
      note = note.trim(),
      requestedAtIso = now().toString()
    )
    _requests.value = listOf(request) + _requests.value
    persist()
    return Result.success(request)
  }

  override suspend fun markShared(requestId: String) {
    val existing = _requests.value.find { it.id == requestId } ?: return
    val shared = existing.copy(status = RefillStatus.SHARED, sharedAtIso = now().toString())
    _requests.value = _requests.value.map { if (it.id == requestId) shared else it }
    persist()
    sync.enqueueRefill(shared, now().toString())
  }

  override suspend fun markFilled(requestId: String) {
    update(requestId) { it.copy(status = RefillStatus.COMPLETED) }
  }

  override suspend fun cancel(requestId: String) {
    update(requestId) { it.copy(status = RefillStatus.CANCELLED) }
  }

  override fun needsRefill(plan: MedicationPlan, withinDays: Long): Boolean {
    if (!plan.active) return false
    if (openRequestFor(plan.id) != null) return false
    val end = plan.endDateIso?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
      ?: return false
    val today = now().toLocalDate()
    return !end.isAfter(today.plusDays(withinDays))
  }

  private fun update(requestId: String, transform: (RefillRequest) -> RefillRequest) {
    _requests.value = _requests.value.map { if (it.id == requestId) transform(it) else it }
    persist()
  }

  private fun persist() {
    store.write(KEY, serializer, _requests.value)
  }

  private companion object {
    const val KEY = "medication:refills"
  }
}
