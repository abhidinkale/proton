package health.dork.app.core.sync

import health.dork.app.BuildConfig
import health.dork.app.core.data.repository.CareRepository
import health.dork.app.core.data.repository.ClinicInboxRepository
import health.dork.app.core.data.repository.NoOpClinicInboxRepository
import health.dork.app.core.data.repository.RecordRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Instant

/** Outcome of one full sync pass, used by the worker and the UI. */
data class SyncRunReport(
  val sent: Int = 0,
  val retryableFailure: Boolean = false,
  val permanentFailure: Boolean = false,
  val needsReauth: Boolean = false,
  val pulledAppointments: Int = 0,
  val pulledPrescriptions: Int = 0,
  val pulledMessages: Int = 0,
  val error: String? = null
)

/**
 * Drains the outbox and pulls the clinic's view of the record.
 *
 * The merge is intentionally asymmetric:
 *  - the server wins for records it owns (appointment status/slot, prescription
 *    content);
 *  - the device wins for a record with an unsynced local edit;
 *  - nothing local is deleted just because a response omitted it.
 */
class SyncEngine(
  private val settings: SyncSettings,
  private val outbox: SyncOutbox,
  private val client: SyncClient,
  private val careRepository: CareRepository,
  private val recordRepository: RecordRepository,
  private val clinicInboxRepository: ClinicInboxRepository = NoOpClinicInboxRepository,
  private val allowCleartextLocalhost: Boolean = BuildConfig.DEBUG,
  private val nowIso: () -> String = { Instant.now().toString() }
) {

  private val _status = MutableStateFlow(
    SyncStatus(phase = SyncPhase.IDLE, lastSyncAtIso = settings.lastSyncAtIso.value)
  )
  val status: StateFlow<SyncStatus> = _status.asStateFlow()

  suspend fun runOnce(): SyncRunReport {
    if (!settings.enabled.value) return SyncRunReport()
    if (settings.baseUrl.value.isBlank()) return SyncRunReport()

    if (!SyncUrlPolicy.validate(settings.baseUrl.value, allowCleartextLocalhost)
        .let { it is SyncUrlPolicy.Result.Valid }
    ) {
      val message = "Sync is paused until the server address is a valid https:// URL."
      _status.value = SyncStatus(SyncPhase.ERROR, settings.lastSyncAtIso.value, message)
      return SyncRunReport(error = message)
    }

    if (!settings.isReady()) {
      val message = "Sign in again to keep syncing with your clinic."
      _status.value = SyncStatus(SyncPhase.NEEDS_REAUTH, settings.lastSyncAtIso.value, message)
      return SyncRunReport(needsReauth = true, error = message)
    }

    _status.value = _status.value.copy(phase = SyncPhase.SYNCING, message = null)

    val drain = drainOutbox()
    if (drain.needsReauth) return drain

    // A transient outbox failure must not stop the patient receiving new
    // appointments or prescriptions from the clinic.
    val pull = pull()
    return drain.copy(
      pulledAppointments = pull.pulledAppointments,
      pulledPrescriptions = pull.pulledPrescriptions,
      pulledMessages = pull.pulledMessages,
      needsReauth = drain.needsReauth || pull.needsReauth,
      retryableFailure = drain.retryableFailure || pull.retryableFailure,
      permanentFailure = drain.permanentFailure || pull.permanentFailure,
      error = pull.error ?: drain.error
    )
  }

  private suspend fun drainOutbox(): SyncRunReport {
    val session = settings.session.value ?: return expires()
    val baseUrl = settings.baseUrl.value
    var sent = 0
    var permanent = false

    while (true) {
      val entry = outbox.nextPending() ?: break
      outbox.markInFlight(entry.id)

      val outcome = try {
        client.send(baseUrl, session, entry.copy(status = OutboxStatus.IN_FLIGHT))
      } catch (cancellation: CancellationException) {
        throw cancellation
      } catch (_: Exception) {
        SyncSendOutcome.Retryable("No connection to the clinic. Will retry.")
      }

      when (outcome) {
        is SyncSendOutcome.Success -> {
          outbox.markSynced(entry.id)
          sent++
        }

        is SyncSendOutcome.Unauthorized -> {
          // Keep the row and every local record. The patient signs in again.
          outbox.returnToPending(entry.id, "Session expired. Sign in again.")
          return expires()
        }

        is SyncSendOutcome.Retryable -> {
          outbox.markRetryableFailure(entry.id, outcome.message)
          _status.value = SyncStatus(
            phase = SyncPhase.ERROR,
            lastSyncAtIso = settings.lastSyncAtIso.value,
            message = outcome.message
          )
          // Stop here: later rows may depend on this one.
          return SyncRunReport(
            sent = sent,
            retryableFailure = true,
            permanentFailure = permanent,
            error = outcome.message
          )
        }

        is SyncSendOutcome.Permanent -> {
          // Keep the row so the patient can see and retry it, then continue
          // with independent rows.
          outbox.markPermanentFailure(entry.id, outcome.message)
          permanent = true
        }
      }
    }

    if (!permanent) {
      _status.value = SyncStatus(
        phase = SyncPhase.IDLE,
        lastSyncAtIso = settings.lastSyncAtIso.value
      )
    }
    return SyncRunReport(sent = sent, permanentFailure = permanent)
  }

  private suspend fun pull(): SyncRunReport {
    val session = settings.session.value ?: return expires()
    val baseUrl = settings.baseUrl.value

    return when (val outcome = client.pull(baseUrl, session)) {
      is SyncPullOutcome.Success -> {
        val protectedIds = outbox.protectedAppointmentIds()
        // Map before merging: the server's row is not the local model.
        val remoteAppointments = outcome.data.appointments.mapNotNull { remote ->
          RemoteAppointmentMapper.toLocal(remote, careRepository.doctors.value)
        }
        val appointments = careRepository.mergeRemoteAppointments(
          remote = remoteAppointments,
          protectedIds = protectedIds
        )
        val prescriptions = recordRepository.mergeServerPrescriptions(outcome.data.prescriptions)
        careRepository.mergeRemoteAvailability(
          outcome.data.availability.associate { it.doctorId to it.weeklyHours }
        )

        val at = nowIso()
        val messages = outcome.data.messages
          .mapNotNull { RemoteClinicMessageMapper.toLocal(it, at) }
        val pulledMessages = clinicInboxRepository.merge(messages)

        settings.setLastSyncAt(at)
        _status.value = SyncStatus(phase = SyncPhase.IDLE, lastSyncAtIso = at)
        SyncRunReport(
          pulledAppointments = appointments,
          pulledPrescriptions = prescriptions,
          pulledMessages = pulledMessages
        )
      }

      is SyncPullOutcome.Unauthorized -> expires()

      is SyncPullOutcome.Failure -> {
        _status.value = SyncStatus(
          phase = SyncPhase.ERROR,
          lastSyncAtIso = settings.lastSyncAtIso.value,
          message = outcome.message
        )
        SyncRunReport(
          retryableFailure = outcome.retryable,
          permanentFailure = !outcome.retryable,
          error = outcome.message
        )
      }
    }
  }

  private fun expires(): SyncRunReport {
    settings.clearSession()
    val message = "Sign in again to keep syncing with your clinic."
    _status.value = SyncStatus(
      phase = SyncPhase.NEEDS_REAUTH,
      lastSyncAtIso = settings.lastSyncAtIso.value,
      message = message
    )
    return SyncRunReport(needsReauth = true, error = message)
  }
}
