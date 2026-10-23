package health.dork.app.core.designsystem.components

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.DorkType

enum class DorkTagTone {
  Lime,
  Ink,
  Neutral,
  Pink,
  Peach,
  Sage,
  Sky
}

/**
 * Small uppercase tag. Lime is reserved for synthetic/validated states, the
 * pastel tones carry clinical signal (allergy, dose due, stable).
 */
@Composable
fun DorkTag(
  text: String,
  modifier: Modifier = Modifier,
  tone: DorkTagTone = DorkTagTone.Neutral
) {
  val (background, foreground) = when (tone) {
    DorkTagTone.Lime -> DorkTheme.colors.lime to DorkTheme.colors.limeInk
    DorkTagTone.Ink -> DorkTheme.colors.textPrimary to Color.White
    DorkTagTone.Neutral -> DorkTheme.colors.surfaceSecondary to DorkTheme.colors.textSecondary
    DorkTagTone.Pink -> DorkTheme.colors.pink to DorkTheme.colors.pinkInk
    DorkTagTone.Peach -> DorkTheme.colors.peach to DorkTheme.colors.peachInk
    DorkTagTone.Sage -> DorkTheme.colors.sage to DorkTheme.colors.sageInk
    DorkTagTone.Sky -> DorkTheme.colors.sky to DorkTheme.colors.skyInk
  }

  Surface(
    modifier = modifier,
    shape = DorkShapes.pill,
    color = background
  ) {
    Text(
      text = text.uppercase(),
      style = DorkType.eyebrow,
      color = foreground,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
    )
  }
}
