package health.dork.app.core.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType

/** What happened to one outbox attempt. */
sealed interface SyncSendOutcome {
  data object Success : SyncSendOutcome
  data object Unauthorized : SyncSendOutcome
  data class Retryable(val message: String) : SyncSendOutcome
  data class Permanent(val message: String) : SyncSendOutcome
}

/** What happened to a pull attempt. */
sealed interface SyncPullOutcome {
  data class Success(val data: SyncPullResponse) : SyncPullOutcome
  data object Unauthorized : SyncPullOutcome
  data class Failure(val retryable: Boolean, val message: String) : SyncPullOutcome
}

/**
 * The wire layer for the outbox and pull. It never logs a request or response
 * body: both can contain clinical detail.
 */
interface SyncClient {
  suspend fun send(baseUrl: String, session: PatientSession, entry: OutboxEntry): SyncSendOutcome
  suspend fun pull(baseUrl: String, session: PatientSession): SyncPullOutcome
}

class OkHttpSyncClient(
  private val client: OkHttpClient = SyncHttp.defaultClient(),
  private val json: Json = SyncHttp.defaultJson()
) : SyncClient {

  override suspend fun send(
    baseUrl: String,
    session: PatientSession,
    entry: OutboxEntry
  ): SyncSendOutcome = withContext(Dispatchers.IO) {
    val request = Request.Builder()
      .url(SyncApiContract.url(baseUrl, SyncApiContract.outboxPath(entry.kind)))
      .post(entry.payloadJson.toRequestBody(JSON_MEDIA_TYPE))
      .header("Accept", "application/json")
      .header("Authorization", "Bearer ${session.token}")
      .header(SyncApiContract.HEADER_PATIENT, session.patientId)
      .header(SyncApiContract.HEADER_TENANT, session.tenantId)
      // Stable for the life of the row: a retry is the same logical request.
      .header(SyncApiContract.HEADER_IDEMPOTENCY, entry.id)
      .build()

    runCatching {
      client.newCall(request).execute().use { response -> response.code }
    }.fold(
      onSuccess = { code ->
        when (HttpRetryPolicy.classify(code)) {
          HttpOutcomeClass.SUCCESS -> SyncSendOutcome.Success
          HttpOutcomeClass.UNAUTHORIZED -> SyncSendOutcome.Unauthorized
          HttpOutcomeClass.RETRY -> SyncSendOutcome.Retryable("The clinic server is busy (HTTP $code).")
          HttpOutcomeClass.PERMANENT -> SyncSendOutcome.Permanent("The clinic rejected this item (HTTP $code).")
        }
      },
      onFailure = {
        SyncSendOutcome.Retryable("No connection to the clinic. Will retry.")
      }
    )
  }

  override suspend fun pull(
    baseUrl: String,
    session: PatientSession
  ): SyncPullOutcome = withContext(Dispatchers.IO) {
    val request = Request.Builder()
      .url(SyncApiContract.url(baseUrl, SyncApiContract.PULL_PATH))
      .get()
      .header("Accept", "application/json")
      .header("Authorization", "Bearer ${session.token}")
      .header(SyncApiContract.HEADER_PATIENT, session.patientId)
      .header(SyncApiContract.HEADER_TENANT, session.tenantId)
      .build()

    runCatching {
      client.newCall(request).execute().use { response ->
        if (response.code !in 200..299) {
          return@use null to response.code
        }
        val raw = response.body?.string().orEmpty()
        json.decodeFromString<SyncPullResponse>(raw) to response.code
      }
    }.fold(
      onSuccess = { (parsed, code) ->
        when {
          parsed != null -> SyncPullOutcome.Success(parsed)
          code == 401 -> SyncPullOutcome.Unauthorized
          HttpRetryPolicy.classify(code) == HttpOutcomeClass.RETRY ->
            SyncPullOutcome.Failure(retryable = true, message = "Could not reach the clinic (HTTP $code).")
          else ->
            SyncPullOutcome.Failure(retryable = false, message = "The clinic could not return your record (HTTP $code).")
        }
      },
      onFailure = {
        SyncPullOutcome.Failure(
          retryable = true,
          message = "No connection to the clinic. Your device record is unchanged."
        )
      }
    )
  }

  private companion object {
    val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
  }
}
