package health.dork.app.ui.care

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AppointmentBookingScreen(
  viewModel: CareViewModel,
  onBackClick: () -> Unit,
  onConfirmedDone: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()
  var confirmedAppointment by remember { mutableStateOf<AppointmentItem?>(null) }

  val doctor = uiState.selectedDoctor ?: return

  if (confirmedAppointment != null) {
    // Visually satisfying confirmation screen (Section 18)
    ConfirmationView(
      appointment = confirmedAppointment!!,
      onDone = onConfirmedDone
    )
    return
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Book appointment",
      subtitle = doctor.name,
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      // 1. Consultation Type
      Text(
        text = "Consultation type",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.s))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
      ) {
        DorkChip(
          label = "In-person clinic",
          selected = uiState.selectedConsultationType == ConsultationType.IN_PERSON,
          onClick = { viewModel.onConsultationTypeSelected(ConsultationType.IN_PERSON) },
          leadingIcon = {
            Icon(imageVector = Icons.Rounded.LocationOn, contentDescription = null, modifier = Modifier.size(16.dp))
          }
        )
        DorkChip(
          label = "Video call",
          selected = uiState.selectedConsultationType == ConsultationType.VIDEO,
          onClick = { viewModel.onConsultationTypeSelected(ConsultationType.VIDEO) },
          leadingIcon = {
            Icon(imageVector = Icons.Rounded.Videocam, contentDescription = null, modifier = Modifier.size(16.dp))
          }
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // 2. Select Available Slot
      Text(
        text = "Select appointment slot",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.s))

      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs),
        verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
      ) {
        doctor.availableSlots.forEach { slot ->
          DorkChip(
            label = slot,
            selected = uiState.selectedSlot == slot,
            onClick = { viewModel.onSlotSelected(slot) }
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // 3. Reason for visit
      Text(
        text = "Reason for visit",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.s))

      DorkTextField(
        value = uiState.bookingReason,
        onValueChange = viewModel::onReasonChange,
        placeholder = "Describe your symptoms or goals for this visit...",
        singleLine = false,
        maxLines = 3
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      // Summary Card
      DorkCard(contentPadding = DorkSpacing.m) {
        Column {
          Text(
            text = "Appointment summary",
            style = MaterialTheme.typography.titleSmall,
            color = DorkTheme.colors.textPrimary
          )
          Spacer(modifier = Modifier.height(4.dp))
          Text(
            text = "${doctor.name} · ${doctor.specialty}",
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textSecondary
          )
          Text(
            text = "${uiState.selectedSlot ?: "Today"} · ${uiState.selectedConsultationType.label}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.primary
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      DorkButton(
        text = "Confirm appointment",
        onClick = {
          viewModel.confirmBooking { appt ->
            confirmedAppointment = appt
          }
        },
        loading = uiState.isBookingInProgress
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

@Composable
private fun ConfirmationView(
  appointment: AppointmentItem,
  onDone: () -> Unit
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
      .padding(DorkSpacing.screenHorizontalPadding),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center
  ) {
    Box(
      modifier = Modifier
        .size(76.dp)
        .clip(CircleShape)
        .background(DorkTheme.colors.successContainer),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = Icons.Rounded.CheckCircle,
        contentDescription = null,
        tint = DorkTheme.colors.success,
        modifier = Modifier.size(48.dp)
      )
    }

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    Text(
      text = "Appointment confirmed",
      style = MaterialTheme.typography.displayMedium,
      color = DorkTheme.colors.textPrimary
    )

    Spacer(modifier = Modifier.height(DorkSpacing.xs))

    Text(
      text = "Your consultation has been booked and scheduled with the clinic.",
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textSecondary,
      textAlign = androidx.compose.ui.text.style.TextAlign.Center
    )

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkCard(contentPadding = DorkSpacing.l) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = appointment.doctorName, style = MaterialTheme.typography.headlineMedium, color = DorkTheme.colors.textPrimary)
        Text(text = appointment.specialty, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
        Spacer(modifier = Modifier.height(DorkSpacing.m))
        Text(text = "Date & Time", style = MaterialTheme.typography.labelSmall, color = DorkTheme.colors.textTertiary)
        Text(text = appointment.dateTimeString, style = MaterialTheme.typography.titleMedium, color = DorkTheme.colors.textPrimary)
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        Text(text = "Location", style = MaterialTheme.typography.labelSmall, color = DorkTheme.colors.textTertiary)
        Text(text = appointment.clinicLocation, style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkButton(
      text = "View in Appointments",
      onClick = onDone,
      variant = DorkButtonVariant.Primary
    )
  }
}
