package health.dork.app.ui.care

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.WarningAmber
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.RecoveryAnswer
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar
import health.dork.app.core.util.dialNumber
import health.dork.app.core.util.shareText

/**
 * The 48-hour check-in. Three taps, and a clear escalation route when the answer
 * is "worse" — which is the entire clinical point of the screen.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FollowUpScreen(
  appointmentId: String,
  viewModel: FollowUpViewModel,
  clinicPhone: String,
  clinicName: String,
  onBackClick: () -> Unit,
  onDone: () -> Unit,
  modifier: Modifier = Modifier
) {
  val state by viewModel.uiState.collectAsState()
  val context = LocalContext.current

  LaunchedEffect(appointmentId) { viewModel.load(appointmentId) }

  val checkIn = state.checkIn
  val attention = viewModel.needsAttention()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "After-visit check-in",
      subtitle = checkIn?.doctorName ?: "Your care team",
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      if (!state.submitted) {
        Text(
          text = "How are you since your visit?",
          style = MaterialTheme.typography.headlineSmall,
          color = DorkTheme.colors.textPrimary
        )
        Text(
          text = "Two quick questions. It takes ten seconds and it is how your clinic finds out early if something is not right.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )

        Spacer(modifier = Modifier.height(DorkSpacing.l))

        FlowRow(
          horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs),
          verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
        ) {
          RecoveryAnswer.entries.forEach { answer ->
            DorkChip(
              label = answer.label,
              selected = state.recovery == answer,
              onClick = { viewModel.onRecoveryChange(answer) }
            )
          }
        }

        Spacer(modifier = Modifier.height(DorkSpacing.l))

        ToggleRow(
          title = "Any side effects from the treatment?",
          checked = state.sideEffects,
          onCheckedChange = viewModel::onSideEffectsChange
        )
        ToggleRow(
          title = "Do you think you should be seen again?",
          checked = state.needsToBeSeen,
          onCheckedChange = viewModel::onNeedsToBeSeenChange
        )

        Spacer(modifier = Modifier.height(DorkSpacing.m))
        Text(
          text = "Anything else? (optional)",
          style = MaterialTheme.typography.titleSmall,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        DorkTextField(
          value = state.note,
          onValueChange = viewModel::onNoteChange,
          placeholder = "e.g. cough is better but I am up at night",
          singleLine = false,
          maxLines = 3
        )

        state.error?.let {
          Spacer(modifier = Modifier.height(DorkSpacing.s))
          Text(text = it, style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.critical)
        }

        Spacer(modifier = Modifier.height(DorkSpacing.xl))
        DorkButton(text = "Save my answer", onClick = viewModel::submit)
      } else {
        ResultBanner(attention = attention)

        Spacer(modifier = Modifier.height(DorkSpacing.l))

        if (attention) {
          Text(
            text = "Call your clinic",
            style = MaterialTheme.typography.titleMedium,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = "Your answer flags that you may need to be seen. A phone call is the fastest route. Proton cannot book you in automatically.",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.s))
          DorkButton(
            text = if (clinicPhone.isBlank()) "No number saved" else "Call $clinicName",
            onClick = { dialNumber(context, clinicPhone) },
            enabled = clinicPhone.isNotBlank()
          )
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
        } else {
          Text(
            text = "Nothing here needs urgent action. Keep following your plan and finish the course.",
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textSecondary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.s))
        }

        if (!state.shared) {
          DorkButton(
            text = "Send this to my clinic",
            onClick = {
              val packet = viewModel.buildPacket() ?: return@DorkButton
              if (shareText(context, "Post-visit check-in", packet)) viewModel.markShared()
            },
            variant = DorkButtonVariant.Secondary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.xxs))
          Text(
            text = "Your answer is saved on this device only until you send it.",
            style = MaterialTheme.typography.labelSmall,
            color = DorkTheme.colors.textTertiary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.s))
        } else {
          Text(
            text = "Sent to your clinic.",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.success
          )
          Spacer(modifier = Modifier.height(DorkSpacing.s))
        }

        DorkButton(text = "Done", onClick = onDone, variant = DorkButtonVariant.Ghost)
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

@Composable
private fun ResultBanner(attention: Boolean) {
  DorkCard(
    backgroundColor = if (attention) DorkTheme.colors.criticalContainer else DorkTheme.colors.successContainer,
    contentPadding = DorkSpacing.l
  ) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      Box(
        modifier = Modifier
          .size(40.dp)
          .clip(CircleShape)
          .background(if (attention) DorkTheme.colors.critical else DorkTheme.colors.success),
        contentAlignment = Alignment.Center
      ) {
        Icon(
          imageVector = if (attention) Icons.Rounded.WarningAmber else Icons.Rounded.CheckCircle,
          contentDescription = null,
          tint = androidx.compose.ui.graphics.Color.White,
          modifier = Modifier.size(22.dp)
        )
      }
      Spacer(modifier = Modifier.size(DorkSpacing.s))
      Column {
        Text(
          text = if (attention) "This needs a conversation" else "Recovery looks on track",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        Text(
          text = if (attention) {
            "Your answer suggests you should speak to your care team today."
          } else {
            "Your answer is saved. Send it so your clinic has it on file."
          },
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    }
  }
}

@Composable
private fun ToggleRow(title: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(vertical = DorkSpacing.xxs),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text(
      text = title,
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textPrimary,
      modifier = Modifier.weight(1f)
    )
    Switch(checked = checked, onCheckedChange = onCheckedChange)
  }
}
