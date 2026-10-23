package health.dork.app.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
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
    DorkTheme.colors.textPrimary
  } else {
    DorkTheme.colors.card
  }

  val contentColor = if (selected) {
    Color.White
  } else {
    DorkTheme.colors.textSecondary
  }

  Surface(
    modifier = modifier.clickable(onClick = onClick),
    shape = DorkShapes.pill,
    color = backgroundColor,
    border = if (selected) null else BorderStroke(1.dp, DorkTheme.colors.surfaceBorderSubtle)
  ) {
    Row(
      modifier = Modifier.padding(horizontal = DorkSpacing.m, vertical = 8.dp),
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
