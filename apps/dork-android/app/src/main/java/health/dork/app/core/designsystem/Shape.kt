package health.dork.app.core.designsystem

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/**
 * Dork Corner Radius & Shape Tokens.
 *
 * Soft, generous radii: cards sit between 22dp and 30dp, controls are pills.
 */
object DorkShapes {
  val extraSmall = RoundedCornerShape(10.dp)
  val small = RoundedCornerShape(14.dp)
  val medium = RoundedCornerShape(18.dp)
  val large = RoundedCornerShape(24.dp)
  val extraLarge = RoundedCornerShape(28.dp)
  val hero = RoundedCornerShape(30.dp)
  val pill = RoundedCornerShape(100.dp)
}
