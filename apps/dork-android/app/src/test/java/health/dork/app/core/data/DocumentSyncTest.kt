package health.dork.app.core.data

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.DocumentCategory
import health.dork.app.core.data.repository.DorkRecordRepository
import health.dork.app.core.sync.DocumentUploadRequest
import health.dork.app.core.sync.DocumentUploadResult
import health.dork.app.core.sync.DocumentUploader
import health.dork.app.core.sync.RemoteDocument
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The document half of the patient loop.
 *
 * Two rules the app must never break:
 *  - a document is written to the device before any network call, so a failed
 *    upload cannot lose the patient's file;
 *  - the sync state says where the file actually is, because "sent" and
 *    "stored on this phone" are very different promises to a doctor.
 */
class DocumentSyncTest {

  private class FakeUploader(private val outcome: DocumentUploadResult) : DocumentUploader {
    var lastRequest: DocumentUploadRequest? = null

    override suspend fun upload(request: DocumentUploadRequest): DocumentUploadResult {
      lastRequest = request
      return outcome
    }
  }

  private suspend fun uploaded(
    repo: DorkRecordRepository,
    title: String = "Complete blood count"
  ): health.dork.app.core.data.model.HealthDocument = repo.uploadDocument(
    title = title,
    category = DocumentCategory.LAB_REPORT,
    fileUri = "content://provider/document/1",
    fileSizeText = "12 KB PDF",
    bytes = byteArrayOf(1, 2, 3, 4),
    mimeType = "application/pdf",
    fileName = "cbc.pdf"
  ).getOrThrow()

  @Test
  fun aSentDocumentIsMarkedAsHeldByTheClinic() = runTest {
    val uploader = FakeUploader(DocumentUploadResult.Success("doc-remote-1"))
    val repo = DorkRecordRepository(DorkStore(), uploader)

    val doc = repo.uploadDocument(
      title = "Complete blood count",
      category = DocumentCategory.LAB_REPORT,
      fileUri = "content://provider/document/1",
      fileSizeText = "12 KB PDF",
      bytes = byteArrayOf(1, 2, 3, 4),
      mimeType = "application/pdf",
      fileName = "cbc.pdf"
    ).getOrThrow()

    assertEquals("SENT", doc.syncState)
    assertEquals("doc-remote-1", doc.remoteId)
    // The clinic derives its row from the device id, so the request must carry it.
    assertEquals(doc.id, uploader.lastRequest?.localDocumentId)
    assertEquals("LAB_REPORT", uploader.lastRequest?.category)
  }

  @Test
  fun withoutAClinicSessionTheDocumentStaysOnThePhone() = runTest {
    val repo = DorkRecordRepository(DorkStore(), FakeUploader(DocumentUploadResult.NotSignedIn))

    val doc = uploaded(repo)

    assertEquals("LOCAL_ONLY", doc.syncState)
    assertNull(doc.remoteId)
    // The file reference is still there: nothing was lost by not being online.
    assertEquals("content://provider/document/1", doc.originalUri)
  }

  @Test
  fun aRetryableFailureIsRecordedRatherThanHidden() = runTest {
    val repo = DorkRecordRepository(
      DorkStore(),
      FakeUploader(DocumentUploadResult.Failed("No connection", retryable = true))
    )

    val doc = uploaded(repo)

    assertEquals("SENDING", doc.syncState)
    assertEquals(1, repo.documents.first().count { it.id == doc.id })
  }

  @Test
  fun aRefusalIsMarkedAsFailed() = runTest {
    val repo = DorkRecordRepository(
      DorkStore(),
      FakeUploader(DocumentUploadResult.Failed("Only PDF and image files can be sent.", retryable = false))
    )

    val doc = uploaded(repo)

    assertEquals("FAILED", doc.syncState)
  }

  @Test
  fun serverDocumentsReachTheTimelineOnlyOnce() = runTest {
    val repo = DorkRecordRepository(DorkStore())
    val remote = RemoteDocument(
      id = "doc-remote-9",
      title = "Discharge summary",
      category = "DISCHARGE_SUMMARY",
      contentType = "application/pdf",
      byteSize = 2048,
      source = "PATIENT_APP",
      uploadedAt = "2026-10-20T10:00:00.000Z"
    )

    assertEquals(1, repo.mergeServerDocuments(listOf(remote)))

    val doc = repo.documents.first().first { it.id == "doc-remote-9" }
    assertEquals("SENT", doc.syncState)
    // The bytes are at the clinic; there is no local file to open.
    assertTrue(doc.originalUri.isBlank())
    assertEquals("2 KB", doc.fileSizeText)

    val timeline = repo.timelineRecords.first()
    assertNotNull(timeline.find { it.id == "rec-doc-remote-9" })

    // A second pull of the same document must not duplicate either list.
    repo.mergeServerDocuments(listOf(remote))
    assertEquals(1, repo.documents.first().count { it.id == "doc-remote-9" })
    assertEquals(1, repo.timelineRecords.first().count { it.id == "rec-doc-remote-9" })
  }

  @Test
  fun aPullThatOmitsALocalDocumentDoesNotDeleteIt() = runTest {
    val repo = DorkRecordRepository(DorkStore(), FakeUploader(DocumentUploadResult.NotSignedIn))
    val local = uploaded(repo, title = "Knee MRI")

    // An empty pull means "the server has nothing to say", not "delete what
    // the patient kept on their phone".
    assertEquals(0, repo.mergeServerDocuments(emptyList()))
    assertNotNull(repo.documents.first().find { it.id == local.id })
  }
}
