package health.dork.app.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

@Composable
fun DorkChip(
  label: String,
  selected: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  leadingIcon: @Composable (() -> Unit)? = null
) {
  val backgroundColor = if (selected) {
    MaterialTheme.colorScheme.primaryContainer
  } else {
    DorkTheme.colors.surfaceSecondary
  }

  val contentColor = if (selected) {
    MaterialTheme.colorScheme.primary
  } else {
    DorkTheme.colors.textSecondary
  }

  val borderColor = if (selected) {
    MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
  } else {
    DorkTheme.colors.surfaceBorderSubtle
  }

  Surface(
    modifier = modifier.clickable(onClick = onClick),
    shape = DorkShapes.pill,
    color = backgroundColor,
    border = BorderStroke(1.dp, borderColor)
  ) {
    Row(
      modifier = Modifier.padding(horizontal = DorkSpacing.m, vertical = DorkSpacing.xs),
      verticalAlignment = Alignment.CenterVertically
    ) {
      if (leadingIcon != null) {
        leadingIcon()
        Spacer(modifier = Modifier.width(DorkSpacing.xs))
      }
      Text(
        text = label,
        style = MaterialTheme.typography.labelMedium,
        color = contentColor
      )
    }
  }
}
