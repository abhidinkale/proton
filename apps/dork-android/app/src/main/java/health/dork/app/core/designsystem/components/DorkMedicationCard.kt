package health.dork.app.core.designsystem.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Medication
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import kotlinx.serialization.Serializable

@Serializable
enum class MedicationDoseState {
  Upcoming,
  Due,
  Taken,
  Skipped,
  Completed
}

@Composable
fun DorkMedicationCard(
  name: String,
  dosage: String,
  scheduledTime: String,
  state: MedicationDoseState,
  modifier: Modifier = Modifier,
  instructions: String? = null,
  prescribedBy: String? = null,
  onTakenClick: (() -> Unit)? = null,
  onSkipClick: (() -> Unit)? = null,
  onClick: (() -> Unit)? = null
) {
  val badgeType = when (state) {
    MedicationDoseState.Taken -> DorkStatusType.Success
    MedicationDoseState.Due -> DorkStatusType.Warning
    MedicationDoseState.Upcoming -> DorkStatusType.Info
    MedicationDoseState.Skipped -> DorkStatusType.Neutral
    MedicationDoseState.Completed -> DorkStatusType.Success
  }

  val badgeText = when (state) {
    MedicationDoseState.Taken -> "Taken"
    MedicationDoseState.Due -> "Due now"
    MedicationDoseState.Upcoming -> "Upcoming"
    MedicationDoseState.Skipped -> "Skipped"
    MedicationDoseState.Completed -> "Course complete"
  }

  DorkCard(
    modifier = modifier,
    onClick = onClick,
    contentPadding = DorkSpacing.m
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier.weight(1f)
        ) {
          Icon(
            imageVector = Icons.Rounded.Medication,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp)
          )
          Spacer(modifier = Modifier.width(DorkSpacing.s))
          Column {
            Text(
              text = name,
              style = MaterialTheme.typography.titleMedium,
              color = DorkTheme.colors.textPrimary
            )
            Text(
              text = dosage,
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
        }

        DorkStatusBadge(text = badgeText, type = badgeType)
      }

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = Icons.Rounded.Schedule,
            contentDescription = null,
            tint = DorkTheme.colors.textTertiary,
            modifier = Modifier.size(16.dp)
          )
          Spacer(modifier = Modifier.width(4.dp))
          Text(
            text = scheduledTime,
            style = MaterialTheme.typography.labelMedium,
            color = DorkTheme.colors.textSecondary
          )
        }

        if (prescribedBy != null) {
          Text(
            text = "Rx: $prescribedBy",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textTertiary
          )
        }
      }

      if (instructions != null) {
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        Text(
          text = instructions,
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }

      // Action row for actionable doses (Due or Upcoming)
      if ((state == MedicationDoseState.Due || state == MedicationDoseState.Upcoming) && onTakenClick != null) {
        Spacer(modifier = Modifier.height(DorkSpacing.m))
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
        ) {
          DorkButton(
            text = "Mark Taken",
            onClick = onTakenClick,
            variant = DorkButtonVariant.Primary,
            modifier = Modifier.weight(1f),
            leadingIcon = {
              Icon(
                imageVector = Icons.Rounded.Check,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.size(16.dp)
              )
            }
          )

          if (onSkipClick != null) {
            DorkButton(
              text = "Skip",
              onClick = onSkipClick,
              variant = DorkButtonVariant.Secondary,
              modifier = Modifier.weight(0.6f)
            )
          }
        }
      }
    }
  }
}
