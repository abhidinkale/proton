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
        Color.White.copy(alpha = 0.45f),
        Color.White.copy(alpha = 0.18f),
        Color(0x24FFFFFF)
      )
    )

    // Frosted Glass Grayish Semi-Transparent Fill
    val glassBackground = Brush.verticalGradient(
      listOf(
        Color(0x994B5565), // Translucent cool gray (~60% opacity)
        Color(0xA6374151)  // Translucent slate gray (~65% opacity)
      )
    )

    Surface(
      shape = CircleShape,
      color = Color.Transparent,
      border = BorderStroke(1.2.dp, glassBorder),
      modifier = Modifier
        .shadow(
          elevation = 12.dp,
          shape = CircleShape,
          spotColor = Color.Black.copy(alpha = 0.25f),
          ambientColor = Color.Black.copy(alpha = 0.15f)
        )
        .background(brush = glassBackground, shape = CircleShape)
    ) {
      Row(
        modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        DorkNavDestination.entries.forEach { destination ->
          val selected = destination == currentDestination

          val animActiveBg by animateColorAsState(
            targetValue = if (selected) Color(0x38FFFFFF) else Color.Transparent,
            animationSpec = tween(durationMillis = 140, easing = FastOutSlowInEasing),
            label = "dock_tab_bg"
          )

          val animIconTint by animateColorAsState(
            targetValue = if (selected) Color.White else Color.White.copy(alpha = 0.65f),
            animationSpec = tween(durationMillis = 140, easing = FastOutSlowInEasing),
            label = "dock_icon_tint"
          )

          Box(
            modifier = Modifier
              .height(48.dp)
              .width(if (selected) 62.dp else 50.dp)
              .clip(RoundedCornerShape(24.dp))
              .background(animActiveBg)
              .clickable(
                onClick = { onNavigate(destination) }
              ),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = destination.icon,
              contentDescription = destination.label,
              tint = animIconTint,
              modifier = Modifier.size(if (selected) 22.dp else 20.dp)
            )
          }
        }
      }
    }
  }
}
