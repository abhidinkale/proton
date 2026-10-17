package health.dork.app.ui.medications

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
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Medication
import androidx.compose.material.icons.rounded.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkMedicationCard
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType

@Composable
fun MedicationsScreen(
  viewModel: MedicationsViewModel,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
      .verticalScroll(scrollState)
      .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l)
  ) {
    Text(
      text = "Medications",
      style = MaterialTheme.typography.displayMedium,
      color = DorkTheme.colors.textPrimary
    )
    Text(
      text = "Daily schedule, reminders, and routine tracking",
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textSecondary
    )

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    // Non-judgmental Adherence Card (Section 29)
    DorkCard(contentPadding = DorkSpacing.m) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.AutoMirrored.Rounded.TrendingUp,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(DorkSpacing.xs))
            Text(
              text = "Medication adherence",
              style = MaterialTheme.typography.titleMedium,
              color = DorkTheme.colors.textPrimary
            )
          }

          Text(
            text = "${uiState.overallAdherence}%",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.primary
          )
        }

        Spacer(modifier = Modifier.height(DorkSpacing.s))

        LinearProgressIndicator(
          progress = { uiState.overallAdherence / 100f },
          modifier = Modifier.fillMaxWidth().height(6.dp),
          color = MaterialTheme.colorScheme.primary,
          trackColor = DorkTheme.colors.surfaceBorderSubtle
        )

        Spacer(modifier = Modifier.height(DorkSpacing.s))

        Text(
          text = "${uiState.totalDosesTaken} of ${uiState.totalDosesScheduled} scheduled doses completed this month. Keep up your healthy routine.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    // Today's Doses
    Text(
      text = "Today's schedule",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.s))

    Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)) {
      uiState.todayDoses.forEach { dose ->
        DorkMedicationCard(
          name = dose.name,
          dosage = dose.dosage,
          scheduledTime = dose.scheduledTime,
          state = dose.state,
          instructions = dose.instructions,
          prescribedBy = dose.prescribingDoctor,
          onTakenClick = { viewModel.markDoseTaken(dose.id) },
          onSkipClick = { viewModel.skipDose(dose.id) }
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    // Active Prescriptions & Regimens
    Text(
      text = "Active regimens",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.s))

    Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)) {
      uiState.plans.forEach { plan ->
        DorkCard(contentPadding = DorkSpacing.m) {
          Column(modifier = Modifier.fillMaxWidth()) {
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween,
              verticalAlignment = Alignment.CenterVertically
            ) {
              Text(
                text = plan.name,
                style = MaterialTheme.typography.titleMedium,
                color = DorkTheme.colors.textPrimary
              )
              DorkStatusBadge(text = plan.duration, type = DorkStatusType.Neutral)
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
              text = "${plan.dosage} · ${plan.frequency}",
              style = MaterialTheme.typography.bodyMedium,
              color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(DorkSpacing.xs))

            Text(
              text = plan.instructions,
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )

            Spacer(modifier = Modifier.height(DorkSpacing.xs))

            Row(verticalAlignment = Alignment.CenterVertically) {
              Icon(
                imageVector = Icons.Rounded.CalendarToday,
                contentDescription = null,
                tint = DorkTheme.colors.textTertiary,
                modifier = Modifier.size(14.dp)
              )
              Spacer(modifier = Modifier.width(4.dp))
              Text(
                text = "Rx by ${plan.prescribingDoctor} · Times: ${plan.dailyTimes.joinToString(", ")}",
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textTertiary
              )
            }
          }
        }
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.giant))
  }
}
