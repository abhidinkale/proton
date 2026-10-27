package health.dork.app.core.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast

/**
 * The only way a care record leaves this device without a server: the patient
 * picks the app themselves.
 *
 * Used for the visit packet, intake, follow-up and refill hand-offs. Returns true
 * when a share target was opened, so callers can record an honest "shared"
 * timestamp instead of optimistically assuming delivery.
 */
fun shareText(context: Context, subject: String, body: String): Boolean {
  val intent = Intent(Intent.ACTION_SEND).apply {
    type = "text/plain"
    putExtra(Intent.EXTRA_SUBJECT, subject)
    putExtra(Intent.EXTRA_TEXT, body)
  }
  val chooser = Intent.createChooser(intent, subject).apply {
    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  }
  return runCatching {
    context.startActivity(chooser)
    true
  }.getOrElse {
    Toast.makeText(context, "No app available to share this.", Toast.LENGTH_SHORT).show()
    false
  }
}

fun copyToClipboard(context: Context, label: String, body: String) {
  val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
  clipboard?.setPrimaryClip(ClipData.newPlainText(label, body))
  Toast.makeText(context, "Copied", Toast.LENGTH_SHORT).show()
}

fun dialNumber(context: Context, phone: String) {
  val cleaned = phone.filter { it.isDigit() || it == '+' }
  if (cleaned.isBlank()) {
    Toast.makeText(context, "No phone number saved.", Toast.LENGTH_SHORT).show()
    return
  }
  runCatching {
    context.startActivity(
      Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:$cleaned"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
  }.onFailure {
    Toast.makeText(context, "No dialer available.", Toast.LENGTH_SHORT).show()
  }
}
