package health.dork.app.ui.clinic

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar
import health.dork.app.core.util.shareText
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Linking a clinic, and the honest log of everything the patient has handed over.
 *
 * The code is a real, universal integration: any clinic can write six characters
 * on a card. It costs the clinic nothing and needs no software, which is why this
 * works on day one anywhere in the world.
 */
@Composable
fun ClinicLinkScreen(
  viewModel: ClinicViewModel,
  onBackClick: () -> Unit,
  onShareSummary: () -> Unit,
  onOpenSync: () -> Unit,
  modifier: Modifier = Modifier
) {
  val state by viewModel.uiState.collectAsState()
  val context = LocalContext.current

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Your clinic",
      subtitle = state.link?.clinicName ?: "Not linked yet",
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      if (state.link == null) {
        Text(
          text = "Link the clinic that looks after you",
          style = MaterialTheme.typography.headlineSmall,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        Text(
          text = "Ask reception for your six-character clinic code. Linking lets Proton address everything you send and keeps a record of what you handed over.",
          style = MaterialTheme.typography.bodyMedium,
          color = DorkTheme.colors.textSecondary
        )

        Spacer(modifier = Modifier.height(DorkSpacing.l))

        DorkTextField(
          value = state.clinicName,
          onValueChange = viewModel::onClinicNameChange,
          placeholder = "Clinic name"
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        DorkTextField(
          value = state.clinicPhone,
          onValueChange = viewModel::onClinicPhoneChange,
          placeholder = "Clinic phone (for urgent calls)"
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        DorkTextField(
          value = state.clinicianName,
          onValueChange = viewModel::onClinicianNameChange,
          placeholder = "Main clinician (optional)"
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        DorkTextField(
          value = state.linkCode,
          onValueChange = viewModel::onCodeChange,
          placeholder = "Clinic code · e.g. 4K9P2M"
        )

        state.error?.let {
          Spacer(modifier = Modifier.height(DorkSpacing.s))
          Text(text = it, style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.critical)
        }

        Spacer(modifier = Modifier.height(DorkSpacing.l))
        DorkButton(text = "Link clinic", onClick = viewModel::link)

        Spacer(modifier = Modifier.height(DorkSpacing.s))
        Text(
          text = "The code stays on this device. It is a label, not a password, and it does not give the clinic access to your phone.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textTertiary
        )
      } else {
        val link = state.link!!
        DorkCard(contentPadding = DorkSpacing.l) {
          Column {
            Text(
              text = link.clinicName,
              style = MaterialTheme.typography.headlineMedium,
              color = DorkTheme.colors.textPrimary
            )
            link.clinicianName?.let {
              Text(
                text = it,
                style = MaterialTheme.typography.bodyMedium,
                color = DorkTheme.colors.textSecondary
              )
            }
            Spacer(modifier = Modifier.height(DorkSpacing.xs))
            Text(
              text = "Code ${link.linkCode} · linked ${formatDate(link.linkedAtIso)}",
              style = MaterialTheme.typography.labelSmall,
              color = DorkTheme.colors.textTertiary
            )
          }
        }

        Spacer(modifier = Modifier.height(DorkSpacing.l))
        Text(
          text = "Hand over your record",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xxs))
        Text(
          text = "One plain-text summary: appointments, medications, today's adherence, your latest intake and check-in, and any open refills. The clinic can read it on any screen.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        DorkButton(text = "Preview and send", onClick = onShareSummary)

        Spacer(modifier = Modifier.height(DorkSpacing.l))
        Text(
          text = "What you have handed over",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))

        if (state.shareLog.isEmpty()) {
          Text(
            text = "Nothing yet. Everything stays on this phone until you send it.",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textTertiary
          )
        } else {
          state.shareLog.take(6).forEach { event ->
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
              Text(
                text = event.packetKind,
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textPrimary,
                modifier = Modifier.weight(1f)
              )
              Text(
                text = "${event.channel} · ${formatDate(event.sharedAtIso)}",
                style = MaterialTheme.typography.labelSmall,
                color = DorkTheme.colors.textTertiary
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(DorkSpacing.l))
        DorkButton(
          text = "Unlink clinic",
          onClick = viewModel::unlink,
          variant = DorkButtonVariant.Ghost
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      DorkCard(contentPadding = DorkSpacing.l) {
        Column {
          Text(
            text = "Automatic sync",
            style = MaterialTheme.typography.titleMedium,
            color = DorkTheme.colors.textPrimary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.xxs))
          Text(
            text = "Off by default. When it is on, the bookings, intake answers, " +
              "follow-up answers and refill requests you already make are also sent " +
              "to your clinic's server, so you do not have to hand them over by hand. " +
              "Nothing else leaves this phone.",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.s))
          DorkButton(
            text = "Set up sync",
            onClick = onOpenSync,
            variant = DorkButtonVariant.Ghost
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

private fun formatDate(iso: String): String =
  runCatching {
    LocalDateTime.parse(iso).format(DateTimeFormatter.ofPattern("d MMM, h:mm a", Locale.US))
  }.getOrDefault(iso.take(10))
