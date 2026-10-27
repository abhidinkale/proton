package health.dork.app.core.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class HealthRecordType {
  CONSULTATION,
  LAB_RESULT,
  PRESCRIPTION,
  DIAGNOSTIC_REPORT,
  DOCUMENT,
  OBSERVATION
}

@Serializable
data class HealthRecordItem(
  val id: String,
  val type: HealthRecordType,
  val title: String,
  val subtitle: String,
  val dateIso: String,
  val displayDate: String,
  val doctorOrLab: String,
  val summary: String,
  val fhirResourceId: String? = null
)

@Serializable
enum class LabStatus(val label: String) {
  WITHIN_RANGE("Within reference range"),
  ABOVE_RANGE("Above reference range"),
  BELOW_RANGE("Below reference range")
}

@Serializable
data class LabTestItem(
  val id: String,
  val testName: String,
  val value: String,
  val unit: String,
  val referenceRangeLow: Double,
  val referenceRangeHigh: Double,
  val status: LabStatus,
  val dateString: String,
  val laboratoryName: String,
  val notes: String? = null
)

@Serializable
data class PrescriptionMedicineItem(
  val name: String,
  val dose: String,
  val route: String = "Oral",
  val frequency: String,
  val duration: String,
  val instructions: String,
  val refillsAllowed: Int = 0
)

@Serializable
data class PrescriptionDetail(
  val id: String,
  val doctorName: String,
  val clinicName: String,
  val dateIssued: String,
  val diagnosisReason: String,
  val medications: List<PrescriptionMedicineItem>,
  val clinicalNotes: String? = null,
  val followUpRecommendation: String? = null
)

/**
 * A timeline record paired with the structured prescription behind it. The
 * clinic sends these together so the app can keep both representations in step
 * without inventing a second id space.
 */
@Serializable
data class PrescriptionBundle(
  val record: HealthRecordItem,
  val detail: PrescriptionDetail
)

@Serializable
enum class DocumentCategory(val label: String) {
  LAB_REPORT("Laboratory Report"),
  PRESCRIPTION("Prescription"),
  DISCHARGE_SUMMARY("Discharge Summary"),
  IMAGING_REPORT("Imaging / Radiology"),
  REFERRAL("Referral Letter"),
  INSURANCE("Insurance & Claims"),
  OTHER("Other Medical Document")
}

@Serializable
data class HealthDocument(
  val id: String,
  val title: String,
  val category: DocumentCategory,
  val uploadDate: String,
  val fileSizeText: String,
  val originalUri: String,
  val isOcrProcessed: Boolean = false,
  val extractedText: String? = null,
  val structuredEntities: List<String> = emptyList(),
  /** The clinic's id for this document, once it has been sent. */
  val remoteId: String? = null,
  /**
   * LOCAL_ONLY — on this phone, never sent (sync off, or not signed in).
   * SENDING    — an upload was attempted and is not confirmed yet.
   * SENT       — the clinic holds a copy.
   * FAILED     — the clinic refused it (wrong type, too large).
   */
  val syncState: String = "LOCAL_ONLY"
)
