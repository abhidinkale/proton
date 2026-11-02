package health.dork.app.core.designsystem.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

enum class DorkNavDestination(
  val label: String,
  val icon: ImageVector
) {
  Home("Home", Icons.Rounded.Home),
  Care("Care", Icons.Rounded.Favorite),
  Cases("Cases", Icons.Rounded.Folder),
  Ai("Dork AI", Icons.Rounded.AutoAwesome),
  Profile("Profile", Icons.Rounded.Person)
}

/**
 * 3D Floating Glassmorphic Dock.
 * Directly matches the reference design from Easel (clean_17.jpg):
 * - Pill-shaped floating capsule detached from edges
 * - Frosted glassmorphism background with specular gradient border
 * - Deep 3D elevation shadow
 * - Sleek active capsule tab indicator with smooth spring physics
 * - Minimal, uncluttered icon-only rhythm
 */
@Composable
fun DorkBottomNavigation(
  currentDestination: DorkNavDestination,
  onNavigate: (DorkNavDestination) -> Unit,
  modifier: Modifier = Modifier
) {
  Box(
    modifier = modifier
      .fillMaxWidth()
      .navigationBarsPadding()
      .padding(horizontal = 26.dp, vertical = 14.dp),
    contentAlignment = Alignment.Center
  ) {
    // 3D Glassmorphism Specular Border Brush
    val glassBorder = Brush.verticalGradient(
      listOf(
        Color.White.copy(alpha = 0.38f),
        Color.White.copy(alpha = 0.12f),
        Color(0x18FFFFFF)
      )
    )

    // Frosted Glass Dark Fill
    val glassBackground = Brush.verticalGradient(
      listOf(
        Color(0xCC161B26),
        Color(0xDD0D111A)
      )
    )

    Surface(
      shape = CircleShape,
      color = Color.Transparent,
      border = BorderStroke(1.2.dp, glassBorder),
      modifier = Modifier
        .shadow(
          elevation = 22.dp,
          shape = CircleShape,
          spotColor = Color.Black.copy(alpha = 0.50f),
          ambientColor = Color.Black.copy(alpha = 0.35f)
        )
        .background(brush = glassBackground, shape = CircleShape)
    ) {
      Row(
        modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        DorkNavDestination.entries.forEach { destination ->
          val selected = destination == currentDestination

          val animActiveBg by animateColorAsState(
            targetValue = if (selected) Color(0x38FFFFFF) else Color.Transparent,
            animationSpec = spring(
              dampingRatio = Spring.DampingRatioLowBouncy,
              stiffness = Spring.StiffnessMedium
            ),
            label = "dock_tab_bg"
          )

          val animIconTint by animateColorAsState(
            targetValue = if (selected) Color.White else Color.White.copy(alpha = 0.55f),
            animationSpec = tween(durationMillis = 160, easing = FastOutSlowInEasing),
            label = "dock_icon_tint"
          )

          val animActiveBorder by animateColorAsState(
            targetValue = if (selected) Color.White.copy(alpha = 0.25f) else Color.Transparent,
            animationSpec = tween(durationMillis = 160),
            label = "dock_border"
          )

          Box(
            modifier = Modifier
              .height(44.dp)
              .width(if (selected) 58.dp else 46.dp)
              .clip(RoundedCornerShape(22.dp))
              .background(animActiveBg)
              .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = { onNavigate(destination) }
              ),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = destination.icon,
              contentDescription = destination.label,
              tint = animIconTint,
              modifier = Modifier.size(if (selected) 21.dp else 19.dp)
            )
          }
        }
      }
    }
  }
}
