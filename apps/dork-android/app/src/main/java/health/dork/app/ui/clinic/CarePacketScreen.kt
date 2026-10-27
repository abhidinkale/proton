package health.dork.app.ui.clinic

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkTopBar
import health.dork.app.core.util.copyToClipboard
import health.dork.app.core.util.shareText

/**
 * Shows the exact text that will leave the device. No hidden fields, no implied
 * transmission — the patient reads it before it moves.
 */
@Composable
fun CarePacketScreen(
  viewModel: ClinicViewModel,
  onBackClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val state by viewModel.uiState.collectAsState()
  val context = LocalContext.current
  val packet = remember(state.link, state.shareLog.size) { viewModel.buildPacket() }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Your summary",
      subtitle = "This is exactly what leaves your phone",
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      DorkCard(backgroundColor = DorkTheme.colors.surfaceSecondary, contentPadding = DorkSpacing.m) {
        Text(
          text = packet,
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textPrimary,
          modifier = Modifier.fillMaxWidth()
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      DorkButton(
        text = "Send to clinic",
        onClick = {
          val destination = state.link?.clinicName ?: "Your clinic"
          if (shareText(context, "Patient summary for $destination", packet)) {
            viewModel.recordShare("Patient summary")
          }
        }
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      DorkButton(
        text = "Copy text",
        onClick = { copyToClipboard(context, "Patient summary", packet) },
        variant = DorkButtonVariant.Secondary
      )

      Spacer(modifier = Modifier.height(DorkSpacing.l))
      Text(
        text = "Sending opens your own email, messaging or print app. Proton does not deliver this itself, and it does not keep a copy anywhere but this phone.",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}
