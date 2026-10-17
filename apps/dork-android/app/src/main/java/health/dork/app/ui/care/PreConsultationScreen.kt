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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PreConsultationScreen(
  appointmentId: String,
  doctorName: String,
  onBackClick: () -> Unit,
  onSubmitDone: () -> Unit,
  viewModel: CareViewModel,
  modifier: Modifier = Modifier
) {
  var complaint by remember { mutableStateOf("Seasonal bronchospasm & dry cough") }
  var onset by remember { mutableStateOf("Started 5 days ago") }
  var severity by remember { mutableFloatStateOf(3f) }
  var selectedSymptoms by remember { mutableStateOf(setOf("Cough", "Cold air sensitivity")) }
  val scrollState = rememberScrollState()

  val symptomOptions = listOf("Cough", "Fever", "Headache", "Cold air sensitivity", "Fatigue", "Shortness of breath", "Throat irritation")

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Pre-consultation",
      subtitle = "For appointment with $doctorName",
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      Text(
        text = "Help Dr. Chen prepare for your visit",
        style = MaterialTheme.typography.headlineSmall,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Text(
        text = "This structured summary will be securely shared with your physician before the consultation begins.",
        style = MaterialTheme.typography.bodyMedium,
        color = DorkTheme.colors.textSecondary
      )

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // 1. What brings you here?
      Text(text = "What brings you here?", style = MaterialTheme.typography.titleMedium, color = DorkTheme.colors.textPrimary)
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      DorkTextField(
        value = complaint,
        onValueChange = { complaint = it },
        placeholder = "Describe what you would like to address..."
      )

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      // 2. When did it start?
      Text(text = "When did it start?", style = MaterialTheme.typography.titleMedium, color = DorkTheme.colors.textPrimary)
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      DorkTextField(
        value = onset,
        onValueChange = { onset = it },
        placeholder = "e.g. 3 days ago, yesterday morning..."
      )

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      // 3. How severe is it? (1 - 10)
      Text(
        text = "Severity: ${severity.toInt()} / 10",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Slider(
        value = severity,
        onValueChange = { severity = it },
        valueRange = 1f..10f,
        steps = 8,
        colors = SliderDefaults.colors(
          thumbColor = MaterialTheme.colorScheme.primary,
          activeTrackColor = MaterialTheme.colorScheme.primary
        )
      )

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      // 4. Symptoms present
      Text(text = "Select any present symptoms", style = MaterialTheme.typography.titleMedium, color = DorkTheme.colors.textPrimary)
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs),
        verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
      ) {
        symptomOptions.forEach { symptom ->
          DorkChip(
            label = symptom,
            selected = selectedSymptoms.contains(symptom),
            onClick = {
              selectedSymptoms = if (selectedSymptoms.contains(symptom)) {
                selectedSymptoms - symptom
              } else {
                selectedSymptoms + symptom
              }
            }
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      DorkButton(
        text = "Save pre-consultation summary",
        onClick = {
          viewModel.submitPreConsultation(
            appointmentId = appointmentId,
            complaint = complaint,
            onset = onset,
            severity = severity.toInt(),
            symptoms = selectedSymptoms.toList()
          )
          onSubmitDone()
        }
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}
