package health.dork.app.ui.care

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.OnsetBucket
import health.dork.app.core.data.model.ShareState
import health.dork.app.core.data.model.SymptomPattern
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar
import health.dork.app.core.util.shareText

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun IntakeScreen(
  appointmentId: String,
  viewModel: IntakeViewModel,
  onBackClick: () -> Unit,
  onFinished: () -> Unit,
  modifier: Modifier = Modifier
) {
  val state by viewModel.uiState.collectAsState()
  val context = LocalContext.current

  LaunchedEffect(appointmentId) { viewModel.load(appointmentId) }
  DisposableEffect(Unit) {
    onDispose { viewModel.persistDraft() }
  }

  val intake = state.intake
  val title = state.appointment?.doctorName ?: "Your care team"

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Pre-visit check-in",
      subtitle = state.appointment?.displayDateTime ?: "Before your visit",
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = DorkSpacing.screenHorizontalPadding)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Text(
          text = "Step ${state.step + 1} of ${IntakeViewModel.STEP_COUNT}",
          style = MaterialTheme.typography.labelSmall,
          color = DorkTheme.colors.textTertiary
        )
        Text(
          text = when (intake.state) {
            ShareState.Shared -> "Shared with clinic"
            ShareState.Completed -> "Completed · not sent"
            ShareState.Draft -> "Draft saved on device"
          },
          style = MaterialTheme.typography.labelSmall,
          color = when (intake.state) {
            ShareState.Shared -> DorkTheme.colors.success
            ShareState.Completed -> DorkTheme.colors.warning
            ShareState.Draft -> DorkTheme.colors.textTertiary
          }
        )
      }
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      LinearProgressIndicator(
        progress = { (state.step + 1f) / IntakeViewModel.STEP_COUNT },
        modifier = Modifier
          .fillMaxWidth()
          .height(6.dp),
        color = MaterialTheme.colorScheme.primary,
        trackColor = DorkTheme.colors.surfaceSecondary
      )
    }

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      when (state.step) {
        0 -> StepConcern(state, viewModel)
        1 -> StepPattern(state, viewModel)
        2 -> StepSymptoms(state, viewModel)
        else -> StepReview(state, viewModel, title)
      }

      state.error?.let {
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        Text(text = it, style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.critical)
      }

      state.savedMessage?.let {
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        Text(text = it, style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.success)
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      when {
        state.step < IntakeViewModel.LAST_STEP -> {
          DorkButton(text = "Continue", onClick = viewModel::next)
          if (state.step > 0) {
            Spacer(modifier = Modifier.height(DorkSpacing.xs))
            DorkButton(text = "Back", onClick = viewModel::back, variant = DorkButtonVariant.Ghost)
          }
        }

        !state.isComplete -> {
          DorkButton(
            text = "Save my answers",
            onClick = viewModel::complete,
            loading = state.isSaving,
            enabled = intake.mainConcern.isNotBlank()
          )
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          DorkButton(text = "Back", onClick = viewModel::back, variant = DorkButtonVariant.Ghost)
        }

        !state.isShared -> {
          Text(
            text = "Your answers are on this device. Nothing has been sent to $title yet.",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.s))
          DorkButton(
            text = "Send to clinic",
            onClick = {
              val packet = viewModel.buildPacket() ?: return@DorkButton
              val opened = shareText(
                context = context,
                subject = "Pre-visit check-in · ${state.appointment?.displayDateTime.orEmpty()}",
                body = packet
              )
              if (opened) viewModel.markShared()
            }
          )
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          DorkButton(
            text = "Finish later",
            onClick = { viewModel.persistDraft(); onFinished() },
            variant = DorkButtonVariant.Secondary
          )
        }

        else -> {
          DorkButton(text = "Done", onClick = onFinished)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepConcern(state: IntakeUiState, viewModel: IntakeViewModel) {
  Text(
    text = "What would you like to sort out?",
    style = MaterialTheme.typography.headlineSmall,
    color = DorkTheme.colors.textPrimary
  )
  Spacer(modifier = Modifier.height(DorkSpacing.xxs))
  Text(
    text = "Answer in your own words. Your clinician reads this before the visit.",
    style = MaterialTheme.typography.bodySmall,
    color = DorkTheme.colors.textSecondary
  )
  Spacer(modifier = Modifier.height(DorkSpacing.m))

  DorkTextField(
    value = state.intake.mainConcern,
    onValueChange = viewModel::onConcernChange,
    placeholder = "e.g. Cough that will not settle, worse in the cold",
    singleLine = false,
    maxLines = 3
  )

  Spacer(modifier = Modifier.height(DorkSpacing.l))
  Text(
    text = "When did it start?",
    style = MaterialTheme.typography.titleMedium,
    color = DorkTheme.colors.textPrimary
  )
  Spacer(modifier = Modifier.height(DorkSpacing.xs))
  FlowRow(
    horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs),
    verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
  ) {
    OnsetBucket.entries.forEach { onset ->
      DorkChip(
        label = onset.label,
        selected = state.intake.onset == onset,
        onClick = { viewModel.onOnsetChange(onset) }
      )
    }
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepPattern(state: IntakeUiState, viewModel: IntakeViewModel) {
  Text(
    text = "How has it been behaving?",
    style = MaterialTheme.typography.headlineSmall,
    color = DorkTheme.colors.textPrimary
  )
  Spacer(modifier = Modifier.height(DorkSpacing.m))

  FlowRow(
    horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs),
    verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
  ) {
    SymptomPattern.entries.forEach { pattern ->
      DorkChip(
        label = pattern.label,
        selected = state.intake.pattern == pattern,
        onClick = { viewModel.onPatternChange(pattern) }
      )
    }
  }

  Spacer(modifier = Modifier.height(DorkSpacing.l))
  Text(
    text = "How bad is it today? ${state.intake.severity}/10",
    style = MaterialTheme.typography.titleMedium,
    color = DorkTheme.colors.textPrimary
  )
  Text(
    text = "1 is barely noticeable, 10 is the worst you have felt.",
    style = MaterialTheme.typography.bodySmall,
    color = DorkTheme.colors.textTertiary
  )
  Slider(
    value = state.intake.severity.toFloat(),
    onValueChange = { viewModel.onSeverityChange(it.toInt()) },
    valueRange = 1f..10f,
    steps = 8,
    colors = SliderDefaults.colors(
      thumbColor = MaterialTheme.colorScheme.primary,
      activeTrackColor = MaterialTheme.colorScheme.primary
    )
  )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepSymptoms(state: IntakeUiState, viewModel: IntakeViewModel) {
  Text(
    text = "Anything else going on?",
    style = MaterialTheme.typography.headlineSmall,
    color = DorkTheme.colors.textPrimary
  )
  Text(
    text = "Optional — tap anything that applies.",
    style = MaterialTheme.typography.bodySmall,
    color = DorkTheme.colors.textSecondary
  )
  Spacer(modifier = Modifier.height(DorkSpacing.m))

  FlowRow(
    horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs),
    verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
  ) {
    symptomCatalog.forEach { symptom ->
      DorkChip(
        label = symptom,
        selected = state.intake.symptoms.contains(symptom),
        onClick = { viewModel.toggleSymptom(symptom) }
      )
    }
  }

  Spacer(modifier = Modifier.height(DorkSpacing.l))
  Text(
    text = "What have you already tried?",
    style = MaterialTheme.typography.titleMedium,
    color = DorkTheme.colors.textPrimary
  )
  Spacer(modifier = Modifier.height(DorkSpacing.xs))
  DorkTextField(
    value = state.intake.triedSoFar,
    onValueChange = viewModel::onTriedChange,
    placeholder = "e.g. Inhaler twice, paracetamol, rest",
    singleLine = false,
    maxLines = 2
  )
}

@Composable
private fun StepReview(state: IntakeUiState, viewModel: IntakeViewModel, doctorName: String) {
  val intake = state.intake

  Text(
    text = "Check before you send",
    style = MaterialTheme.typography.headlineSmall,
    color = DorkTheme.colors.textPrimary
  )
  Spacer(modifier = Modifier.height(DorkSpacing.xs))
  Text(
    text = "This is exactly what $doctorName will read.",
    style = MaterialTheme.typography.bodySmall,
    color = DorkTheme.colors.textSecondary
  )

  Spacer(modifier = Modifier.height(DorkSpacing.m))

  DorkCard(contentPadding = DorkSpacing.m) {
    Column {
      ReviewRow("Concern", intake.mainConcern.ifBlank { "—" })
      ReviewRow("Started", intake.onset?.label ?: "—")
      ReviewRow("Pattern", intake.pattern?.label ?: "—")
      ReviewRow("Severity", "${intake.severity}/10")
      if (intake.symptoms.isNotEmpty()) {
        ReviewRow("Also", intake.symptoms.joinToString(", "))
      }
      if (intake.triedSoFar.isNotBlank()) {
        ReviewRow("Tried", intake.triedSoFar)
      }
      ReviewRow("Allergies", intake.allergies.ifBlank { "None recorded" })
    }
  }

  Spacer(modifier = Modifier.height(DorkSpacing.m))
  Text(
    text = "Anything you want to ask?",
    style = MaterialTheme.typography.titleMedium,
    color = DorkTheme.colors.textPrimary
  )
  Spacer(modifier = Modifier.height(DorkSpacing.xs))
  DorkTextField(
    value = intake.questionsForDoctor,
    onValueChange = viewModel::onQuestionsChange,
    placeholder = "e.g. Can I stop the inhaler when the cough clears?",
    singleLine = false,
    maxLines = 3
  )
}

@Composable
private fun ReviewRow(label: String, value: String) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(vertical = 3.dp)
  ) {
    Text(
      text = label,
      style = MaterialTheme.typography.bodySmall,
      color = DorkTheme.colors.textTertiary,
      modifier = Modifier.weight(0.34f)
    )
    Text(
      text = value,
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textPrimary,
      modifier = Modifier.weight(0.66f)
    )
  }
}

private val symptomCatalog = listOf(
  "Cough",
  "Fever",
  "Headache",
  "Sore throat",
  "Shortness of breath",
  "Chest tightness",
  "Fatigue",
  "Nausea",
  "Dizziness",
  "Skin rash",
  "Joint pain",
  "Trouble sleeping"
)
