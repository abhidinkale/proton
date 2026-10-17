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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

@Composable
fun DorkCard(
  modifier: Modifier = Modifier,
  shape: Shape = DorkShapes.large,
  backgroundColor: Color = DorkTheme.colors.surfaceSecondary,
  borderColor: Color = DorkTheme.colors.surfaceBorderSubtle,
  borderWidth: Dp = 1.dp,
  onClick: (() -> Unit)? = null,
  contentPadding: Dp = DorkSpacing.cardPadding,
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
    border = BorderStroke(borderWidth, borderColor)
  ) {
    Box(
      modifier = Modifier.padding(contentPadding),
      content = content
    )
  }
}
