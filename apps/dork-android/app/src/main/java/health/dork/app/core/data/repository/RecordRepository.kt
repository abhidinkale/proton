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
import health.dork.app.core.sync.DocumentUploadRequest
import health.dork.app.core.sync.DocumentUploadResult
import health.dork.app.core.sync.DocumentUploader
import health.dork.app.core.sync.RemoteDocument
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

  /**
   * Stores the patient's file on the device and, when the bytes are supplied
   * and sync is on, sends it to the clinic.
   *
   * The local write happens first and is never rolled back by a network
   * failure: a patient who photographed a report must not lose it because the
   * ward's wifi dropped. `syncState` on the result says what the clinic knows.
   */
  suspend fun uploadDocument(
    title: String,
    category: DocumentCategory,
    fileUri: String,
    fileSizeText: String,
    bytes: ByteArray? = null,
    mimeType: String = "application/pdf",
    fileName: String = "document.pdf",
    isOcrProcessed: Boolean = false,
    extractedText: String? = null,
    structuredEntities: List<String> = emptyList()
  ): Result<HealthDocument>

  /**
   * Server-owned prescription content wins, but only for the records it sends.
   * Local records the response does not mention are left exactly as they are.
   */
  fun mergeServerPrescriptions(remote: List<PrescriptionBundle>): Int

  /**
   * Merges the clinic's document index into this device.
   *
   * A document the server mentions is marked SENT (the clinic holds it, whether
   * this phone uploaded it or a clinician attached it later). A local document
   * the server does not mention keeps its own state — absence is not deletion.
   */
  fun mergeServerDocuments(remote: List<RemoteDocument>): Int

  /**
   * Imports standardized EHR clinical records (from Epic, Cerner, Athena, etc.)
   * directly onto the patient's longitudinal timeline.
   */
  fun importEhrRecords(records: List<HealthRecordItem>): Int
}

class DorkRecordRepository(
  private val store: DorkStore = DorkStore(),
  private val documentUploader: DocumentUploader? = null
) : RecordRepository {

  private val recordSerializer = ListSerializer(HealthRecordItem.serializer())
  private val documentSerializer = ListSerializer(HealthDocument.serializer())
  private val labSerializer = ListSerializer(LabTestItem.serializer())

  private val _timelineRecords = MutableStateFlow(
    store.read(KEY_RECORDS, recordSerializer) ?: emptyList()
  )
  override val timelineRecords: StateFlow<List<HealthRecordItem>> = _timelineRecords.asStateFlow()

  private val _labResults = MutableStateFlow(
    store.read(KEY_LABS, labSerializer) ?: DorkSeedData.labResults
  )
  override val labResults: StateFlow<List<LabTestItem>> = _labResults.asStateFlow()

  private val _documents = MutableStateFlow(
    store.read(KEY_DOCUMENTS, documentSerializer) ?: emptyList()
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
    fileSizeText: String,
    bytes: ByteArray?,
    mimeType: String,
    fileName: String,
    isOcrProcessed: Boolean,
    extractedText: String?,
    structuredEntities: List<String>
  ): Result<HealthDocument> {
    if (fileUri.isBlank()) {
      return Result.failure(IllegalArgumentException("Choose a file to store first."))
    }

    val today = LocalDate.now()
    val displayDate = DateCalculators.formatDisplayDate(today.toString())
    val resolvedTitle = title.ifBlank { "Medical document" }
    val localId = "doc-${System.currentTimeMillis()}"

    // The device copy is written before any network call. The patient's record
    // must survive a failed upload, and sync state is how the UI stays honest
    // about where that copy actually is.
    var newDoc = HealthDocument(
      id = localId,
      title = resolvedTitle,
      category = category,
      uploadDate = displayDate,
      fileSizeText = fileSizeText,
      originalUri = fileUri,
      isOcrProcessed = isOcrProcessed,
      extractedText = extractedText,
      structuredEntities = structuredEntities
    )

    _documents.value = listOf(newDoc) + _documents.value
    store.write(KEY_DOCUMENTS, documentSerializer, _documents.value)

    var sentToClinic = false
    val uploader = documentUploader
    if (uploader != null && bytes != null && bytes.isNotEmpty()) {
      newDoc = when (val outcome = uploader.upload(
        DocumentUploadRequest(
          bytes = bytes,
          fileName = fileName,
          mimeType = mimeType,
          title = resolvedTitle,
          category = category.name,
          localDocumentId = localId
        )
      )) {
        is DocumentUploadResult.Success ->
          newDoc.copy(remoteId = outcome.remoteId ?: newDoc.id, syncState = "SENT").also {
            sentToClinic = true
          }
        is DocumentUploadResult.NotSignedIn -> newDoc
        is DocumentUploadResult.Failed ->
          newDoc.copy(syncState = if (outcome.retryable) "SENDING" else "FAILED")
      }

      _documents.value = _documents.value.map { if (it.id == localId) newDoc else it }
      store.write(KEY_DOCUMENTS, documentSerializer, _documents.value)
    }

    val newRecord = HealthRecordItem(
      id = "rec-$localId",
      type = HealthRecordType.DOCUMENT,
      title = resolvedTitle,
      subtitle = if (sentToClinic) {
        "${category.label} · sent to your clinic"
      } else {
        "${category.label} stored on this device"
      },
      dateIso = today.toString(),
      displayDate = displayDate,
      doctorOrLab = "Uploaded by patient",
      summary = "Original file preserved. No automated text extraction was performed."
    )
    _timelineRecords.value = listOf(newRecord) + _timelineRecords.value
    store.write(KEY_RECORDS, recordSerializer, _timelineRecords.value)

    return Result.success(newDoc)
  }

  override fun mergeServerDocuments(remote: List<RemoteDocument>): Int {
    if (remote.isEmpty()) return 0

    val documents = _documents.value.toMutableList()
    val records = _timelineRecords.value.toMutableList()
    var applied = 0

    remote.forEach { document ->
      if (document.id.isBlank()) return@forEach
      val category = runCatching { DocumentCategory.valueOf(document.category) }
        .getOrDefault(DocumentCategory.OTHER)
      val dateIso = document.uploadedAt?.take(10)?.takeIf { it.length == 10 }
        ?: LocalDate.now().toString()
      val displayDate = DateCalculators.formatDisplayDate(dateIso)

      val index = documents.indexOfFirst { it.remoteId == document.id || it.id == document.id }
      if (index >= 0) {
        documents[index] = documents[index].copy(
          remoteId = document.id,
          syncState = "SENT",
          fileSizeText = documents[index].fileSizeText.ifBlank { sizeTextOf(document.byteSize) }
        )
      } else {
        documents += HealthDocument(
          id = document.id,
          title = document.title.ifBlank { "Medical document" },
          category = category,
          uploadDate = displayDate,
          fileSizeText = sizeTextOf(document.byteSize),
          // Bytes live at the clinic; there is no local file to open.
          originalUri = "",
          remoteId = document.id,
          syncState = "SENT"
        )
      }

      // The timeline is the patient's medical history, so a document the
      // clinic holds must appear there even if this phone never saw the file.
      if (records.none { it.id == "rec-${document.id}" }) {
        records += HealthRecordItem(
          id = "rec-${document.id}",
          type = HealthRecordType.DOCUMENT,
          title = document.title.ifBlank { "Medical document" },
          subtitle = "${category.label} · stored at your clinic",
          dateIso = dateIso,
          displayDate = displayDate,
          doctorOrLab = if (document.source == "PATIENT_APP") "Uploaded by you" else "Your clinic",
          summary = "Held in your clinic record. No automated text extraction was performed."
        )
      }
      applied++
    }

    if (applied > 0) {
      _documents.value = documents
      store.write(KEY_DOCUMENTS, documentSerializer, documents)
      _timelineRecords.value = records
      store.write(KEY_RECORDS, recordSerializer, records)
    }

    return applied
  }

  /** "2.1 MB" — the same shape the upload screen already shows. */
  private fun sizeTextOf(bytes: Long): String = when {
    bytes <= 0 -> "—"
    bytes < 1024 -> "$bytes B"
    bytes < 1024 * 1024 -> "${bytes / 1024} KB"
    else -> String.format(java.util.Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))
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

  override fun importEhrRecords(records: List<HealthRecordItem>): Int {
    if (records.isEmpty()) return 0
    val current = _timelineRecords.value.toMutableList()
    var applied = 0

    records.forEach { record ->
      // Avoid duplicates by ID or title + date
      if (current.none { it.id == record.id || (it.title == record.title && it.displayDate == record.displayDate) }) {
        current.add(0, record)
        applied++
      }
    }

    if (applied > 0) {
      _timelineRecords.value = current
      store.write(KEY_RECORDS, recordSerializer, current)
    }

    return applied
  }

  private companion object {
    const val KEY_RECORDS = "records:timeline"
    const val KEY_DOCUMENTS = "records:documents"
    const val KEY_ACTIVE_PRESCRIPTION = "records:active_prescription"
    const val KEY_LABS = "records:lab_results"
  }
}
