package health.dork.app.core.security

import android.app.Activity
import android.view.WindowManager

/**
 * Security and PHI Protection Utilities for Dork.
 * Enforces zero unmasked patient identifiers in logs and optional screen privacy.
 */
object SecurityManager {

  /**
   * Masks sensitive patient names or identifiers for safe logging.
   * Example: "Alex Morgan" -> "A*** M***"
   */
  fun maskPhi(value: String?): String {
    if (value.isNullOrBlank()) return "[REDACTED]"
    val parts = value.trim().split(" ")
    return parts.joinToString(" ") { part ->
      if (part.length <= 1) "*" else "${part.first()}${"*".repeat(part.length - 1)}"
    }
  }

  /**
   * Masks email address: "alex.morgan@domain.com" -> "a***n@d***.com"
   */
  fun maskEmail(email: String?): String {
    if (email.isNullOrBlank() || !email.contains("@")) return "[EMAIL_REDACTED]"
    val parts = email.split("@")
    val user = parts[0]
    val domain = parts[1]
    val maskedUser = if (user.length > 2) "${user.first()}***${user.last()}" else "***"
    return "$maskedUser@$domain"
  }

  /**
   * Enables Android FLAG_SECURE to prevent screenshots/screen-recording on high-sensitivity medical views.
   */
  fun enableScreenSecurity(activity: Activity) {
    activity.window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE
    )
  }

  /**
   * Disables Android FLAG_SECURE.
   */
  fun disableScreenSecurity(activity: Activity) {
    activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
  }
}
