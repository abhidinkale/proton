package health.dork.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.MedicalServices
import androidx.compose.material.icons.rounded.MonitorHeart
import androidx.compose.material.icons.rounded.Scale
import androidx.compose.material.icons.rounded.Upload
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkAppointmentCard
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkLoadingScreen
import health.dork.app.core.designsystem.components.DorkMedicationCard
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HomeScreen(
  viewModel: HomeViewModel,
  onNavigateToCare: () -> Unit,
  onNavigateToRecords: () -> Unit,
  onNavigateToAi: () -> Unit,
  onNavigateToMedications: () -> Unit,
  onAppointmentClick: (String) -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()

  if (uiState.isLoading) {
    DorkLoadingScreen(modifier = modifier)
    return
  }

  val patientName = uiState.patient?.fullName?.split(" ")?.firstOrNull() ?: "there"

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
      .verticalScroll(scrollState)
      .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l)
  ) {
    // Header Greeting
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column {
        Text(
          text = "Dork",
          style = MaterialTheme.typography.labelLarge,
          color = MaterialTheme.colorScheme.primary
        )
        Text(
          text = "Good morning, $patientName",
          style = MaterialTheme.typography.displayMedium,
          color = DorkTheme.colors.textPrimary
        )
      }

      Box(
        modifier = Modifier
          .size(44.dp)
          .clip(CircleShape)
          .background(MaterialTheme.colorScheme.primaryContainer),
        contentAlignment = Alignment.Center
      ) {
        Text(
          text = patientName.take(1),
          style = MaterialTheme.typography.titleMedium,
          color = MaterialTheme.colorScheme.primary
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    // Daily Check-in Card
    DorkCard(
      contentPadding = DorkSpacing.m,
      backgroundColor = DorkTheme.colors.surfaceSecondary
    ) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(
          text = "How are you feeling today?",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        Row(
          horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
        ) {
          listOf("Feeling good", "A bit tired", "Need advice").forEach { mood ->
            DorkChip(
              label = mood,
              selected = uiState.checkInStatus == mood,
              onClick = { viewModel.onCheckInClick(mood) }
            )
          }
        }
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    // Quick Action Shortcuts (Section 11)
    Text(
      text = "Quick actions",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.s))

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
    ) {
      QuickActionPill(
        title = "Book doctor",
        icon = Icons.Rounded.MedicalServices,
        onClick = onNavigateToCare,
        modifier = Modifier.weight(1f)
      )
      QuickActionPill(
        title = "Upload report",
        icon = Icons.Rounded.Upload,
        onClick = onNavigateToRecords,
        modifier = Modifier.weight(1f)
      )
      QuickActionPill(
        title = "Ask Dork",
        icon = Icons.Rounded.AutoAwesome,
        onClick = onNavigateToAi,
        modifier = Modifier.weight(1f)
      )
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    // NEXT APPOINTMENT Section
    uiState.nextAppointment?.let { appt ->
      Text(
        text = "Next appointment",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textSecondary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.s))
      DorkAppointmentCard(
        doctorName = appt.doctorName,
        specialty = appt.specialty,
        dateTime = appt.dateTimeString,
        locationOrType = appt.clinicLocation,
        isVideo = appt.consultationType == ConsultationType.VIDEO,
        status = appt.status,
        onActionClick = { onAppointmentClick(appt.id) },
        actionText = "View details"
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xl))
    }

    // MEDICATIONS / NEXT DOSE Section
    uiState.nextDose?.let { dose ->
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = "Medications",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textSecondary
        )
        Text(
          text = "View schedule",
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.primary,
          modifier = Modifier.clickable(onClick = onNavigateToMedications)
        )
      }
      Spacer(modifier = Modifier.height(DorkSpacing.s))
      DorkMedicationCard(
        name = dose.name,
        dosage = dose.dosage,
        scheduledTime = dose.scheduledTime,
        state = dose.state,
        instructions = dose.instructions,
        prescribedBy = dose.prescribingDoctor,
        onTakenClick = { viewModel.markNextDoseTaken(dose.id) },
        onSkipClick = { viewModel.skipNextDose(dose.id) }
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xl))
    }

    // HEALTH SNAPSHOT Section
    Text(
      text = "Health snapshot",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.s))

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
    ) {
      // Weight & BMI Card
      DorkCard(
        modifier = Modifier.weight(1f),
        contentPadding = DorkSpacing.m
      ) {
        Column {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.Rounded.Scale,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(DorkSpacing.xs))
            Text(
              text = "Weight",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          Text(
            text = "${uiState.patient?.weightKg ?: 68.5} kg",
            style = MaterialTheme.typography.headlineMedium,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = "BMI ${uiState.patient?.bmi ?: 23.2} · ${uiState.patient?.bmiCategory ?: "Healthy"}",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }

      // Resting Heart Rate Card
      DorkCard(
        modifier = Modifier.weight(1f),
        contentPadding = DorkSpacing.m
      ) {
        Column {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.Rounded.MonitorHeart,
              contentDescription = null,
              tint = DorkTheme.colors.critical,
              modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(DorkSpacing.xs))
            Text(
              text = "Resting pulse",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          Text(
            text = "${uiState.restingHeartRateBpm} bpm",
            style = MaterialTheme.typography.headlineMedium,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = "Normal resting range",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    // RECENT HEALTH RECORDS Section
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Text(
        text = "Recent records",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textSecondary
      )
      Text(
        text = "All records",
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.clickable(onClick = onNavigateToRecords)
      )
    }
    Spacer(modifier = Modifier.height(DorkSpacing.s))

    Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)) {
      uiState.recentRecords.forEach { record ->
        DorkCard(
          contentPadding = DorkSpacing.m,
          onClick = onNavigateToRecords
        ) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Column(modifier = Modifier.weight(1f)) {
              Text(
                text = record.title,
                style = MaterialTheme.typography.titleMedium,
                color = DorkTheme.colors.textPrimary
              )
              Text(
                text = "${record.doctorOrLab} · ${record.displayDate}",
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textSecondary
              )
            }
            DorkStatusBadge(text = record.type.name, type = DorkStatusType.Neutral)
          }
        }
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xxl))
  }
}

@Composable
private fun QuickActionPill(
  title: String,
  icon: ImageVector,
  onClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  DorkCard(
    modifier = modifier,
    contentPadding = DorkSpacing.s,
    onClick = onClick,
    backgroundColor = DorkTheme.colors.surfaceSecondary
  ) {
    Column(
      modifier = Modifier.fillMaxWidth(),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      Icon(
        imageVector = icon,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.size(22.dp)
      )
      Spacer(modifier = Modifier.height(4.dp))
      Text(
        text = title,
        style = MaterialTheme.typography.labelSmall,
        color = DorkTheme.colors.textPrimary
      )
    }
  }
}
