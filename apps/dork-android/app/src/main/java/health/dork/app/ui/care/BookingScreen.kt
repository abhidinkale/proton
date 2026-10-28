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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.designsystem.DorkGradients
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.DorkType
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.util.addAppointmentToCalendar
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

/**
 * Booking — the patient's half of the loop.
 *
 * One decision at a time on an ember surface, then a confirmation that says
 * exactly what happens next. The queue is local-first: confirming writes to the
 * outbox and the clinic sees it when the phone next reaches a network, so the
 * screen must never imply the clinic already answered.
 */
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
    BookingHero(
      doctorName = doctor.name,
      doctorSpecialty = doctor.specialty,
      clinicName = doctor.clinicName,
      isReschedule = state.isReschedule,
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l)
    ) {
      if (state.isReschedule) {
        Text(
          text = "Your current appointment stays saved until you confirm a new time.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.m))
      }

      SectionLabel("Where")
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
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
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        Text(
          text = "${doctor.name} has no open slots in the next three weeks.",
          style = MaterialTheme.typography.bodyMedium,
          color = DorkTheme.colors.textSecondary
        )
      } else {
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
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
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          Text(
            text = "No times left on this day. Pick another day.",
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textSecondary
          )
        } else {
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
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
      SectionLabel("Reason")
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      DorkTextField(
        value = state.reason,
        onValueChange = viewModel::onReasonChange,
        placeholder = "What would you like to sort out?",
        singleLine = false,
        maxLines = 3
      )

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // One line that answers "what am I about to book?"
      DorkCard(backgroundColor = DorkTheme.colors.surfaceSecondary, contentPadding = DorkSpacing.m) {
        Column {
          Text(
            text = state.selectedSlot?.timeLabel?.let { formatDay(state.selectedDate) + " · " + it }
              ?: "Choose a day and a time",
            style = MaterialTheme.typography.titleMedium,
            color = DorkTheme.colors.textPrimary
          )
          Spacer(modifier = Modifier.height(2.dp))
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
        text = "Saved on this device. The clinic sees it when you're back online.",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth()
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

// ── Hero ────────────────────────────────────────────────────────────────────

@Composable
private fun BookingHero(
  doctorName: String,
  doctorSpecialty: String,
  clinicName: String,
  isReschedule: Boolean,
  onBackClick: () -> Unit
) {
  Box(
    modifier = Modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(bottomStart = 30.dp, bottomEnd = 30.dp))
      .background(Brush.verticalGradient(DorkGradients.Ember))
      .padding(
        start = DorkSpacing.screenHorizontalPadding,
        end = DorkSpacing.screenHorizontalPadding,
        top = DorkSpacing.m,
        bottom = DorkSpacing.xl
      )
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Box(
          modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(Color.White.copy(alpha = 0.16f))
            .clickable(onClick = onBackClick),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
            contentDescription = "Back",
            tint = Color.White,
            modifier = Modifier.size(17.dp)
          )
        }
        Spacer(modifier = Modifier.weight(1f))
        Text(
          text = "proton",
          style = DorkType.mono.copy(letterSpacing = 2.4.sp),
          color = Color.White.copy(alpha = 0.55f)
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))
      Text(
        text = if (isReschedule) "MOVE A VISIT" else "BOOK A VISIT",
        style = DorkType.eyebrow.copy(letterSpacing = 2.2.sp),
        color = Color.White.copy(alpha = 0.55f)
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Text(
        text = doctorName,
        style = MaterialTheme.typography.displaySmall,
        color = Color.White
      )
      Spacer(modifier = Modifier.height(4.dp))
      Text(
        text = "$doctorSpecialty · $clinicName",
        style = MaterialTheme.typography.bodySmall,
        color = Color.White.copy(alpha = 0.62f)
      )
    }
  }
}

// ── Confirmation ────────────────────────────────────────────────────────────

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
  ) {
    Box(
      modifier = Modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(bottomStart = 30.dp, bottomEnd = 30.dp))
        .background(Brush.verticalGradient(DorkGradients.Ember))
        .padding(
          start = DorkSpacing.screenHorizontalPadding,
          end = DorkSpacing.screenHorizontalPadding,
          top = DorkSpacing.xxl,
          bottom = DorkSpacing.xl
        )
    ) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Box(
            modifier = Modifier
              .size(34.dp)
              .clip(CircleShape)
              .background(Color.White.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = Icons.Rounded.CheckCircle,
              contentDescription = null,
              tint = Color.White,
              modifier = Modifier.size(20.dp)
            )
          }
          Spacer(modifier = Modifier.width(DorkSpacing.xs))
          Text(
            text = if (isReschedule) "MOVED" else "SAVED",
            style = DorkType.eyebrow.copy(letterSpacing = 2.2.sp),
            color = Color.White.copy(alpha = 0.6f)
          )
        }

        Spacer(modifier = Modifier.height(DorkSpacing.l))
        Text(
          text = if (isReschedule) "Moved." else "Booked.",
          style = MaterialTheme.typography.displayLarge,
          color = Color.White
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        Text(
          text = appointment.displayDateTime,
          style = DorkType.mono.copy(fontSize = 12.sp, letterSpacing = 1.2.sp),
          color = Color.White.copy(alpha = 0.72f)
        )
      }
    }

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l)
    ) {
      Text(
        text = appointment.doctorName,
        style = MaterialTheme.typography.headlineLarge,
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
          modifier = Modifier.size(15.dp)
        )
        Spacer(modifier = Modifier.size(DorkSpacing.xxs))
        Text(
          text = appointment.clinicLocation,
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
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

      Spacer(modifier = Modifier.height(DorkSpacing.m))
      Text(
        text = "The clinic confirms this visit. You'll see it change in Care.",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth()
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xl))
    }
  }
}

// ── Pieces ──────────────────────────────────────────────────────────────────

@Composable
private fun DayChip(day: LocalDate, selected: Boolean, onClick: () -> Unit) {
  val background = if (selected) DorkTheme.colors.textPrimary else DorkTheme.colors.surfaceSecondary
  val content = if (selected) Color.White else DorkTheme.colors.textSecondary
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
      style = DorkType.eyebrow,
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
    text = text.uppercase(Locale.US),
    style = DorkType.eyebrow,
    color = DorkTheme.colors.textTertiary
  )
}

private fun formatDay(day: LocalDate?): String =
  day?.let { it.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US) + " " + it.dayOfMonth } ?: "Choose a day"
