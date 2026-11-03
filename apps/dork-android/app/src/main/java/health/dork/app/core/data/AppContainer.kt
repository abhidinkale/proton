package health.dork.app.core.data

import android.content.Context
import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.repository.AuthRepository
import health.dork.app.core.data.repository.CareRepository
import health.dork.app.core.data.repository.ChatRepository
import health.dork.app.core.data.repository.ClinicInboxRepository
import health.dork.app.core.data.repository.ClinicRepository
import health.dork.app.core.data.repository.DefaultDorkAiRepository
import health.dork.app.core.data.repository.DorkAiRepository
import health.dork.app.core.data.repository.DorkAuthRepository
import health.dork.app.core.data.repository.DorkCareRepository
import health.dork.app.core.data.repository.DorkChatRepository
import health.dork.app.core.data.repository.DorkClinicInboxRepository
import health.dork.app.core.data.repository.DorkClinicRepository
import health.dork.app.core.data.repository.DorkFollowUpRepository
import health.dork.app.core.data.repository.DorkIntakeRepository
import health.dork.app.core.data.repository.DorkMedicationRepository
import health.dork.app.core.data.repository.DorkPatientRepository
import health.dork.app.core.data.repository.DorkRecordRepository
import health.dork.app.core.data.repository.DorkRefillRepository
import health.dork.app.core.data.repository.DorkSettingsRepository
import health.dork.app.core.data.repository.FollowUpRepository
import health.dork.app.core.data.repository.IntakeRepository
import health.dork.app.core.data.repository.MedicationRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.data.repository.RecordRepository
import health.dork.app.core.data.repository.RefillRepository
import health.dork.app.core.data.repository.SettingsRepository
import health.dork.app.core.reminder.MedicationReminderScheduler
import health.dork.app.core.sync.AuthClient
import health.dork.app.core.sync.DefaultSyncEnqueuer
import health.dork.app.core.sync.OkHttpAuthClient
import health.dork.app.core.sync.OkHttpDocumentUploader
import health.dork.app.core.sync.OkHttpSyncClient
import health.dork.app.core.sync.SyncClient
import health.dork.app.core.sync.SyncCoordinator
import health.dork.app.core.sync.SyncEngine
import health.dork.app.core.sync.SyncOutbox
import health.dork.app.core.sync.SyncScheduler
import health.dork.app.core.sync.SyncSettings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * Dependency container for the patient app.
 *
 * Every clinical repository here is backed by [DorkStore]. Sync is layered on
 * top as an optional outbox: when [SyncSettings.enabled] is false (the default)
 * the enqueuer is a no-op and the app behaves exactly like the offline build.
 */
interface AppContainer {
  val authRepository: AuthRepository
  val patientRepository: PatientRepository
  val careRepository: CareRepository
  val medicationRepository: MedicationRepository
  val recordRepository: RecordRepository
  val caseRepository: health.dork.app.core.data.repository.CaseRepository
  val chatRepository: ChatRepository
  val clinicInboxRepository: ClinicInboxRepository
  val aiRepository: DorkAiRepository
  val settingsRepository: SettingsRepository
  val intakeRepository: IntakeRepository
  val followUpRepository: FollowUpRepository
  val refillRepository: RefillRepository
  val clinicRepository: ClinicRepository
  val reminders: MedicationReminderScheduler?

  val syncSettings: SyncSettings
  val syncOutbox: SyncOutbox
  val authClient: AuthClient
  val syncClient: SyncClient
  val syncEngine: SyncEngine
  val syncScheduler: SyncScheduler?
  val syncCoordinator: SyncCoordinator?

  /** Deletes every account, record, message and preference stored locally. */
  fun eraseAllDeviceData()

  /**
   * Ends this patient's clinic relationship on the device.
   *
   * Sign-out must leave nothing that the next person to unlock the phone could
   * read or send: no clinic session, no queued requests, no clinic inbox.
   * Local records stay, because they are the device owner's and the existing
   * product model is one patient per phone; the account screen decides whether
   * to erase those too.
   */
  fun signOut()
}

class DefaultAppContainer(
  context: Context? = null
) : AppContainer {

  private val appContext: Context? = context?.applicationContext
  private val store = DorkStore(context)
  private val syncScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override val reminders: MedicationReminderScheduler? by lazy {
    appContext?.let { MedicationReminderScheduler(it) }
  }

  // Eager: constructing the outbox is what resets stale IN_FLIGHT rows on app
  // start, even if the patient never opens the sync screen.
  override val syncSettings: SyncSettings = SyncSettings(store)
  override val syncOutbox: SyncOutbox = SyncOutbox(store)

  override val authClient: AuthClient by lazy { OkHttpAuthClient() }
  override val syncClient: SyncClient by lazy { OkHttpSyncClient() }

  override val syncScheduler: SyncScheduler? by lazy {
    appContext?.let { SyncScheduler(it) }
  }

  private val syncEnqueuer = DefaultSyncEnqueuer(
    settings = syncSettings,
    outbox = syncOutbox,
    onEnqueued = { syncScheduler?.schedule() }
  )

  override val settingsRepository: SettingsRepository by lazy {
    DorkSettingsRepository(store)
  }

  override val authRepository: AuthRepository by lazy {
    DorkAuthRepository(store)
  }

  override val patientRepository: PatientRepository by lazy {
    DorkPatientRepository(store)
  }

  override val careRepository: CareRepository by lazy {
    DorkCareRepository(
      store = store,
      sync = syncEnqueuer,
      patientProvider = { patientRepository.profile.value }
    )
  }

  override val medicationRepository: MedicationRepository by lazy {
    DorkMedicationRepository(store)
  }

  override val recordRepository: RecordRepository by lazy {
    // The uploader reads the session and the patient's own sync switch at call
    // time, so a document is only ever sent while sync is enabled.
    DorkRecordRepository(store, documentUploader = OkHttpDocumentUploader(syncSettings))
  }

  override val caseRepository: health.dork.app.core.data.repository.CaseRepository by lazy {
    health.dork.app.core.data.repository.DorkCaseRepository(store)
  }

  override val chatRepository: ChatRepository by lazy {
    DorkChatRepository(store)
  }

  override val clinicInboxRepository: ClinicInboxRepository by lazy {
    DorkClinicInboxRepository(store)
  }

  override val intakeRepository: IntakeRepository by lazy {
    DorkIntakeRepository(store = store, sync = syncEnqueuer)
  }

  override val followUpRepository: FollowUpRepository by lazy {
    DorkFollowUpRepository(store = store, sync = syncEnqueuer)
  }

  override val refillRepository: RefillRepository by lazy {
    DorkRefillRepository(store = store, sync = syncEnqueuer)
  }

  override val clinicRepository: ClinicRepository by lazy {
    DorkClinicRepository(store)
  }

  override val aiRepository: DorkAiRepository by lazy {
    DefaultDorkAiRepository(
      store = store,
      patientProvider = { patientRepository.profile.value },
      recordsProvider = { recordRepository.timelineRecords.value },
      labsProvider = { recordRepository.labResults.value },
      medicationPlansProvider = { medicationRepository.medicationPlans.value },
      appointmentsProvider = { careRepository.appointments.value },
      careRepositoryProvider = { careRepository }
    )
  }

  override val syncEngine: SyncEngine by lazy {
    SyncEngine(
      settings = syncSettings,
      outbox = syncOutbox,
      client = syncClient,
      careRepository = careRepository,
      recordRepository = recordRepository,
      clinicInboxRepository = clinicInboxRepository
    )
  }

  override val syncCoordinator: SyncCoordinator? by lazy {
    appContext?.let { SyncCoordinator(syncEngine, syncSettings, syncScope) }
  }

  override fun eraseAllDeviceData() {
    reminders?.cancelAll()
    syncScheduler?.cancel()
    syncCoordinator?.onAppBackground()
    // `store.clear()` wipes the persisted copy, but these three hold live
    // in-memory state. Without clearing them the screen keeps showing the
    // previous patient's clinic messages until the process dies.
    clinicInboxRepository.clear()
    syncOutbox.clear()
    syncSettings.clearSession()
    store.clear()
  }

  override fun signOut() {
    syncCoordinator?.onAppBackground()
    syncScheduler?.cancel()
    syncSettings.clearSession()
    syncSettings.setEnabled(false)
    syncOutbox.clear()
    clinicInboxRepository.clear()
  }
}

object DorkApp {
  lateinit var container: AppContainer

  /** WorkManager can start before an Activity has created the container. */
  fun maybeContainer(): AppContainer? =
    if (::container.isInitialized) container else null

  fun initialize(customContainer: AppContainer? = null) {
    container = customContainer ?: DefaultAppContainer()
  }
}
