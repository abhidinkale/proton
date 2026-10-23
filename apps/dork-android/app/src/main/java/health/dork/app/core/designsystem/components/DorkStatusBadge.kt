package health.dork.app.core.designsystem.components

import androidx.compose.foundation.BorderStroke
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

enum class DorkStatusType {
  Success,
  Warning,
  Critical,
  Info,
  Neutral
}

@Composable
fun DorkStatusBadge(
  text: String,
  type: DorkStatusType,
  modifier: Modifier = Modifier,
  leadingIcon: @Composable (() -> Unit)? = null
) {
  val (bgColor, textColor) = when (type) {
    DorkStatusType.Success -> DorkTheme.colors.successContainer to DorkTheme.colors.success
    DorkStatusType.Warning -> DorkTheme.colors.warningContainer to DorkTheme.colors.warning
    DorkStatusType.Critical -> DorkTheme.colors.criticalContainer to DorkTheme.colors.critical
    DorkStatusType.Info -> DorkTheme.colors.infoContainer to DorkTheme.colors.info
    DorkStatusType.Neutral -> DorkTheme.colors.surfaceSecondary to DorkTheme.colors.textSecondary
  }

  Surface(
    modifier = modifier,
    shape = DorkShapes.pill,
    color = bgColor
  ) {
    Row(
      modifier = Modifier.padding(horizontal = DorkSpacing.s, vertical = 4.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      if (leadingIcon != null) {
        leadingIcon()
        Spacer(modifier = Modifier.width(4.dp))
      }
      Text(
        text = text,
        style = MaterialTheme.typography.labelSmall,
        color = textColor
      )
    }
  }
}
