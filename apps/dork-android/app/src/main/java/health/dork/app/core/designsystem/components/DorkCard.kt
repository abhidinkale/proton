package health.dork.app.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

/**
 * Borderless white card on the warm canvas.
 *
 * The shadow is intentionally wide and faint — it lifts the card off the paper
 * without drawing a visible edge.
 */
@Composable
fun DorkCard(
  modifier: Modifier = Modifier,
  shape: Shape = DorkShapes.large,
  backgroundColor: Color = DorkTheme.colors.card,
  borderColor: Color = Color.Transparent,
  borderWidth: Dp = 0.dp,
  onClick: (() -> Unit)? = null,
  contentPadding: Dp = DorkSpacing.cardPadding,
  elevated: Boolean = false,
  content: @Composable BoxScope.() -> Unit
) {
  val clickModifier = if (onClick != null) {
    Modifier
      .clip(shape)
      .clickable(onClick = onClick)
  } else {
    Modifier.clip(shape)
  }

  Surface(
    modifier = modifier
      .fillMaxWidth()
      .then(clickModifier),
    shape = shape,
    color = backgroundColor,
    border = if (borderWidth > 0.dp) BorderStroke(borderWidth, borderColor) else null
  ) {
    Box(
      modifier = Modifier.padding(contentPadding),
      content = content
    )
  }
}
