package health.dork.app.core.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

/**
 * The clinic identity handshake, isolated behind one interface.
 *
 * Contract:
 *  - POST /api/patient/auth/resolve-clinic {"clinicCode":"ABC123"}
 *       200 -> {"clinic":{"name","brandColor"}}
 *  - POST /api/patient/auth/request-otp  {"identifier","clinicCode"?}
 *       502 {"code":"OTP_DELIVERY_FAILED"} -> the server could not send the
 *       code; its `error` text is patient-readable and shown as-is.
 *  - POST /api/patient/auth/verify-otp   {"identifier","code","clinicCode"?}
 *       200 -> {"token","patientId","tenantId","expiresAt"}
 *  - POST /api/patient/auth/refresh      Authorization: Bearer <token>
 *       {"patientId","tenantId"} -> same body as verify
 *
 * The clinic code is what selects the tenant server-side. The app never sends a
 * `tenantId` on login: if it did, a patient could ask to join any clinic.
 *
 * If the server team changes any of that, only this file and its test move.
 */
interface AuthClient {
  /** Confirms a clinic code and returns the clinic's display name. */
  suspend fun resolveClinic(baseUrl: String, clinicCode: String): Result<ClinicInfo>

  suspend fun requestOtp(
    baseUrl: String,
    identifier: String,
    clinicCode: String? = null
  ): Result<OtpDispatch>

  suspend fun verifyOtp(
    baseUrl: String,
    identifier: String,
    code: String,
    clinicCode: String? = null
  ): Result<PatientSession>

  suspend fun refresh(baseUrl: String, session: PatientSession): Result<PatientSession>
}

/** Public, non-sensitive clinic identity used to confirm the code. */
@Serializable
data class ClinicInfo(
  val name: String = "",
  val brandColor: String? = null,
  val countryCode: String? = null
)

/**
 * What the server did with the code.
 *
 * `delivery` is the server's own answer: `"email"` means a provider accepted the
 * message, `"simulated"` means nothing was sent. The app must not claim "code
 * sent" in the simulated case — a patient would wait for an email that never
 * arrives.
 */
@Serializable
data class OtpDispatch(
  val delivery: String = "simulated",
  val maskedIdentifier: String = "",
  /**
   * Present only when the server is in synthetic mode and deliberately returns
   * the code instead of sending it. Never populated by the email provider path.
   */
  val devCode: String? = null
)

class OkHttpAuthClient(
  private val client: OkHttpClient = SyncHttp.defaultClient(),
  private val json: Json = SyncHttp.defaultJson()
) : AuthClient {

  override suspend fun resolveClinic(
    baseUrl: String,
    clinicCode: String
  ): Result<ClinicInfo> = withContext(Dispatchers.IO) {
    val body = json.encodeToString(ResolveClinicRequest(clinicCode.trim().uppercase()))
    val request = Request.Builder()
      .url(SyncApiContract.url(baseUrl, SyncApiContract.RESOLVE_CLINIC_PATH))
      .post(body.toRequestBody(JSON_MEDIA_TYPE))
      .header("Accept", "application/json")
      .build()

    runCatching {
      client.newCall(request).execute().use { response ->
        val raw = response.body?.string().orEmpty()
        if (response.code !in 200..299) {
          throw IOException(
            serverMessage(
              raw,
              fallback = when (response.code) {
                400 -> "That clinic code was not recognised. Check it with your clinic."
                429 -> "Too many attempts. Wait a few minutes and try again."
                else -> "Could not confirm the clinic code (HTTP ${response.code})."
              }
            )
          )
        }
        val parsed = runCatching { json.decodeFromString<ResolveClinicResponse>(raw) }.getOrNull()
          ?: throw IOException("The clinic server sent an unexpected response.")
        if (parsed.clinic.name.isBlank()) {
          throw IOException("The clinic server sent an incomplete response.")
        }
        parsed.clinic
      }
    }
  }

  override suspend fun requestOtp(
    baseUrl: String,
    identifier: String,
    clinicCode: String?
  ): Result<OtpDispatch> =
    withContext(Dispatchers.IO) {
      val body = json.encodeToString(
        RequestOtpRequest(
          identifier = identifier.trim(),
          clinicCode = clinicCode?.trim()?.uppercase()?.takeIf { it.isNotEmpty() }
        )
      )
      val request = Request.Builder()
        .url(SyncApiContract.url(baseUrl, SyncApiContract.REQUEST_OTP_PATH))
        .post(body.toRequestBody(JSON_MEDIA_TYPE))
        .header("Accept", "application/json")
        .build()

      runCatching {
        client.newCall(request).execute().use { response ->
          val raw = response.body?.string().orEmpty()
          if (response.code !in 200..299) {
            throw IOException(
              serverMessage(
                raw,
                fallback = if (response.code == 429) {
                  "Too many attempts. Wait a few minutes and try again."
                } else {
                  "Could not send a code (HTTP ${response.code})."
                }
              )
            )
          }
          runCatching { json.decodeFromString<OtpDispatch>(raw) }.getOrNull() ?: OtpDispatch()
        }
      }
    }

  override suspend fun verifyOtp(
    baseUrl: String,
    identifier: String,
    code: String,
    clinicCode: String?
  ): Result<PatientSession> = withContext(Dispatchers.IO) {
    val body = json.encodeToString(
      VerifyOtpRequest(
        identifier = identifier.trim(),
        code = code.trim(),
        clinicCode = clinicCode?.trim()?.uppercase()?.takeIf { it.isNotEmpty() }
      )
    )
    val request = Request.Builder()
      .url(SyncApiContract.url(baseUrl, SyncApiContract.VERIFY_OTP_PATH))
      .post(body.toRequestBody(JSON_MEDIA_TYPE))
      .header("Accept", "application/json")
      .build()

    runCatching {
      client.newCall(request).execute().use { response ->
        val raw = response.body?.string().orEmpty()
        if (response.code !in 200..299) {
          throw IOException(
            serverMessage(
              raw,
              fallback = when (response.code) {
                429 -> "Too many attempts. Wait a few minutes and try again."
                401, 400 -> "That code was not accepted."
                else -> "Could not verify the code (HTTP ${response.code})."
              }
            )
          )
        }
        val parsed = runCatching { json.decodeFromString<SessionResponse>(raw) }.getOrNull()
          ?: throw IOException("The clinic server sent an unexpected response.")
        parsed.toSession()
      }
    }
  }

  override suspend fun refresh(
    baseUrl: String,
    session: PatientSession
  ): Result<PatientSession> = withContext(Dispatchers.IO) {
    val body = json.encodeToString(
      RefreshRequest(patientId = session.patientId, tenantId = session.tenantId)
    )
    val request = Request.Builder()
      .url(SyncApiContract.url(baseUrl, SyncApiContract.REFRESH_PATH))
      .post(body.toRequestBody(JSON_MEDIA_TYPE))
      .header("Authorization", "Bearer ${session.token}")
      .header(SyncApiContract.HEADER_PATIENT, session.patientId)
      .header(SyncApiContract.HEADER_TENANT, session.tenantId)
      .header("Accept", "application/json")
      .build()

    runCatching {
      client.newCall(request).execute().use { response ->
        if (response.code !in 200..299) {
          throw IOException("Could not refresh the session (HTTP ${response.code}).")
        }
        val raw = response.body?.string().orEmpty()
        val parsed = runCatching { json.decodeFromString<SessionResponse>(raw) }.getOrNull()
          ?: throw IOException("The clinic server sent an unexpected response.")
        parsed.toSession()
      }
    }
  }

  private fun SessionResponse.toSession(): PatientSession {
    if (token.isBlank() || patientId.isBlank() || tenantId.isBlank() || expiresAt.isBlank()) {
      throw IOException("The clinic server sent an incomplete session.")
    }
    return PatientSession(
      token = token,
      patientId = patientId,
      tenantId = tenantId,
      expiresAt = expiresAt
    )
  }

  /**
   * The server already writes patient-readable errors ("That clinic code is
   * not recognised", "We couldn't send your sign-in code…"). Showing those
   * instead of "HTTP 502" is the difference between a patient retrying and a
   * patient giving up. Anything unexpected falls back to a local string, and
   * the message is length-capped so a stray payload cannot flood the UI.
   */
  private fun serverMessage(raw: String, fallback: String): String {
    val parsed = runCatching { json.decodeFromString<ApiError>(raw) }.getOrNull()
    val message = parsed?.error?.trim().orEmpty()
    return if (message.isNotEmpty() && message.length <= 200) message else fallback
  }

  private companion object {
    val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
  }
}

@Serializable
private data class ResolveClinicRequest(val clinicCode: String)

@Serializable
private data class ResolveClinicResponse(val clinic: ClinicInfo = ClinicInfo())

@Serializable
private data class RequestOtpRequest(val identifier: String, val clinicCode: String? = null)

@Serializable
private data class VerifyOtpRequest(
  val identifier: String,
  val code: String,
  val clinicCode: String? = null
)

@Serializable
private data class RefreshRequest(val patientId: String, val tenantId: String)

@Serializable
private data class ApiError(val error: String? = null, val code: String? = null)

@Serializable
private data class SessionResponse(
  val token: String = "",
  val patientId: String = "",
  val tenantId: String = "",
  val expiresAt: String = ""
)

/** Shared OkHttp/Json construction so both clients behave identically. */
object SyncHttp {
  fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
    .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
    .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
    .build()

  fun defaultJson(): Json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    encodeDefaults = true
  }
}
