package health.dork.app.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkTheme

enum class DorkNavDestination(
  val label: String,
  val icon: ImageVector
) {
  Home("Home", Icons.Rounded.Home),
  Care("Care", Icons.Rounded.Favorite),
  Records("Records", Icons.Rounded.Folder),
  Ai("Dork AI", Icons.Rounded.AutoAwesome),
  Profile("Profile", Icons.Rounded.Person)
}

/**
 * Floating pill tab bar.
 *
 * Sits above the canvas as a single white capsule; the active destination
 * becomes a dark pill that grows to reveal its label.
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
    Surface(
      shape = DorkShapes.pill,
      color = DorkTheme.colors.card,
      border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x0F14140F))
    ) {
      Row(
        modifier = Modifier.padding(6.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        DorkNavDestination.entries.forEach { destination ->
          val selected = destination == currentDestination

          Row(
            modifier = Modifier
              .clip(DorkShapes.pill)
              .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = { onNavigate(destination) }
              )
              .background(if (selected) DorkTheme.colors.textPrimary else Color.Transparent)
              .padding(horizontal = if (selected) 15.dp else 13.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Icon(
              imageVector = destination.icon,
              contentDescription = destination.label,
              tint = if (selected) Color.White else DorkTheme.colors.textTertiary,
              modifier = Modifier.size(19.dp)
            )

            if (selected) {
              Text(
                text = destination.label,
                style = MaterialTheme.typography.labelMedium,
                color = Color.White,
                modifier = Modifier.padding(start = 7.dp)
              )
            }
          }
        }
      }
    }
  }
}
