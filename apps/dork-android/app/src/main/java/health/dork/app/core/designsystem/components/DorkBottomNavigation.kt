package health.dork.app.core.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
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

@Composable
fun DorkBottomNavigation(
  currentDestination: DorkNavDestination,
  onNavigate: (DorkNavDestination) -> Unit,
  modifier: Modifier = Modifier
) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.surface,
    tonalElevation = 2.dp
  ) {
    Column {
      HorizontalDivider(
        color = DorkTheme.colors.surfaceBorderSubtle,
        thickness = 1.dp
      )
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .height(DorkSpacing.bottomBarHeight)
          .padding(horizontal = DorkSpacing.xs),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically
      ) {
        DorkNavDestination.entries.forEach { destination ->
          val selected = destination == currentDestination
          val tint = if (selected) MaterialTheme.colorScheme.primary else DorkTheme.colors.textTertiary

          Box(
            modifier = Modifier
              .weight(1f)
              .height(DorkSpacing.bottomBarHeight)
              .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = { onNavigate(destination) }
              ),
            contentAlignment = Alignment.Center
          ) {
            Column(
              horizontalAlignment = Alignment.CenterHorizontally,
              verticalArrangement = Arrangement.Center
            ) {
              Icon(
                imageVector = destination.icon,
                contentDescription = destination.label,
                tint = tint,
                modifier = Modifier.size(24.dp)
              )
              Text(
                text = destination.label,
                style = MaterialTheme.typography.labelSmall,
                color = tint,
                modifier = Modifier.padding(top = 2.dp)
              )
            }
          }
        }
      }
    }
  }
}
