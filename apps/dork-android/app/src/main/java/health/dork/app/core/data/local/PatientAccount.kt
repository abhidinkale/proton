package health.dork.app.core.data.local

import kotlinx.serialization.Serializable
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * A locally registered patient account.
 *
 * Passwords are never stored in plain text or in the session file. Only a
 * PBKDF2-HMAC-SHA256 verifier plus a random per-account salt is persisted.
 * This is device-local authentication, not a replacement for a clinic identity
 * provider; the UI says so explicitly.
 */
@Serializable
data class PatientAccount(
  val email: String,
  val saltBase64: String,
  val verifierBase64: String,
  val iterations: Int,
  val patientId: String,
  val createdAtEpochMs: Long
)

object PasswordHasher {
  private const val ITERATIONS = 120_000
  private const val KEY_LENGTH_BITS = 256
  private const val SALT_BYTES = 16

  fun createVerifier(password: String): Pair<String, String> {
    val salt = ByteArray(SALT_BYTES).also { SecureRandom().nextBytes(it) }
    val verifier = derive(password, salt, ITERATIONS)
    return Base64.getEncoder().encodeToString(salt) to Base64.getEncoder().encodeToString(verifier)
  }

  fun matches(password: String, account: PatientAccount): Boolean {
    val salt = runCatching { Base64.getDecoder().decode(account.saltBase64) }.getOrNull() ?: return false
    val expected = runCatching { Base64.getDecoder().decode(account.verifierBase64) }.getOrNull() ?: return false
    val actual = derive(password, salt, account.iterations)
    return MessageDigest.isEqual(expected, actual)
  }

  private fun derive(password: String, salt: ByteArray, iterations: Int): ByteArray {
    val spec = PBEKeySpec(password.toCharArray(), salt, iterations, KEY_LENGTH_BITS)
    return try {
      SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
    } finally {
      spec.clearPassword()
    }
  }
}
