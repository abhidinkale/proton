package health.dork.app.core.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

@Composable
fun DorkErrorState(
  message: String,
  onRetry: () -> Unit,
  modifier: Modifier = Modifier,
  title: String = "Something went wrong"
) {
  Column(
    modifier = modifier
      .fillMaxWidth()
      .padding(DorkSpacing.xxl),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center
  ) {
    Icon(
      imageVector = Icons.Rounded.ErrorOutline,
      contentDescription = null,
      tint = DorkTheme.colors.critical,
      modifier = Modifier.size(52.dp)
    )

    Spacer(modifier = Modifier.height(DorkSpacing.m))

    Text(
      text = title,
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textPrimary,
      textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(DorkSpacing.xs))

    Text(
      text = message,
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textSecondary,
      textAlign = TextAlign.Center
    )

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    DorkButton(
      text = "Try again",
      onClick = onRetry,
      variant = DorkButtonVariant.Secondary,
      fullWidth = false
    )
  }
}
