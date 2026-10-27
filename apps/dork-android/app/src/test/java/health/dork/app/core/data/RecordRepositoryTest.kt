package health.dork.app.core.data

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.DocumentCategory
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.repository.DorkRecordRepository
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Uploading a document stores the patient's original file reference. This
 * build has no OCR engine, so the repository must never claim to have read or
 * classified the contents.
 */
class RecordRepositoryTest {

  @Test
  fun uploadStoresAnHonestReferenceWithoutClaimingOcr() = runTest {
    val repo = DorkRecordRepository(DorkStore())

    val result = repo.uploadDocument(
      title = "Knee MRI",
      category = DocumentCategory.IMAGING_REPORT,
      fileUri = "content://com.android.providers.media.documents/document/123",
      fileSizeText = "2.1 MB PDF"
    )

    assertTrue(result.isSuccess)
    val doc = result.getOrThrow()
    assertEquals("Knee MRI", doc.title)
    assertEquals(DocumentCategory.IMAGING_REPORT, doc.category)
    assertEquals("2.1 MB PDF", doc.fileSizeText)
    assertFalse(doc.isOcrProcessed)
    assertNull(doc.extractedText)
    assertTrue(doc.structuredEntities.isEmpty())

    // It also lands in the timeline with an honest summary.
    val timeline = repo.timelineRecords.first()
    val record = timeline.first { it.title == "Knee MRI" }
    assertEquals(HealthRecordType.DOCUMENT, record.type)
    assertTrue(record.summary.contains("No automated text extraction"))
  }

  @Test
  fun uploadWithoutAFileIsRejected() = runTest {
    val repo = DorkRecordRepository(DorkStore())
    val before = repo.documents.first().size

    val result = repo.uploadDocument(
      title = "Empty",
      category = DocumentCategory.OTHER,
      fileUri = "   ",
      fileSizeText = ""
    )

    assertTrue(result.isFailure)
    assertEquals(before, repo.documents.first().size)
  }

  @Test
  fun uploadedDocumentsPersistAcrossRepositoryRecreation() = runTest {
    val store = DorkStore()
    DorkRecordRepository(store).uploadDocument(
      title = "Blood panel",
      category = DocumentCategory.LAB_REPORT,
      fileUri = "content://docs/blood.pdf",
      fileSizeText = "900 KB PDF"
    )

    val reopened = DorkRecordRepository(store)
    assertTrue(reopened.documents.first().any { it.title == "Blood panel" })
  }
}
