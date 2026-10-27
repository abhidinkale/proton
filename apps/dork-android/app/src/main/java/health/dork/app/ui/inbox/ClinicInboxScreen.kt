package health.dork.app.ui.inbox

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MarkEmailRead
import androidx.compose.material.icons.rounded.MedicalServices
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.ClinicMessage
import health.dork.app.core.data.repository.ClinicInboxRepository
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkEmptyState
import health.dork.app.core.designsystem.components.DorkTopBar
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val MESSAGE_TIME: DateTimeFormatter =
  DateTimeFormatter.ofPattern("MMM d · h:mm a", Locale.getDefault())

/**
 * Messages a clinician actually sent, pulled from the clinic's database.
 *
 * This is deliberately not the device-local doctor chat: every card here has a
 * server id and an author, and the same row was written by a person in the
 * clinic console.
 */
@Composable
fun ClinicInboxScreen(
  inboxRepository: ClinicInboxRepository,
  onBackClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val messages by inboxRepository.messages.collectAsState()

  // Opening the inbox is the read receipt. Nothing is sent back to the clinic;
  // the badge is local state only.
  LaunchedEffect(messages.size) {
    inboxRepository.markAllRead()
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "From your clinic",
      subtitle = "Replies from your care team",
      onBackClick = onBackClick
    )

    Surface(color = DorkTheme.colors.surfaceSecondary, modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.padding(horizontal = DorkSpacing.m, vertical = DorkSpacing.xs),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Icon(
          imageVector = Icons.Rounded.MedicalServices,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(DorkSpacing.xs))
        Text(
          text = "Messages update automatically while this app is open and connected to your clinic.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    }

    if (messages.isEmpty()) {
      Column(
        modifier = Modifier
          .fillMaxSize()
          .padding(DorkSpacing.l),
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        Spacer(modifier = Modifier.height(DorkSpacing.xxl))
        DorkEmptyState(
          title = "No messages yet",
          description = "When your clinic replies to a check-in or a question, it appears here.",
          icon = Icons.Rounded.MarkEmailRead
        )
      }
    } else {
      LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(DorkSpacing.screenHorizontalPadding),
        verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
      ) {
        items(messages, key = { it.id }) { message ->
          ClinicMessageCard(message)
        }
      }
    }
  }
}

@Composable
private fun ClinicMessageCard(message: ClinicMessage) {
  DorkCard(contentPadding = DorkSpacing.m) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = message.authorName,
          style = MaterialTheme.typography.titleSmall,
          color = DorkTheme.colors.textPrimary,
          modifier = Modifier.weight(1f),
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        Text(
          text = formatMessageTime(message.createdAtIso),
          style = MaterialTheme.typography.labelSmall,
          color = DorkTheme.colors.textTertiary
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xxs))
      Text(
        text = message.body,
        style = MaterialTheme.typography.bodyMedium,
        color = DorkTheme.colors.textPrimary
      )

      if (message.kind == "CLINIC_REPLY" && message.appointmentId != null) {
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        Text(
          text = "About your appointment",
          style = MaterialTheme.typography.labelSmall,
          color = DorkTheme.colors.textTertiary
        )
      }
    }
  }
}

/** Falls back to the raw date rather than hiding an unparsable timestamp. */
private fun formatMessageTime(iso: String): String {
  if (iso.isBlank()) return ""
  return runCatching {
    Instant.parse(iso).atZone(ZoneId.systemDefault()).format(MESSAGE_TIME)
  }.getOrElse {
    runCatching {
      java.time.OffsetDateTime.parse(iso)
        .atZoneSameInstant(ZoneId.systemDefault())
        .format(MESSAGE_TIME)
    }.getOrDefault(iso.take(10))
  }
}
