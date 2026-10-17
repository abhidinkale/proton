package health.dork.app.core.designsystem.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DorkTopBar(
  title: String,
  modifier: Modifier = Modifier,
  subtitle: String? = null,
  onBackClick: (() -> Unit)? = null,
  actions: @Composable (RowScope.() -> Unit) = {}
) {
  TopAppBar(
    title = {
      Column {
        Text(
          text = title,
          style = MaterialTheme.typography.titleLarge,
          color = DorkTheme.colors.textPrimary
        )
        if (subtitle != null) {
          Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }
    },
    navigationIcon = {
      if (onBackClick != null) {
        IconButton(onClick = onBackClick) {
          Icon(
            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
            contentDescription = "Back",
            tint = DorkTheme.colors.textPrimary,
            modifier = Modifier.size(24.dp)
          )
        }
      }
    },
    actions = actions,
    colors = TopAppBarDefaults.topAppBarColors(
      containerColor = MaterialTheme.colorScheme.background,
      navigationIconContentColor = DorkTheme.colors.textPrimary,
      titleContentColor = DorkTheme.colors.textPrimary,
      actionIconContentColor = DorkTheme.colors.textPrimary
    ),
    modifier = modifier
  )
}
