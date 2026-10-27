package health.dork.app.core.designsystem.components

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
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Videocam
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
enum class AppointmentStatus {
  Proposed,
  Pending,
  Booked,
  Confirmed,
  Arrived,
  Fulfilled,
  Cancelled
}

@Composable
fun DorkAppointmentCard(
  doctorName: String,
  specialty: String,
  dateTime: String,
  locationOrType: String,
  isVideo: Boolean,
  status: AppointmentStatus,
  modifier: Modifier = Modifier,
  onActionClick: (() -> Unit)? = null,
  actionText: String = "View appointment",
  onClick: (() -> Unit)? = null
) {
  val (statusText, statusType) = when (status) {
    AppointmentStatus.Confirmed -> Pair("Confirmed", DorkStatusType.Success)
    AppointmentStatus.Booked -> Pair("Booked", DorkStatusType.Info)
    AppointmentStatus.Pending, AppointmentStatus.Proposed -> Pair("Pending", DorkStatusType.Warning)
    AppointmentStatus.Arrived -> Pair("Checked in", DorkStatusType.Success)
    AppointmentStatus.Fulfilled -> Pair("Completed", DorkStatusType.Neutral)
    AppointmentStatus.Cancelled -> Pair("Cancelled", DorkStatusType.Critical)
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
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = doctorName,
            style = MaterialTheme.typography.titleMedium,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = specialty,
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }

        DorkStatusBadge(text = statusText, type = statusType)
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = Icons.Rounded.CalendarToday,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(16.dp)
          )
          Spacer(modifier = Modifier.width(DorkSpacing.xs))
          Text(
            text = dateTime,
            style = MaterialTheme.typography.labelMedium,
            color = DorkTheme.colors.textPrimary
          )
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = if (isVideo) Icons.Rounded.Videocam else Icons.Rounded.LocationOn,
            contentDescription = null,
            tint = DorkTheme.colors.textTertiary,
            modifier = Modifier.size(16.dp)
          )
          Spacer(modifier = Modifier.width(4.dp))
          Text(
            text = locationOrType,
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }

      if (onActionClick != null) {
        Spacer(modifier = Modifier.height(DorkSpacing.m))
        DorkButton(
          text = actionText,
          onClick = onActionClick,
          variant = DorkButtonVariant.Secondary
        )
      }
    }
  }
}
