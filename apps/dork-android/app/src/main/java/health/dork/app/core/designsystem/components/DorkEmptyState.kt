package health.dork.app.core.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

@Composable
fun DorkEmptyState(
  title: String,
  description: String,
  icon: ImageVector,
  modifier: Modifier = Modifier,
  actionText: String? = null,
  onActionClick: (() -> Unit)? = null
) {
  Column(
    modifier = modifier
      .fillMaxWidth()
      .padding(DorkSpacing.xxl),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center
  ) {
    Icon(
      imageVector = icon,
      contentDescription = null,
      tint = DorkTheme.colors.textTertiary,
      modifier = Modifier.size(56.dp)
    )

    Spacer(modifier = Modifier.height(DorkSpacing.m))

    Text(
      text = title,
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textPrimary,
      textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(DorkSpacing.xs))

    Text(
      text = description,
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textSecondary,
      textAlign = TextAlign.Center
    )

    if (actionText != null && onActionClick != null) {
      Spacer(modifier = Modifier.height(DorkSpacing.l))
      DorkButton(
        text = actionText,
        onClick = onActionClick,
        variant = DorkButtonVariant.Secondary,
        fullWidth = false
      )
    }
  }
}
