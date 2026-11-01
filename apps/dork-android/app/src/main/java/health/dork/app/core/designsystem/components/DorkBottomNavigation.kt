package health.dork.app.core.designsystem.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkTheme

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
 * Floating pill tab bar with butter-smooth spring expansion and fluid color transitions.
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
      .padding(horizontal = 20.dp, vertical = 10.dp),
    contentAlignment = Alignment.Center
  ) {
    val isDark = isSystemInDarkTheme()
    val selectedBg = if (isDark) Color.White else DorkTheme.colors.textPrimary
    val selectedContent = if (isDark) Color(0xFF0B0E14) else Color.White

    Surface(
      shape = DorkShapes.pill,
      color = DorkTheme.colors.card,
      shadowElevation = if (isDark) 2.dp else 12.dp,
      border = androidx.compose.foundation.BorderStroke(1.dp, DorkTheme.colors.surfaceBorder)
    ) {
      Row(
        modifier = Modifier.padding(6.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        DorkNavDestination.entries.forEach { destination ->
          val selected = destination == currentDestination

          val animBg by animateColorAsState(
            targetValue = if (selected) selectedBg else Color.Transparent,
            animationSpec = tween(durationMillis = 200, easing = FastOutSlowInEasing),
            label = "tab_bg"
          )
          val animContent by animateColorAsState(
            targetValue = if (selected) selectedContent else DorkTheme.colors.textTertiary,
            animationSpec = tween(durationMillis = 200, easing = FastOutSlowInEasing),
            label = "tab_content"
          )

          Row(
            modifier = Modifier
              .clip(DorkShapes.pill)
              .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = { onNavigate(destination) }
              )
              .background(animBg)
              .animateContentSize(
                animationSpec = spring(
                  dampingRatio = Spring.DampingRatioNoBouncy,
                  stiffness = Spring.StiffnessMediumLow
                )
              )
              .padding(horizontal = if (selected) 15.dp else 13.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Icon(
              imageVector = destination.icon,
              contentDescription = destination.label,
              tint = animContent,
              modifier = Modifier.size(19.dp)
            )

            AnimatedVisibility(
              visible = selected,
              enter = fadeIn(animationSpec = tween(140, delayMillis = 40)) + expandHorizontally(),
              exit = fadeOut(animationSpec = tween(100)) + shrinkHorizontally()
            ) {
              Text(
                text = destination.label,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = animContent,
                modifier = Modifier.padding(start = 7.dp),
                maxLines = 1
              )
            }
          }
        }
      }
    }
  }
}
