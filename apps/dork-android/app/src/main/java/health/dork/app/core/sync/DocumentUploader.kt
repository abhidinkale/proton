package health.dork.app.core.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Sending a patient's own document to the clinic.
 *
 * Documents do not travel through the JSON outbox, because the outbox stores a
 * small payload string per row and a scan is up to 15 MB. They are sent
 * directly, and a failure is not silent: the file stays on the device and the
 * document records that it has not reached the clinic yet.
 */
data class DocumentUploadRequest(
  val bytes: ByteArray,
  val fileName: String,
  val mimeType: String,
  val title: String,
  val category: String,
  /** The device's own id. The server derives its row id from it, so a retry cannot duplicate. */
  val localDocumentId: String
) {
  // ByteArray has identity equality; the data class is only used as a value.
  override fun equals(other: Any?): Boolean = this === other
  override fun hashCode(): Int = System.identityHashCode(this)
}

sealed interface DocumentUploadResult {
  data class Success(val remoteId: String?) : DocumentUploadResult

  /** No clinic session on this phone — the document is local only. */
  data object NotSignedIn : DocumentUploadResult

  data class Failed(val message: String, val retryable: Boolean) : DocumentUploadResult
}

interface DocumentUploader {
  suspend fun upload(request: DocumentUploadRequest): DocumentUploadResult
}

class OkHttpDocumentUploader(
  private val settings: SyncSettings,
  private val client: OkHttpClient = SyncHttp.defaultClient(),
  private val json: Json = SyncHttp.defaultJson()
) : DocumentUploader {

  override suspend fun upload(request: DocumentUploadRequest): DocumentUploadResult =
    withContext(Dispatchers.IO) {
      // `enabled` is the patient's own switch. Uploading a document because
      // sync happened to be on is not consent to send a clinical file.
      if (!settings.enabled.value) return@withContext DocumentUploadResult.NotSignedIn
      val session = settings.session.value ?: return@withContext DocumentUploadResult.NotSignedIn
      val baseUrl = settings.baseUrl.value
      if (baseUrl.isBlank()) return@withContext DocumentUploadResult.NotSignedIn

      val body = MultipartBody.Builder()
        .setType(MultipartBody.FORM)
        .addFormDataPart(
          "file",
          request.fileName,
          request.bytes.toRequestBody(request.mimeType.toMediaType())
        )
        .addFormDataPart("title", request.title)
        .addFormDataPart("category", request.category)
        .addFormDataPart("localDocumentId", request.localDocumentId)
        .build()

      val httpRequest = Request.Builder()
        .url(SyncApiContract.url(baseUrl, DOCUMENTS_PATH))
        .post(body)
        .header("Accept", "application/json")
        .header("Authorization", "Bearer ${session.token}")
        // Stable across retries of the same document.
        .header(SyncApiContract.HEADER_IDEMPOTENCY, request.localDocumentId)
        .build()

      runCatching {
        client.newCall(httpRequest).execute().use { response ->
          response.code to response.body?.string().orEmpty()
        }
      }.fold(
        onSuccess = { (code, text) -> classify(code, text) },
        onFailure = {
          DocumentUploadResult.Failed(
            "Saved on this phone. It will send when you're back online.",
            retryable = true
          )
        }
      )
    }

  private fun classify(code: Int, text: String): DocumentUploadResult = when {
    code in 200..299 -> DocumentUploadResult.Success(remoteIdOf(text))
    code == 401 -> DocumentUploadResult.NotSignedIn
    code == 413 -> DocumentUploadResult.Failed(
      "That file is too large to send (15 MB limit).",
      retryable = false
    )
    code == 415 -> DocumentUploadResult.Failed(
      "Only PDF and image files can be sent.",
      retryable = false
    )
    HttpRetryPolicy.classify(code) == HttpOutcomeClass.RETRY -> DocumentUploadResult.Failed(
      "The clinic server is busy. The document will send later.",
      retryable = true
    )
    else -> DocumentUploadResult.Failed(
      "The clinic could not store this document (HTTP $code).",
      retryable = false
    )
  }

  /**
   * Reads the server id out of the response without failing the upload when the
   * body is unreadable: the file is already stored, and the next pull will
   * reconcile it.
   */
  private fun remoteIdOf(text: String): String? = runCatching {
    json.decodeFromString<DocumentUploadResponse>(text).document?.id
  }.getOrNull()

  @Serializable
  private data class DocumentUploadResponse(val document: DocumentResponseBody? = null)

  @Serializable
  private data class DocumentResponseBody(val id: String? = null)

  private companion object {
    const val DOCUMENTS_PATH = "api/patient/sync/documents"
  }
}
