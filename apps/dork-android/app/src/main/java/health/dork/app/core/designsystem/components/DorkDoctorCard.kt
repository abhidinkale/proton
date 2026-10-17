package health.dork.app.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

@Composable
fun DorkDoctorCard(
  name: String,
  specialty: String,
  qualifications: String,
  clinicName: String,
  distance: String,
  availabilityText: String,
  modifier: Modifier = Modifier,
  rating: Double? = null,
  reviewCount: Int? = null,
  initials: String = name.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString(""),
  onBookClick: () -> Unit,
  onProfileClick: () -> Unit
) {
  DorkCard(
    modifier = modifier,
    onClick = onProfileClick,
    contentPadding = DorkSpacing.m
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        // Initials avatar
        Box(
          modifier = Modifier
            .size(52.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer),
          contentAlignment = Alignment.Center
        ) {
          Text(
            text = initials,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
          )
        }

        Spacer(modifier = Modifier.width(DorkSpacing.m))

        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = name,
            style = MaterialTheme.typography.titleMedium,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = "$specialty · $qualifications",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )

          if (rating != null && rating > 0.0) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              modifier = Modifier.padding(top = 2.dp)
            ) {
              Icon(
                imageVector = Icons.Rounded.Star,
                contentDescription = null,
                tint = DorkTheme.colors.warning,
                modifier = Modifier.size(14.dp)
              )
              Spacer(modifier = Modifier.width(2.dp))
              Text(
                text = String.format("%.1f", rating),
                style = MaterialTheme.typography.labelSmall,
                color = DorkTheme.colors.textPrimary
              )
              if (reviewCount != null) {
                Text(
                  text = " ($reviewCount)",
                  style = MaterialTheme.typography.bodySmall,
                  color = DorkTheme.colors.textTertiary
                )
              }
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = Icons.Rounded.LocationOn,
            contentDescription = null,
            tint = DorkTheme.colors.textTertiary,
            modifier = Modifier.size(15.dp)
          )
          Spacer(modifier = Modifier.width(4.dp))
          Text(
            text = "$clinicName · $distance",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }

        DorkStatusBadge(
          text = availabilityText,
          type = DorkStatusType.Success
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
      ) {
        DorkButton(
          text = "View profile",
          onClick = onProfileClick,
          variant = DorkButtonVariant.Secondary,
          modifier = Modifier.weight(1f)
        )
        DorkButton(
          text = "Book",
          onClick = onBookClick,
          variant = DorkButtonVariant.Primary,
          modifier = Modifier.weight(1f)
        )
      }
    }
  }
}
