package health.dork.app.ui.care

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar
import health.dork.app.core.util.addAppointmentToCalendar
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BookingScreen(
  viewModel: CareViewModel,
  onBackClick: () -> Unit,
  onConfirmedDone: () -> Unit,
  onStartIntake: (AppointmentItem) -> Unit,
  modifier: Modifier = Modifier
) {
  val state by viewModel.booking.collectAsState()
  val doctor = state.doctor ?: return
  val context = LocalContext.current

  state.confirmation?.let { appointment ->
    BookingConfirmation(
      appointment = appointment,
      isReschedule = state.isReschedule,
      onAddToCalendar = { addAppointmentToCalendar(context, appointment) },
      onStartIntake = { onStartIntake(appointment) },
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
      title = if (state.isReschedule) "Move appointment" else "Book appointment",
      subtitle = doctor.name,
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      if (state.isReschedule) {
        DorkCard(backgroundColor = DorkTheme.colors.surfaceSecondary, contentPadding = DorkSpacing.m) {
          Text(
            text = "Your current appointment stays saved until you confirm a new time.",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
        Spacer(modifier = Modifier.height(DorkSpacing.m))
      }

      SectionLabel("Where")
      Row(horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
        DorkChip(
          label = "Clinic visit",
          selected = state.consultationType == ConsultationType.IN_PERSON,
          onClick = { viewModel.onConsultationTypeSelected(ConsultationType.IN_PERSON) },
          leadingIcon = {
            Icon(Icons.Rounded.LocationOn, contentDescription = null, modifier = Modifier.size(16.dp))
          }
        )
        if (doctor.consultationTypes.contains(ConsultationType.VIDEO)) {
          DorkChip(
            label = "Video",
            selected = state.consultationType == ConsultationType.VIDEO,
            onClick = { viewModel.onConsultationTypeSelected(ConsultationType.VIDEO) },
            leadingIcon = {
              Icon(Icons.Rounded.Videocam, contentDescription = null, modifier = Modifier.size(16.dp))
            }
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))
      SectionLabel("Day")

      if (state.openDays.isEmpty()) {
        Text(
          text = "${doctor.name} has no open slots in the next three weeks.",
          style = MaterialTheme.typography.bodyMedium,
          color = DorkTheme.colors.textSecondary
        )
      } else {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
          items(state.openDays) { day ->
            DayChip(
              day = day,
              selected = day == state.selectedDate,
              onClick = { viewModel.onDateSelected(day) }
            )
          }
        }

        Spacer(modifier = Modifier.height(DorkSpacing.l))
        SectionLabel("Time")

        if (state.slots.isEmpty()) {
          Text(
            text = "No times left on this day. Pick another day.",
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textSecondary
          )
        } else {
          FlowRow(
            horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs),
            verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
          ) {
            state.slots.forEach { slot ->
              DorkChip(
                label = slot.timeLabel,
                selected = state.selectedSlotIso == slot.startIso,
                onClick = { viewModel.onSlotSelected(slot.startIso) }
              )
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))
      SectionLabel("Reason for the visit")
      Spacer(modifier = Modifier.height(DorkSpacing.xxs))
      DorkTextField(
        value = state.reason,
        onValueChange = viewModel::onReasonChange,
        placeholder = "What would you like to sort out?",
        singleLine = false,
        maxLines = 3
      )

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      DorkCard(backgroundColor = DorkTheme.colors.surfaceSecondary, contentPadding = DorkSpacing.m) {
        Column {
          Text(
            text = "${doctor.name} · ${doctor.specialty}",
            style = MaterialTheme.typography.titleSmall,
            color = DorkTheme.colors.textPrimary
          )
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = buildString {
              append(state.selectedDate?.let { formatDay(it) } ?: "Choose a day")
              append(" · ")
              append(state.selectedSlot?.timeLabel ?: "choose a time")
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.primary
          )
          Text(
            text = if (state.consultationType == ConsultationType.VIDEO) {
              "Video room"
            } else {
              doctor.clinicName
            },
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }

      state.error?.let { message ->
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        Text(
          text = message,
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.critical
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      DorkButton(
        text = if (state.isReschedule) "Confirm new time" else "Confirm appointment",
        onClick = { viewModel.confirmBooking { } },
        loading = state.isWorking,
        enabled = state.selectedSlotIso != null
      )

      Spacer(modifier = Modifier.height(DorkSpacing.s))
      Text(
        text = "Saved on this device. Proton does not contact the clinic for you — use “Add to calendar” and the clinic's own booking line if you need to confirm.",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth()
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

@Composable
private fun BookingConfirmation(
  appointment: AppointmentItem,
  isReschedule: Boolean,
  onAddToCalendar: () -> Unit,
  onStartIntake: () -> Unit,
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
        .size(72.dp)
        .clip(CircleShape)
        .background(DorkTheme.colors.successContainer),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = Icons.Rounded.CheckCircle,
        contentDescription = null,
        tint = DorkTheme.colors.success,
        modifier = Modifier.size(44.dp)
      )
    }

    Spacer(modifier = Modifier.height(DorkSpacing.l))
    Text(
      text = if (isReschedule) "Appointment moved" else "Appointment saved",
      style = MaterialTheme.typography.displayMedium,
      color = DorkTheme.colors.textPrimary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(
      text = appointment.displayDateTime,
      style = MaterialTheme.typography.titleMedium,
      color = MaterialTheme.colorScheme.primary
    )

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    DorkCard(contentPadding = DorkSpacing.l) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(
          text = appointment.doctorName,
          style = MaterialTheme.typography.headlineMedium,
          color = DorkTheme.colors.textPrimary
        )
        Text(
          text = appointment.specialty,
          style = MaterialTheme.typography.bodyMedium,
          color = DorkTheme.colors.textSecondary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = Icons.Rounded.CalendarMonth,
            contentDescription = null,
            tint = DorkTheme.colors.textTertiary,
            modifier = Modifier.size(16.dp)
          )
          Spacer(modifier = Modifier.size(DorkSpacing.xxs))
          Text(
            text = appointment.clinicLocation,
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    DorkButton(text = "Start pre-visit check-in", onClick = onStartIntake)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    DorkButton(
      text = "Add to calendar",
      onClick = onAddToCalendar,
      variant = DorkButtonVariant.Secondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    DorkButton(text = "Done", onClick = onDone, variant = DorkButtonVariant.Ghost)
  }
}

@Composable
private fun DayChip(day: LocalDate, selected: Boolean, onClick: () -> Unit) {
  val background = if (selected) DorkTheme.colors.textPrimary else DorkTheme.colors.card
  val content = if (selected) androidx.compose.ui.graphics.Color.White else DorkTheme.colors.textSecondary
  Column(
    modifier = Modifier
      .clip(DorkShapes.medium)
      .background(background)
      .clickable(onClick = onClick)
      .padding(horizontal = DorkSpacing.m, vertical = DorkSpacing.xs),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text(
      text = day.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US),
      style = MaterialTheme.typography.labelSmall,
      color = content
    )
    Text(
      text = day.dayOfMonth.toString(),
      style = MaterialTheme.typography.titleMedium,
      color = content
    )
  }
}

@Composable
private fun SectionLabel(text: String) {
  Text(
    text = text,
    style = MaterialTheme.typography.titleMedium,
    color = DorkTheme.colors.textPrimary
  )
}

private fun formatDay(day: LocalDate): String =
  day.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US) + " " + day.dayOfMonth
