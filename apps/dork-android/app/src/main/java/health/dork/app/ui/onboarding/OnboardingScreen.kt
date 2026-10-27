package health.dork.app.ui.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.BiologicalSex
import health.dork.app.core.data.model.BloodGroup
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OnboardingScreen(
  viewModel: OnboardingViewModel,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Health Profile",
      subtitle = "Step ${uiState.currentStep} of 13",
      onBackClick = if (uiState.currentStep > 1) viewModel::previousStep else null
    )

    LinearProgressIndicator(
      progress = { uiState.currentStep / 13f },
      modifier = Modifier.fillMaxWidth().height(3.dp),
      color = MaterialTheme.colorScheme.primary,
      trackColor = DorkTheme.colors.surfaceBorderSubtle
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.xl),
      verticalArrangement = Arrangement.SpaceBetween
    ) {
      Box(modifier = Modifier.weight(1f)) {
        AnimatedContent(
          targetState = uiState.currentStep,
          transitionSpec = { fadeIn() togetherWith fadeOut() },
          label = "onboarding_step"
        ) { step ->
          when (step) {
            1 -> StepWelcome()
            2 -> StepAccount(uiState, viewModel)
            3 -> StepName(uiState, viewModel)
            4 -> StepDateOfBirth(uiState, viewModel)
            5 -> StepSex(uiState, viewModel)
            6 -> StepHeight(uiState, viewModel)
            7 -> StepWeight(uiState, viewModel)
            8 -> StepBloodGroup(uiState, viewModel)
            9 -> StepConditions(uiState, viewModel)
            10 -> StepAllergies(uiState, viewModel)
            11 -> StepMedications(uiState, viewModel)
            12 -> StepEmergencyContact(uiState, viewModel)
            13 -> StepComplete(uiState)
            else -> StepWelcome()
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      if (uiState.errorMessage != null) {
        Text(
          text = uiState.errorMessage.orEmpty(),
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.critical,
          modifier = Modifier.padding(bottom = DorkSpacing.s, start = 4.dp)
        )
      }

      DorkButton(
        text = if (uiState.currentStep == 13) "Complete & enter Dork" else "Continue",
        onClick = viewModel::nextStep,
        loading = uiState.isSubmitting,
        enabled = !uiState.isSubmitting
      )
    }
  }
}

@Composable
private fun StepWelcome() {
  Column(
    modifier = Modifier.fillMaxWidth(),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    Box(
      modifier = Modifier
        .size(72.dp)
        .clip(CircleShape)
        .background(MaterialTheme.colorScheme.primaryContainer),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = Icons.Rounded.Favorite,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.size(36.dp)
      )
    }
    Spacer(modifier = Modifier.height(DorkSpacing.l))
    Text(
      text = "Welcome to Dork",
      style = MaterialTheme.typography.displayMedium,
      color = DorkTheme.colors.textPrimary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(
      text = "“Your health, organized.”",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.l))
    Text(
      text = "We will help you create a secure, clinical-grade personal health profile. You can complete optional fields anytime.",
      style = MaterialTheme.typography.bodyLarge,
      color = DorkTheme.colors.textSecondary
    )
  }
}

@Composable
private fun StepAccount(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "Create your account", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(
      text = "Your account is verified on this device. Your password is stretched with PBKDF2 and never stored in plain text.",
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.xl))
    DorkTextField(
      value = uiState.email,
      onValueChange = viewModel::onEmailChange,
      label = "Email address",
      placeholder = "you@example.com",
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
    )
    Spacer(modifier = Modifier.height(DorkSpacing.m))
    DorkTextField(
      value = uiState.password,
      onValueChange = viewModel::onPasswordChange,
      label = "Password",
      placeholder = "At least 8 characters",
      visualTransformation = PasswordVisualTransformation(),
      helperText = "Use at least 8 characters. You will need this to sign in again.",
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
    )
    Spacer(modifier = Modifier.height(DorkSpacing.m))
    DorkTextField(
      value = uiState.confirmPassword,
      onValueChange = viewModel::onConfirmPasswordChange,
      label = "Confirm password",
      placeholder = "Repeat your password",
      visualTransformation = PasswordVisualTransformation(),
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
    )
  }
}

@Composable
private fun StepName(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "What is your full legal name?", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(text = "Used for matching prescriptions and official clinical records.", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Spacer(modifier = Modifier.height(DorkSpacing.xl))
    DorkTextField(value = uiState.fullName, onValueChange = viewModel::onNameChange, label = "Full name", placeholder = "e.g. Alex Morgan")
  }
}

@Composable
private fun StepDateOfBirth(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "When were you born?", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(text = "Date of birth is authoritative. We dynamically calculate your age.", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkTextField(
      value = uiState.birthDateIso,
      onValueChange = viewModel::onDobChange,
      label = "Date of birth (YYYY-MM-DD)",
      placeholder = "1998-05-12",
      helperText = if (uiState.birthDateIso.isBlank()) {
        "Example: 1998-05-12"
      } else {
        "Formatted: ${uiState.formattedBirthDate} · Calculated age: ${uiState.calculatedAge} years"
      }
    )
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepSex(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "Biological sex assigned at birth", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(text = "Used to establish clinical reference ranges for diagnostic tests.", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)) {
      BiologicalSex.entries.forEach { sex ->
        DorkChip(
          label = sex.displayName,
          selected = uiState.sex == sex,
          onClick = { viewModel.onSexChange(sex) }
        )
      }
    }
  }
}

@Composable
private fun StepHeight(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "What is your height?", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(text = "Used alongside weight to track body metrics and medication dosages.", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Spacer(modifier = Modifier.height(DorkSpacing.xl))
    DorkTextField(
      value = if (uiState.heightCm > 0.0) uiState.heightCm.toString() else "",
      onValueChange = { it.toDoubleOrNull()?.let(viewModel::onHeightChange) },
      label = "Height (cm)",
      placeholder = "e.g. 172",
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
    )
  }
}

@Composable
private fun StepWeight(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "What is your current weight?", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(
      text = "Calculated BMI: ${uiState.bmi ?: "--"} kg/m²",
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.primary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.xl))
    DorkTextField(
      value = if (uiState.weightKg > 0.0) uiState.weightKg.toString() else "",
      onValueChange = { it.toDoubleOrNull()?.let(viewModel::onWeightChange) },
      label = "Weight (kg)",
      placeholder = "e.g. 68.5",
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
    )
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepBloodGroup(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "Blood group", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(text = "Essential for emergency medical services and transfusions.", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    FlowRow(
      horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s),
      verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)
    ) {
      BloodGroup.entries.forEach { bg ->
        DorkChip(
          label = bg.display,
          selected = uiState.bloodGroup == bg,
          onClick = { viewModel.onBloodGroupChange(bg) }
        )
      }
    }
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepConditions(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  val options = listOf("None", "Diabetes", "Hypertension", "Asthma", "Heart condition", "Thyroid condition", "Migraine", "Other")
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "Medical conditions", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(text = "Select any conditions diagnosed by a physician.", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    FlowRow(
      horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s),
      verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)
    ) {
      options.forEach { condition ->
        DorkChip(
          label = condition,
          selected = uiState.selectedConditions.contains(condition),
          onClick = { viewModel.toggleCondition(condition) }
        )
      }
    }
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepAllergies(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  val commonAllergies = listOf("Penicillin", "Sulfa drugs", "Aspirin", "Peanuts", "Shellfish", "Latex", "Pollen / Seasonal")
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "Allergies", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(text = "Select known allergies or type custom ones below.", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    FlowRow(
      horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s),
      verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)
    ) {
      commonAllergies.forEach { allergy ->
        DorkChip(
          label = allergy,
          selected = uiState.selectedAllergies.contains(allergy),
          onClick = { viewModel.toggleAllergy(allergy) }
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    Row(verticalAlignment = Alignment.CenterVertically) {
      DorkTextField(
        value = uiState.customAllergyInput,
        onValueChange = viewModel::onCustomAllergyChange,
        placeholder = "Add other allergy...",
        modifier = Modifier.weight(1f)
      )
      Spacer(modifier = Modifier.width(DorkSpacing.s))
      DorkButton(
        text = "Add",
        onClick = viewModel::addCustomAllergy,
        variant = DorkButtonVariant.Secondary,
        fullWidth = false
      )
    }
  }
}

@Composable
private fun StepMedications(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "Current medications", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(text = "List prescription or over-the-counter medications you take regularly.", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkTextField(
      value = uiState.currentMedications,
      onValueChange = viewModel::onMedicationsChange,
      label = "Medications (comma-separated)",
      placeholder = "e.g. Amoxicillin 500mg, Inhaler",
      singleLine = false,
      maxLines = 3
    )
  }
}

@Composable
private fun StepEmergencyContact(uiState: OnboardingUiState, viewModel: OnboardingViewModel) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "Emergency contact", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(text = "Will be shown on your Emergency Medical ID.", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkTextField(
      value = uiState.emergencyContactName,
      onValueChange = { viewModel.onEmergencyContactChange(it, uiState.emergencyContactRelation, uiState.emergencyContactPhone) },
      label = "Contact name"
    )
    Spacer(modifier = Modifier.height(DorkSpacing.m))
    DorkTextField(
      value = uiState.emergencyContactRelation,
      onValueChange = { viewModel.onEmergencyContactChange(uiState.emergencyContactName, it, uiState.emergencyContactPhone) },
      label = "Relationship"
    )
    Spacer(modifier = Modifier.height(DorkSpacing.m))
    DorkTextField(
      value = uiState.emergencyContactPhone,
      onValueChange = { viewModel.onEmergencyContactChange(uiState.emergencyContactName, uiState.emergencyContactRelation, it) },
      label = "Phone number",
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
    )
  }
}

@Composable
private fun StepComplete(uiState: OnboardingUiState) {
  Column(
    modifier = Modifier.fillMaxWidth(),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    Box(
      modifier = Modifier
        .size(72.dp)
        .clip(CircleShape)
        .background(DorkTheme.colors.successContainer),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = Icons.Rounded.CheckCircle,
        contentDescription = null,
        tint = DorkTheme.colors.success,
        modifier = Modifier.size(44.dp)
      )
    }
    Spacer(modifier = Modifier.height(DorkSpacing.l))
    Text(
      text = "Profile complete",
      style = MaterialTheme.typography.displayMedium,
      color = DorkTheme.colors.textPrimary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(
      text = "“You can add more information anytime.”",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.l))
    DorkCard(contentPadding = DorkSpacing.m) {
      Column {
        Text(text = uiState.fullName, style = MaterialTheme.typography.titleMedium, color = DorkTheme.colors.textPrimary)
        Text(text = uiState.email, style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.textSecondary)
        Text(text = "DOB: ${uiState.formattedBirthDate} · Blood: ${uiState.bloodGroup.display}", style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.textSecondary)
        Text(
          text = "Height: ${if (uiState.heightCm > 0) "${uiState.heightCm} cm" else "not set"} · " +
            "Weight: ${if (uiState.weightKg > 0) "${uiState.weightKg} kg" else "not set"}",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    }
  }
}
