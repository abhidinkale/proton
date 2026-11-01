package health.dork.app.core.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class CaseStatus(val label: String) {
  ACTIVE("Active Care"),
  RESOLVED("Resolved"),
  FOLLOW_UP_DUE("Follow-up Due"),
  MONITORING("Observation")
}

@Serializable
enum class CaseBannerTheme {
  EMBER_GLOW,   // Fiery warm amber flare matching reference image
  CYAN_PULSE,   // Serene turquoise/azure clinical glow
  VIOLET_MYSTIC,// Royal deep violet/magenta
  EMERALD_VITAL // Fresh botanical emerald
}

@Serializable
data class CaseVitals(
  val bloodPressure: String? = null,
  val heartRate: String? = null,
  val spo2: String? = null,
  val temperature: String? = null,
  val bmi: String? = null
)

@Serializable
data class CaseTreatment(
  val protocolSummary: String,
  val lifestyleGuidance: String? = null,
  val precautions: String? = null
)

@Serializable
data class ClinicalCase(
  val id: String,
  val diagnosisTitle: String,
  val subtitle: String,
  val icdCode: String,
  val clinicName: String,
  val doctorName: String,
  val visitDateIso: String,
  val dayDisplay: String,
  val monthDisplay: String,
  val yearDisplay: String,
  val status: CaseStatus,
  val bannerTheme: CaseBannerTheme = CaseBannerTheme.EMBER_GLOW,
  val clinicalSummary: String,
  val treatment: CaseTreatment,
  val medications: List<PrescriptionMedicineItem> = emptyList(),
  val reports: List<HealthRecordItem> = emptyList(),
  val vitals: CaseVitals? = null,
  val followUpRecommendation: String? = null,
  val metaNoteCount: String
)
