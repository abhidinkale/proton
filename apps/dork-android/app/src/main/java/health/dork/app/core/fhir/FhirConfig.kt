package health.dork.app.core.fhir

import kotlinx.serialization.json.Json

enum class FhirPersistenceMode {
  SYNTHETIC_STORE,
  MEDPLUM_LIVE
}

enum class Environment {
  DEVELOPMENT,
  STAGING,
  PRODUCTION
}

data class FhirConfig(
  val environment: Environment = Environment.DEVELOPMENT,
  val persistenceMode: FhirPersistenceMode = FhirPersistenceMode.SYNTHETIC_STORE,
  val baseUrl: String = "http://10.0.2.2:8103/fhir/R4", // Android emulator localhost
  val token: String = "dork-patient-token-dev",
  val projectId: String = "c5a1febc-d04d-4e03-9a90-2e4875d70dbd",
  val clientId: String = "2df82232-9303-4ded-b789-112271e76674",
  val tenantId: String = "org-default"
)

object FhirJson {
  val json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    encodeDefaults = true
    prettyPrint = false
  }
}
