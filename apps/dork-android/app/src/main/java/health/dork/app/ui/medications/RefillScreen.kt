package health.dork.app.ui.medications

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.RefillStatus
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar
import health.dork.app.core.util.shareText

@Composable
fun RefillScreen(
  medicationId: String,
  viewModel: RefillViewModel,
  onBackClick: () -> Unit,
  onDone: () -> Unit,
  modifier: Modifier = Modifier
) {
  val state by viewModel.uiState.collectAsState()
  val context = LocalContext.current

  LaunchedEffect(medicationId) { viewModel.load(medicationId) }

  val plan = state.plan ?: return
  val request = state.request

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Refill request",
      subtitle = plan.name,
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      DorkCard(contentPadding = DorkSpacing.m) {
        Column {
          Text(
            text = "${plan.name} ${plan.dosage}",
            style = MaterialTheme.typography.titleMedium,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = "${plan.frequency} · ${plan.duration}",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
          Spacer(modifier = Modifier.height(4.dp))
          Text(
            text = "Prescribed by ${plan.prescribingDoctor}",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textTertiary
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      if (request == null) {
        Text(
          text = "Where should it go?",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        DorkTextField(
          value = state.pharmacy,
          onValueChange = viewModel::onPharmacyChange,
          placeholder = "Pharmacy name"
        )

        Spacer(modifier = Modifier.height(DorkSpacing.m))
        Text(
          text = "Anything the prescriber should know? (optional)",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        DorkTextField(
          value = state.note,
          onValueChange = viewModel::onNoteChange,
          placeholder = "e.g. Running low, travelling next week",
          singleLine = false,
          maxLines = 3
        )

        state.error?.let {
          Spacer(modifier = Modifier.height(DorkSpacing.s))
          Text(text = it, style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.critical)
        }

        Spacer(modifier = Modifier.height(DorkSpacing.l))
        DorkButton(
          text = "Create refill request",
          onClick = viewModel::request,
          loading = state.isWorking
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xs))
        Text(
          text = "This creates a request on your device. You then send it to the clinic — Proton cannot transmit a prescription on its own.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textTertiary
        )
      } else {
        Row(modifier = Modifier.fillMaxWidth()) {
          Text(
            text = "Request status",
            style = MaterialTheme.typography.titleMedium,
            color = DorkTheme.colors.textPrimary,
            modifier = Modifier.weight(1f)
          )
          DorkStatusBadge(
            text = request.status.label,
            type = when (request.status) {
              RefillStatus.REQUESTED -> DorkStatusType.Warning
              RefillStatus.SHARED -> DorkStatusType.Info
              RefillStatus.COMPLETED -> DorkStatusType.Success
              RefillStatus.CANCELLED -> DorkStatusType.Critical
            }
          )
        }

        Spacer(modifier = Modifier.height(DorkSpacing.s))

        DorkCard(backgroundColor = DorkTheme.colors.surfaceSecondary, contentPadding = DorkSpacing.m) {
          Column {
            Text(
              text = request.medicationName + " " + request.dosage,
              style = MaterialTheme.typography.bodyMedium,
              color = DorkTheme.colors.textPrimary
            )
            Text(
              text = request.pharmacy,
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
            if (request.note.isNotBlank()) {
              Text(
                text = request.note,
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textTertiary
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(DorkSpacing.l))

        when (request.status) {
          RefillStatus.REQUESTED -> {
            Text(
              text = "Saved on this device. Send it to the clinic to start the refill.",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
            Spacer(modifier = Modifier.height(DorkSpacing.s))
            DorkButton(
              text = "Send to clinic",
              onClick = {
                val packet = viewModel.buildPacket() ?: return@DorkButton
                if (shareText(context, "Refill request · ${plan.name}", packet)) viewModel.markShared()
              }
            )
          }

          RefillStatus.SHARED -> {
            Text(
              text = "Sent. When the pharmacy hands it over, mark it filled so your list stays accurate.",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
            Spacer(modifier = Modifier.height(DorkSpacing.s))
            DorkButton(text = "Mark as filled", onClick = viewModel::markFilled)
          }

          RefillStatus.COMPLETED -> {
            Text(
              text = "Marked filled.",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.success
            )
            Spacer(modifier = Modifier.height(DorkSpacing.s))
            DorkButton(text = "Done", onClick = onDone)
          }

          RefillStatus.CANCELLED -> {
            DorkButton(text = "Done", onClick = onDone)
          }
        }

        if (request.status == RefillStatus.REQUESTED) {
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          DorkButton(text = "Cancel request", onClick = viewModel::cancel, variant = DorkButtonVariant.Ghost)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}
