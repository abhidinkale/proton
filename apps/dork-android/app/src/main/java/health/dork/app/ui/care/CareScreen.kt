package health.dork.app.ui.care

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.displayCutoutPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.EventAvailable
import androidx.compose.material.icons.rounded.EventRepeat
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.SearchOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.ClinicMessage
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.AppointmentStatus
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkDoctorCard
import health.dork.app.core.designsystem.components.DorkEmptyState
import health.dork.app.core.designsystem.components.DorkSearchBar
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType
import health.dork.app.core.util.addAppointmentToCalendar
import java.time.LocalDateTime

@Composable
fun CareScreen(
  viewModel: CareViewModel,
  onDoctorClick: (Doctor) -> Unit,
  onBookClick: (Doctor) -> Unit,
  onMessagesClick: () -> Unit,
  unreadClinicMessages: Int = 0,
  latestClinicMessage: ClinicMessage? = null,
  onReschedule: (String) -> Unit,
  onFollowUp: (String) -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()
  val specialtyScrollState = rememberScrollState()
  val context = LocalContext.current

  val upcomingAppointments = androidx.compose.runtime.remember(uiState.appointments) {
    uiState.appointments
      .filter { it.status != AppointmentStatus.Cancelled }
      .filter {
        runCatching { LocalDateTime.parse(it.dateIso) }.getOrNull()
          ?.isAfter(LocalDateTime.now()) == true
      }
      .sortedBy { it.dateIso }
      .take(3)
  }

  val recentVisits = androidx.compose.runtime.remember(uiState.appointments) {
    uiState.appointments
      .filter { it.status == AppointmentStatus.Fulfilled }
      .filter {
        runCatching { LocalDateTime.parse(it.dateIso) }.getOrNull()
          ?.isBefore(LocalDateTime.now()) == true
      }
      .sortedByDescending { it.dateIso }
      .take(2)
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
      .statusBarsPadding()
      .displayCutoutPadding()
      .verticalScroll(scrollState)
      .padding(bottom = 120.dp)
  ) {
    // Header
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l)
    ) {
      Text(
        text = "Find healthcare",
        style = MaterialTheme.typography.displayMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Text(
        text = "Book consultations with your care team. Appointments are saved on this device.",
        style = MaterialTheme.typography.bodyMedium,
        color = DorkTheme.colors.textSecondary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.m))

      // Search Bar
      DorkSearchBar(
        query = uiState.searchQuery,
        onQueryChange = viewModel::onSearchQueryChange,
        placeholder = "Doctor, specialty or condition"
      )

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      if (uiState.showMessagesEntry) {
        DorkCard(
          contentPadding = DorkSpacing.m,
          onClick = onMessagesClick
        ) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Icon(
              imageVector = Icons.Rounded.Forum,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.width(DorkSpacing.s))
            Column(modifier = Modifier.weight(1f)) {
              Text(
                text = "From your clinic",
                style = MaterialTheme.typography.titleSmall,
                color = DorkTheme.colors.textPrimary
              )
              Text(
                text = when {
                  unreadClinicMessages > 0 ->
                    "$unreadClinicMessages new message${if (unreadClinicMessages == 1) "" else "s"} from your care team"
                  latestClinicMessage != null -> latestClinicMessage.body
                  else -> "Replies from your care team appear here"
                },
                style = MaterialTheme.typography.bodySmall,
                color = if (unreadClinicMessages > 0) {
                  MaterialTheme.colorScheme.primary
                } else {
                  DorkTheme.colors.textSecondary
                },
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
              )
            }
            if (unreadClinicMessages > 0) {
              DorkStatusBadge(
                text = unreadClinicMessages.toString(),
                type = DorkStatusType.Info
              )
              Spacer(modifier = Modifier.width(DorkSpacing.xs))
            }
            Icon(
              imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
              contentDescription = null,
              tint = DorkTheme.colors.textTertiary,
              modifier = Modifier.size(20.dp)
            )
          }
        }
      }
    }

    // Upcoming appointments saved on this device
    if (upcomingAppointments.isNotEmpty()) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = DorkSpacing.screenHorizontalPadding)
      ) {
        Text(
          text = "Your appointments",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textSecondary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
          upcomingAppointments.forEach { appointment ->
            AppointmentRow(
              appointment = appointment,
              onAddToCalendar = { addAppointmentToCalendar(context, appointment) },
              onReschedule = { onReschedule(appointment.id) },
              onCancel = { viewModel.cancelAppointment(appointment.id) }
            )
          }
        }
      }
      Spacer(modifier = Modifier.height(DorkSpacing.m))
    }

    if (recentVisits.isNotEmpty()) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = DorkSpacing.screenHorizontalPadding)
      ) {
        Text(
          text = "After your last visits",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textSecondary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
          recentVisits.forEach { appointment ->
            RecentVisitRow(
              appointment = appointment,
              followUpDue = viewModel.followUpDueFor(appointment.id),
              onCheckIn = { onFollowUp(appointment.id) }
            )
          }
        }
      }
      Spacer(modifier = Modifier.height(DorkSpacing.m))
    }

    // Specialty category chips
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .horizontalScroll(specialtyScrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.xs),
      horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
    ) {
      viewModel.specialties.forEach { specialty ->
        DorkChip(
          label = specialty,
          selected = uiState.selectedSpecialty == specialty,
          onClick = { viewModel.onSpecialtySelected(specialty) }
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.s))

    // Doctor List
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.s),
      verticalArrangement = Arrangement.spacedBy(DorkSpacing.m)
    ) {
      if (uiState.filteredDoctors.isEmpty()) {
        DorkEmptyState(
          title = "No doctors found",
          description = "Try searching for a different condition, specialty, or physician name.",
          icon = Icons.Rounded.SearchOff,
          actionText = "Show all doctors",
          onActionClick = {
            viewModel.onSearchQueryChange("")
            viewModel.onSpecialtySelected("All Specialties")
          }
        )
      } else {
        uiState.filteredDoctors.forEach { doc ->
          DorkDoctorCard(
            name = doc.name,
            specialty = doc.specialty,
            qualifications = doc.qualifications,
            clinicName = doc.clinicName,
            distance = doc.distanceKm,
            availabilityText = doc.availableSlots.firstOrNull()?.let { "Next: $it" }
              ?: "No slots listed",
            rating = doc.rating,
            reviewCount = doc.reviewCount,
            onProfileClick = { onDoctorClick(doc) },
            onBookClick = { onBookClick(doc) }
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

@Composable
private fun AppointmentRow(
  appointment: AppointmentItem,
  onAddToCalendar: () -> Unit,
  onReschedule: () -> Unit,
  onCancel: () -> Unit
) {
  DorkCard(contentPadding = DorkSpacing.m) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        Icon(
          imageVector = Icons.Rounded.CalendarMonth,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(DorkSpacing.s))
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = appointment.doctorName,
            style = MaterialTheme.typography.titleSmall,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = "${appointment.displayDateTime} · ${appointment.consultationType.label}",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
          Text(
            text = appointment.clinicLocation,
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textTertiary
          )
        }
        DorkStatusBadge(
          text = appointment.status.label(),
          type = when (appointment.status) {
            AppointmentStatus.Confirmed, AppointmentStatus.Arrived -> DorkStatusType.Success
            AppointmentStatus.Cancelled -> DorkStatusType.Critical
            else -> DorkStatusType.Warning
          }
        )
      }

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End
      ) {
        TextButton(onClick = onAddToCalendar) {
          Icon(
            imageVector = Icons.Rounded.EventAvailable,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(15.dp)
          )
          Spacer(modifier = Modifier.width(4.dp))
          Text(
            text = "Add to calendar",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary
          )
        }
        TextButton(onClick = onReschedule) {
          Icon(
            imageVector = Icons.Rounded.EventRepeat,
            contentDescription = null,
            tint = DorkTheme.colors.textTertiary,
            modifier = Modifier.size(15.dp)
          )
          Spacer(modifier = Modifier.width(4.dp))
          Text(
            text = "Move",
            style = MaterialTheme.typography.labelSmall,
            color = DorkTheme.colors.textTertiary
          )
        }
        TextButton(onClick = onCancel) {
          Icon(
            imageVector = Icons.Rounded.Close,
            contentDescription = null,
            tint = DorkTheme.colors.textTertiary,
            modifier = Modifier.size(14.dp)
          )
          Spacer(modifier = Modifier.width(2.dp))
          Text(
            text = "Cancel",
            style = MaterialTheme.typography.labelSmall,
            color = DorkTheme.colors.textTertiary
          )
        }
      }
    }
  }
}

private fun AppointmentStatus.label(): String = when (this) {
  AppointmentStatus.Confirmed -> "Confirmed"
  AppointmentStatus.Cancelled -> "Cancelled"
  AppointmentStatus.Booked -> "Booked"
  AppointmentStatus.Pending -> "Pending"
  AppointmentStatus.Proposed -> "Proposed"
  AppointmentStatus.Arrived -> "Checked in"
  AppointmentStatus.Fulfilled -> "Completed"
}

@Composable
private fun RecentVisitRow(
  appointment: AppointmentItem,
  followUpDue: Boolean,
  onCheckIn: () -> Unit
) {
  DorkCard(contentPadding = DorkSpacing.m) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = appointment.doctorName,
            style = MaterialTheme.typography.titleSmall,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = "${appointment.displayDateTime} · ${appointment.reasonForVisit}",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End
      ) {
        if (followUpDue) {
          TextButton(onClick = onCheckIn) {
            Icon(
              imageVector = Icons.Rounded.EventAvailable,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(15.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
              text = "Answer check-in",
              style = MaterialTheme.typography.labelSmall,
              color = MaterialTheme.colorScheme.primary
            )
          }
        } else {
          Text(
            text = "Check-in done",
            style = MaterialTheme.typography.labelSmall,
            color = DorkTheme.colors.textTertiary,
            modifier = Modifier.padding(vertical = 10.dp)
          )
        }
      }
    }
  }
}
