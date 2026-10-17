package health.dork.app.core.data.repository

import health.dork.app.core.data.model.DocumentCategory
import health.dork.app.core.data.model.HealthDocument
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.model.LabTestItem
import health.dork.app.core.data.model.PrescriptionDetail
import health.dork.app.core.data.seed.DorkSeedData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

interface RecordRepository {
  val timelineRecords: StateFlow<List<HealthRecordItem>>
  val labResults: StateFlow<List<LabTestItem>>
  val documents: StateFlow<List<HealthDocument>>
  val activePrescription: StateFlow<PrescriptionDetail>
  suspend fun uploadDocument(
    title: String,
    category: DocumentCategory,
    fileUri: String,
    fileSizeText: String
  ): Result<HealthDocument>
}

class DorkRecordRepository : RecordRepository {
  private val _timelineRecords = MutableStateFlow(DorkSeedData.healthRecords)
  override val timelineRecords: StateFlow<List<HealthRecordItem>> = _timelineRecords.asStateFlow()

  private val _labResults = MutableStateFlow(DorkSeedData.labResults)
  override val labResults: StateFlow<List<LabTestItem>> = _labResults.asStateFlow()

  private val _documents = MutableStateFlow(DorkSeedData.documents)
  override val documents: StateFlow<List<HealthDocument>> = _documents.asStateFlow()

  private val _activePrescription = MutableStateFlow(DorkSeedData.activePrescription)
  override val activePrescription: StateFlow<PrescriptionDetail> = _activePrescription.asStateFlow()

  override suspend fun uploadDocument(
    title: String,
    category: DocumentCategory,
    fileUri: String,
    fileSizeText: String
  ): Result<HealthDocument> {
    val newDoc = HealthDocument(
      id = "doc-${System.currentTimeMillis()}",
      title = title,
      category = category,
      uploadDate = "Today",
      fileSizeText = fileSizeText,
      originalUri = fileUri,
      isOcrProcessed = true,
      extractedText = "OCR Text extracted successfully from uploaded medical document: $title. Normal parameters observed.",
      structuredEntities = listOf("Document Type: ${category.label}", "Status: Verified & Stored")
    )

    _documents.value = listOf(newDoc) + _documents.value

    // Also add to longitudinal timeline
    val newRecord = HealthRecordItem(
      id = "rec-${System.currentTimeMillis()}",
      type = HealthRecordType.DOCUMENT,
      title = title,
      subtitle = "${category.label} uploaded",
      dateIso = "2026-10-18",
      displayDate = "Today",
      doctorOrLab = "Uploaded by Patient",
      summary = newDoc.extractedText ?: "Medical document stored securely."
    )
    _timelineRecords.value = listOf(newRecord) + _timelineRecords.value

    return Result.success(newDoc)
  }
}
