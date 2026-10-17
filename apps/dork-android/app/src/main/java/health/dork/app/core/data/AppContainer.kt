package health.dork.app.core.data

import health.dork.app.core.data.repository.AuthRepository
import health.dork.app.core.data.repository.CareRepository
import health.dork.app.core.data.repository.ChatRepository
import health.dork.app.core.data.repository.DefaultDorkAiRepository
import health.dork.app.core.data.repository.DorkAiRepository
import health.dork.app.core.data.repository.DorkAuthRepository
import health.dork.app.core.data.repository.DorkCareRepository
import health.dork.app.core.data.repository.DorkChatRepository
import health.dork.app.core.data.repository.DorkMedicationRepository
import health.dork.app.core.data.repository.DorkPatientRepository
import health.dork.app.core.data.repository.DorkRecordRepository
import health.dork.app.core.data.repository.MedicationRepository
import health.dork.app.core.data.repository.PatientRepository
import health.dork.app.core.data.repository.RecordRepository
import health.dork.app.core.fhir.FhirApiClient
import health.dork.app.core.fhir.FhirConfig

/**
 * Dependency container for Dork Healthcare Application.
 * Provides singleton repositories and injectable FHIR client.
 */
interface AppContainer {
  val authRepository: AuthRepository
  val patientRepository: PatientRepository
  val careRepository: CareRepository
  val medicationRepository: MedicationRepository
  val recordRepository: RecordRepository
  val chatRepository: ChatRepository
  val aiRepository: DorkAiRepository
  val fhirApiClient: FhirApiClient
}

class DefaultAppContainer : AppContainer {
  override val fhirApiClient: FhirApiClient by lazy {
    FhirApiClient(FhirConfig())
  }

  override val authRepository: AuthRepository by lazy {
    DorkAuthRepository()
  }

  override val patientRepository: PatientRepository by lazy {
    DorkPatientRepository()
  }

  override val careRepository: CareRepository by lazy {
    DorkCareRepository()
  }

  override val medicationRepository: MedicationRepository by lazy {
    DorkMedicationRepository()
  }

  override val recordRepository: RecordRepository by lazy {
    DorkRecordRepository()
  }

  override val chatRepository: ChatRepository by lazy {
    DorkChatRepository()
  }

  override val aiRepository: DorkAiRepository by lazy {
    DefaultDorkAiRepository()
  }
}

object DorkApp {
  lateinit var container: AppContainer

  fun initialize(customContainer: AppContainer? = null) {
    container = customContainer ?: DefaultAppContainer()
  }
}
