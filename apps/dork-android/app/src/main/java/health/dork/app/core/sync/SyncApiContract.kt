package health.dork.app.core.sync

/**
 * The complete HTTP contract for sync.
 *
 * Keeping paths and the retry classification in one file is deliberate: if the
 * server team renames a route, this is the only place that changes.
 */
object SyncApiContract {

  const val HEADER_IDEMPOTENCY = "Idempotency-Key"
  const val HEADER_PATIENT = "X-Patient-Id"
  const val HEADER_TENANT = "X-Tenant-Id"

  const val RESOLVE_CLINIC_PATH = "api/patient/auth/resolve-clinic"
  const val REQUEST_OTP_PATH = "api/patient/auth/request-otp"
  const val VERIFY_OTP_PATH = "api/patient/auth/verify-otp"
  const val REFRESH_PATH = "api/patient/auth/refresh"
  const val PULL_PATH = "api/patient/sync/pull"

  /** Collection endpoints: the body carries the local id, the header carries idempotency. */
  fun outboxPath(kind: OutboxKind): String = when (kind) {
    OutboxKind.BOOKING -> "api/patient/sync/bookings"
    OutboxKind.INTAKE -> "api/patient/sync/intakes"
    OutboxKind.FOLLOW_UP -> "api/patient/sync/follow-ups"
    OutboxKind.REFILL -> "api/patient/sync/refills"
    OutboxKind.CANCEL -> "api/patient/sync/cancellations"
    OutboxKind.RESCHEDULE -> "api/patient/sync/reschedules"
  }

  fun url(baseUrl: String, path: String): String =
    baseUrl.trimEnd('/') + "/" + path.trimStart('/')
}

/** Result classification shared by every clinic request. */
enum class HttpOutcomeClass {
  SUCCESS,
  UNAUTHORIZED,
  RETRY,
  PERMANENT
}

object HttpRetryPolicy {

  /**
   * 5xx, 408 (request timeout), 429 (rate limit) and transport failures are
   * transient. Other 4xx responses will never succeed by repeating the same
   * request, so they become permanently failed rows the patient can see.
   */
  fun classify(statusCode: Int): HttpOutcomeClass = when {
    statusCode in 200..299 -> HttpOutcomeClass.SUCCESS
    statusCode == 401 -> HttpOutcomeClass.UNAUTHORIZED
    statusCode == 408 || statusCode == 429 -> HttpOutcomeClass.RETRY
    statusCode in 500..599 -> HttpOutcomeClass.RETRY
    statusCode in 400..499 -> HttpOutcomeClass.PERMANENT
    else -> HttpOutcomeClass.RETRY
  }
}
