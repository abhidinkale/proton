package health.dork.app.ui.sync

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.CloudSync
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar
import health.dork.app.core.sync.OutboxEntry
import health.dork.app.core.sync.OutboxKind
import health.dork.app.core.sync.SyncPhase
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * The opt-in clinic sync screen.
 *
 * This is deliberately separate from [health.dork.app.ui.clinic.ClinicLinkScreen]:
 * the six-character local link and the paper/phone hand-off log must keep
 * working with no network and no account. Sync is a second, optional layer that
 * only exists once the patient turns it on and verifies a one-time code.
 */
@Composable
fun SyncScreen(
  viewModel: SyncViewModel,
  onBackClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val state by viewModel.uiState.collectAsState()

  SyncContent(
    state = state,
    onBackClick = onBackClick,
    onToggle = viewModel::setEnabled,
    onBaseUrlChange = viewModel::onBaseUrlChange,
    onClinicCodeChange = viewModel::onClinicCodeChange,
    onIdentifierChange = viewModel::onIdentifierChange,
    onOtpChange = viewModel::onOtpChange,
    onConnect = viewModel::connect,
    onResendOtp = viewModel::resendOtp,
    onEditDetails = viewModel::editDetails,
    onVerifyOtp = viewModel::verifyOtp,
    onSyncNow = viewModel::syncNow,
    onRetry = viewModel::retry,
    onDisconnect = viewModel::disconnect,
    modifier = modifier
  )
}

@Composable
fun SyncContent(
  state: SyncUiState,
  onBackClick: () -> Unit,
  onToggle: (Boolean) -> Unit,
  onBaseUrlChange: (String) -> Unit,
  onClinicCodeChange: (String) -> Unit,
  onIdentifierChange: (String) -> Unit,
  onOtpChange: (String) -> Unit,
  onConnect: () -> Unit,
  onResendOtp: () -> Unit,
  onEditDetails: () -> Unit,
  onVerifyOtp: () -> Unit,
  onSyncNow: () -> Unit,
  onRetry: (String) -> Unit,
  onDisconnect: () -> Unit,
  modifier: Modifier = Modifier
) {
  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Clinic sync",
      subtitle = when {
        !state.enabled -> "Off by default"
        state.connected -> "Connected to your clinic"
        else -> "Not connected yet"
      },
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      // ---- the switch and the honest list of what leaves -------------------
      DorkCard(contentPadding = DorkSpacing.l) {
        Column(modifier = Modifier.fillMaxWidth()) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
          ) {
            Row(
              modifier = Modifier.weight(1f),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = if (state.enabled) Icons.Rounded.CloudSync else Icons.Rounded.CloudOff,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp)
              )
              Spacer(modifier = Modifier.width(DorkSpacing.s))
              Column {
                Text(
                  text = "Sync with my clinic",
                  style = MaterialTheme.typography.titleMedium,
                  color = DorkTheme.colors.textPrimary
                )
                Text(
                  text = "Off by default.",
                  style = MaterialTheme.typography.bodySmall,
                  color = DorkTheme.colors.textSecondary
                )
              }
            }
            DorkStatusBadge(
              text = if (state.enabled) "On" else "Off",
              type = if (state.enabled) DorkStatusType.Success else DorkStatusType.Neutral
            )
            Spacer(modifier = Modifier.width(DorkSpacing.xs))
            Switch(
              checked = state.enabled,
              onCheckedChange = onToggle,
              colors = SwitchDefaults.colors(
                checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
                checkedTrackColor = MaterialTheme.colorScheme.primary
              )
            )
          }

          Spacer(modifier = Modifier.height(DorkSpacing.m))

          Text(
            text = "When this is on, these leave this phone and go only to your clinic's server:",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          Text(
            text = "• bookings you make\n• your pre-visit intake answers\n• your follow-up answers\n• your refill requests",
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textPrimary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.s))
          Text(
            text = "Nothing else. No analytics, no advertising identifiers, and no data about anyone but you. Your six-character clinic code keeps working offline, with or without sync.",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textTertiary
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      if (!state.enabled) {
        DorkCard(contentPadding = DorkSpacing.l) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.Rounded.Lock,
              contentDescription = null,
              tint = DorkTheme.colors.textTertiary,
              modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(DorkSpacing.s))
            Text(
              text = "Everything stays on this phone. Turn the switch on when your clinic gives you a server address.",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
        }
        Spacer(modifier = Modifier.height(DorkSpacing.l))
        PendingSummary(state)
      } else {
        if (state.phase == SyncPhase.NEEDS_REAUTH || state.sessionExpired) {
          DorkCard(
            contentPadding = DorkSpacing.l,
            backgroundColor = DorkTheme.colors.warningContainer
          ) {
            Text(
              text = "Your clinic session expired. Sign in again with a new one-time code. Your local records are safe and nothing was deleted.",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.warning
            )
          }
          Spacer(modifier = Modifier.height(DorkSpacing.l))
        }

        when (state.step) {
          SyncStep.SETUP, SyncStep.OTP -> ConnectionCard(
            state = state,
            onBaseUrlChange = onBaseUrlChange,
            onClinicCodeChange = onClinicCodeChange,
            onIdentifierChange = onIdentifierChange,
            onOtpChange = onOtpChange,
            onConnect = onConnect,
            onResendOtp = onResendOtp,
            onEditDetails = onEditDetails,
            onVerifyOtp = onVerifyOtp
          )

          SyncStep.CONNECTED -> StatusCard(
            state = state,
            onSyncNow = onSyncNow,
            onRetry = onRetry,
            onDisconnect = onDisconnect
          )
        }
      }

      state.message?.let {
        Spacer(modifier = Modifier.height(DorkSpacing.m))
        Text(
          text = it,
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.success
        )
      }

      state.error?.let {
        Spacer(modifier = Modifier.height(DorkSpacing.m))
        Text(
          text = it,
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.critical
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

@Composable
private fun ConnectionCard(
  state: SyncUiState,
  onBaseUrlChange: (String) -> Unit,
  onClinicCodeChange: (String) -> Unit,
  onIdentifierChange: (String) -> Unit,
  onOtpChange: (String) -> Unit,
  onConnect: () -> Unit,
  onResendOtp: () -> Unit,
  onEditDetails: () -> Unit,
  onVerifyOtp: () -> Unit
) {
  DorkCard(contentPadding = DorkSpacing.l) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Text(
        text = if (state.step == SyncStep.OTP) "Enter your one-time code" else "Connect to your clinic",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Text(
        text = if (state.step == SyncStep.OTP) {
          "Your clinic sent a code to ${state.identifier.ifBlank { "your contact" }}. It proves this is your record."
        } else {
          "Your clinic gives you these details. The address must be https://."
        },
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textSecondary
      )

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      if (state.step == SyncStep.OTP) {
        DorkTextField(
          value = state.otpCode,
          onValueChange = onOtpChange,
          placeholder = "One-time code",
          helperText = "Usually six digits."
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        DorkButton(
          text = "Verify and connect",
          onClick = onVerifyOtp,
          loading = state.busy,
          enabled = state.otpCode.isNotBlank()
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        DorkButton(
          text = "Send a new code",
          onClick = onResendOtp,
          variant = DorkButtonVariant.Ghost,
          enabled = !state.busy
        )
        DorkButton(
          text = "Change clinic or address",
          onClick = onEditDetails,
          variant = DorkButtonVariant.Ghost,
          enabled = !state.busy
        )
      } else {
        DorkTextField(
          value = state.clinicCode,
          onValueChange = onClinicCodeChange,
          placeholder = "Clinic code · e.g. 4K9P2M",
          helperText = "The same six-character code reception gave you."
        )
        if (state.clinicName.isNotBlank()) {
          Spacer(modifier = Modifier.height(DorkSpacing.s))
          DorkCard(contentPadding = DorkSpacing.m) {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Icon(
                imageVector = Icons.Rounded.CheckCircle,
                contentDescription = null,
                tint = DorkTheme.colors.success,
                modifier = Modifier.size(18.dp)
              )
              Spacer(modifier = Modifier.width(DorkSpacing.s))
              Text(
                text = "Linking to ${state.clinicName}",
                style = MaterialTheme.typography.bodyMedium,
                color = DorkTheme.colors.textPrimary
              )
            }
          }
        }
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        DorkTextField(
          value = state.baseUrl,
          onValueChange = onBaseUrlChange,
          placeholder = "https://clinic.example.com",
          helperText = "Your clinic's own server. Plain http:// only works for a local debug server."
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        DorkTextField(
          value = state.identifier,
          onValueChange = onIdentifierChange,
          placeholder = "Email address your clinic knows",
          helperText = "Codes arrive by email for now. Ask your clinic which address they have."
        )
        Spacer(modifier = Modifier.height(DorkSpacing.m))
        DorkButton(
          text = "Send one-time code",
          onClick = onConnect,
          loading = state.busy,
          enabled = state.clinicCode.length == 6 &&
            state.baseUrl.isNotBlank() &&
            state.identifier.isNotBlank()
        )
      }
    }
  }
}

@Composable
private fun StatusCard(
  state: SyncUiState,
  onSyncNow: () -> Unit,
  onRetry: (String) -> Unit,
  onDisconnect: () -> Unit
) {
  DorkCard(contentPadding = DorkSpacing.l) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Text(
          text = "Sync status",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        DorkStatusBadge(
          text = when (state.phase) {
            SyncPhase.IDLE -> "Ready"
            SyncPhase.SYNCING -> "Syncing"
            SyncPhase.NEEDS_REAUTH -> "Sign in"
            SyncPhase.ERROR -> "Needs attention"
          },
          type = when (state.phase) {
            SyncPhase.IDLE -> DorkStatusType.Success
            SyncPhase.SYNCING -> DorkStatusType.Info
            SyncPhase.NEEDS_REAUTH, SyncPhase.ERROR -> DorkStatusType.Warning
          }
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      StatusLine(
        label = "Last sync",
        value = state.lastSyncAtIso?.let(::formatTimestamp) ?: "Not yet"
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      StatusLine(
        label = "Waiting to send",
        value = if (state.pendingCount == 1) "1 item" else "${state.pendingCount} items"
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      StatusLine(
        label = "Could not send",
        value = if (state.failed.isEmpty()) "Nothing" else "${state.failed.size} items"
      )

      if (state.failed.isNotEmpty()) {
        Spacer(modifier = Modifier.height(DorkSpacing.m))
        Text(
          text = "Your clinic rejected these. Nothing was forgotten — fix the details and retry.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        state.failed.forEach { entry ->
          FailedRow(entry = entry, onRetry = onRetry)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))
      DorkButton(
        text = "Sync now",
        onClick = onSyncNow,
        loading = state.busy
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      DorkButton(
        text = "Disconnect clinic",
        onClick = onDisconnect,
        variant = DorkButtonVariant.Ghost,
        enabled = !state.busy
      )
    }
  }
}

@Composable
private fun PendingSummary(state: SyncUiState) {
  if (state.pendingCount == 0 && state.failed.isEmpty()) return
  DorkCard(contentPadding = DorkSpacing.m) {
    Column {
      Text(
        text = "Waiting on this phone",
        style = MaterialTheme.typography.titleSmall,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xxs))
      Text(
        text = "${state.pendingCount} item(s) will be sent when you turn sync on and connect.",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textSecondary
      )
    }
  }
}

@Composable
private fun StatusLine(label: String, value: String) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text(
      text = label,
      style = MaterialTheme.typography.bodySmall,
      color = DorkTheme.colors.textSecondary
    )
    Text(
      text = value,
      style = MaterialTheme.typography.bodySmall,
      color = DorkTheme.colors.textPrimary,
      textAlign = TextAlign.End
    )
  }
}

@Composable
private fun FailedRow(entry: OutboxEntry, onRetry: (String) -> Unit) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(vertical = 2.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Column(modifier = Modifier.weight(1f)) {
      Text(
        text = kindLabel(entry.kind),
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textPrimary
      )
      Text(
        text = entry.lastError ?: "The clinic rejected this item.",
        style = MaterialTheme.typography.labelSmall,
        color = DorkTheme.colors.textTertiary
      )
    }
    TextButton(onClick = { onRetry(entry.id) }) {
      Text(
        text = "Retry",
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary
      )
    }
  }
}

private fun kindLabel(kind: OutboxKind): String = when (kind) {
  OutboxKind.BOOKING -> "Booking"
  OutboxKind.INTAKE -> "Pre-visit intake"
  OutboxKind.FOLLOW_UP -> "Follow-up answer"
  OutboxKind.REFILL -> "Refill request"
  OutboxKind.CANCEL -> "Cancellation"
  OutboxKind.RESCHEDULE -> "Reschedule"
}

private fun formatTimestamp(iso: String): String {
  val formatter = DateTimeFormatter.ofPattern("d MMM, h:mm a", Locale.US)
  val parsed = runCatching { Instant.parse(iso) }.getOrNull()?.let {
    LocalDateTime.ofInstant(it, ZoneId.systemDefault())
  } ?: runCatching { LocalDateTime.parse(iso) }.getOrNull()
  return parsed?.format(formatter) ?: iso.take(16).replace('T', ' ')
}
