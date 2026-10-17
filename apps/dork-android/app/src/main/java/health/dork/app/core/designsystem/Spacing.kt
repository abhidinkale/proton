package health.dork.app.core.designsystem

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Dork Spacing Scale Tokens.
 *
 * Consistent, rhythm-driven spacing scale for layout alignment across the app.
 */
object DorkSpacing {
  val xxs: Dp = 4.dp
  val xs: Dp = 8.dp
  val s: Dp = 12.dp
  val m: Dp = 16.dp
  val l: Dp = 20.dp
  val xl: Dp = 24.dp
  val xxl: Dp = 32.dp
  val xxxl: Dp = 40.dp
  val giant: Dp = 48.dp
  val mega: Dp = 64.dp

  // Component-specific standard metrics
  val minTouchTarget: Dp = 48.dp
  val cardPadding: Dp = 18.dp
  val screenHorizontalPadding: Dp = 20.dp
  val bottomBarHeight: Dp = 68.dp
  val topBarHeight: Dp = 56.dp
}
