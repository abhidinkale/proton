package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.DocumentCategory
import health.dork.app.core.data.model.HealthDocument
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.model.LabTestItem
import health.dork.app.core.data.model.PrescriptionBundle
import health.dork.app.core.data.model.PrescriptionDetail
import health.dork.app.core.data.seed.DorkSeedData
import health.dork.app.core.data.util.DateCalculators
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import java.time.LocalDate

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

  /**
   * Server-owned prescription content wins, but only for the records it sends.
   * Local records the response does not mention are left exactly as they are.
   */
  fun mergeServerPrescriptions(remote: List<PrescriptionBundle>): Int
}

class DorkRecordRepository(
  private val store: DorkStore = DorkStore()
) : RecordRepository {

  private val recordSerializer = ListSerializer(HealthRecordItem.serializer())
  private val documentSerializer = ListSerializer(HealthDocument.serializer())

  private val _timelineRecords = MutableStateFlow(
    store.read(KEY_RECORDS, recordSerializer) ?: DorkSeedData.healthRecords
  )
  override val timelineRecords: StateFlow<List<HealthRecordItem>> = _timelineRecords.asStateFlow()

  private val _labResults = MutableStateFlow(DorkSeedData.labResults)
  override val labResults: StateFlow<List<LabTestItem>> = _labResults.asStateFlow()

  private val _documents = MutableStateFlow(
    store.read(KEY_DOCUMENTS, documentSerializer) ?: DorkSeedData.documents
  )
  override val documents: StateFlow<List<HealthDocument>> = _documents.asStateFlow()

  private val _activePrescription = MutableStateFlow(
    store.read(KEY_ACTIVE_PRESCRIPTION, PrescriptionDetail.serializer())
      ?: DorkSeedData.activePrescription
  )
  override val activePrescription: StateFlow<PrescriptionDetail> = _activePrescription.asStateFlow()

  override suspend fun uploadDocument(
    title: String,
    category: DocumentCategory,
    fileUri: String,
    fileSizeText: String
  ): Result<HealthDocument> {
    if (fileUri.isBlank()) {
      return Result.failure(IllegalArgumentException("Choose a file to store first."))
    }

    val today = LocalDate.now()
    val displayDate = DateCalculators.formatDisplayDate(today.toString())
    val resolvedTitle = title.ifBlank { "Medical document" }

    val newDoc = HealthDocument(
      id = "doc-${System.currentTimeMillis()}",
      title = resolvedTitle,
      category = category,
      uploadDate = displayDate,
      fileSizeText = fileSizeText,
      originalUri = fileUri,
      // No OCR engine is bundled with this build. Storing the original
      // document is real; claiming extracted text would not be.
      isOcrProcessed = false,
      extractedText = null,
      structuredEntities = emptyList()
    )

    _documents.value = listOf(newDoc) + _documents.value
    store.write(KEY_DOCUMENTS, documentSerializer, _documents.value)

    val newRecord = HealthRecordItem(
      id = "rec-${System.currentTimeMillis()}",
      type = HealthRecordType.DOCUMENT,
      title = resolvedTitle,
      subtitle = "${category.label} stored on this device",
      dateIso = today.toString(),
      displayDate = displayDate,
      doctorOrLab = "Uploaded by patient",
      summary = "Original file preserved. No automated text extraction was performed."
    )
    _timelineRecords.value = listOf(newRecord) + _timelineRecords.value
    store.write(KEY_RECORDS, recordSerializer, _timelineRecords.value)

    return Result.success(newDoc)
  }

  override fun mergeServerPrescriptions(remote: List<PrescriptionBundle>): Int {
    if (remote.isEmpty()) return 0

    val current = _timelineRecords.value.toMutableList()
    var applied = 0
    remote.forEach { bundle ->
      val index = current.indexOfFirst { it.id == bundle.record.id }
      if (index >= 0) {
        current[index] = bundle.record
      } else {
        current += bundle.record
      }
      applied++
    }

    if (applied > 0) {
      _timelineRecords.value = current
      store.write(KEY_RECORDS, recordSerializer, current)
    }

    val newest = remote.map { it.detail }.maxByOrNull { it.dateIssued }
    if (newest != null) {
      val active = _activePrescription.value
      if (newest.id == active.id || newest.dateIssued >= active.dateIssued) {
        _activePrescription.value = newest
        store.write(KEY_ACTIVE_PRESCRIPTION, PrescriptionDetail.serializer(), newest)
      }
    }

    return applied
  }

  private companion object {
    const val KEY_RECORDS = "records:timeline"
    const val KEY_DOCUMENTS = "records:documents"
    const val KEY_ACTIVE_PRESCRIPTION = "records:active_prescription"
  }
}
