package health.dork.app.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

@Composable
fun DorkTimelineItem(
  dateString: String,
  title: String,
  subtitle: String,
  icon: ImageVector,
  modifier: Modifier = Modifier,
  badgeText: String? = null,
  badgeType: DorkStatusType = DorkStatusType.Neutral,
  isLast: Boolean = false,
  onClick: () -> Unit
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
      .clickable(onClick = onClick)
      .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.xs)
  ) {
    // Timeline node indicator & line
    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      modifier = Modifier.width(36.dp)
    ) {
      Box(
        modifier = Modifier
          .size(32.dp)
          .clip(CircleShape)
          .background(MaterialTheme.colorScheme.primaryContainer),
        contentAlignment = Alignment.Center
      ) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(16.dp)
        )
      }

      if (!isLast) {
        Box(
          modifier = Modifier
            .width(2.dp)
            .height(56.dp)
            .background(DorkTheme.colors.surfaceBorderSubtle)
        )
      }
    }

    Spacer(modifier = Modifier.width(DorkSpacing.s))

    // Card Content
    DorkCard(
      modifier = Modifier
        .weight(1f)
        .padding(bottom = if (isLast) 0.dp else DorkSpacing.xs),
      contentPadding = DorkSpacing.m,
      onClick = onClick
    ) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = dateString,
            style = MaterialTheme.typography.labelSmall,
            color = DorkTheme.colors.textTertiary,
            modifier = Modifier.weight(1f)
          )

          if (badgeText != null) {
            DorkStatusBadge(text = badgeText, type = badgeType)
          }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
          text = title,
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )

        Spacer(modifier = Modifier.height(2.dp))

        Text(
          text = subtitle,
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    }
  }
}
