package health.dork.app.ui.onboarding

import android.app.DatePickerDialog
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.data.model.BiologicalSex
import health.dork.app.core.data.model.BloodGroup
import health.dork.app.core.designsystem.DorkGradients
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar
import java.time.LocalDate
import java.util.Calendar
import java.util.Locale

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
    OnboardingHero(
      step = uiState.currentStep,
      total = TOTAL_STEPS,
      onBack = if (uiState.currentStep > 1 && uiState.currentStep < 13) viewModel::previousStep else null
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l),
      verticalArrangement = Arrangement.SpaceBetween
    ) {
      Box(modifier = Modifier.weight(1f)) {
        AnimatedContent(
          targetState = uiState.currentStep,
          transitionSpec = {
            // A short horizontal slide in the direction of travel. It reads as
            // "next page" rather than "new screen", which is what a wizard is.
            (slideInHorizontally(animationSpec = tween(260)) { it / 8 } + fadeIn(tween(220))) togetherWith
              (slideOutHorizontally(animationSpec = tween(200)) { -it / 10 } + fadeOut(tween(160)))
          },
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

      Spacer(modifier = Modifier.height(DorkSpacing.l))

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

private const val TOTAL_STEPS = 13

/**
 * The band at the top of every step.
 *
 * Onboarding is the one place in this product where colour is decoration rather
 * than signal. A medical intake that looks like a tax form is an intake people
 * abandon, and the person filling this in is doing it in a waiting room, at
 * night, on a bad connection, about something they are worried about.
 *
 * The gradient is deterministic per step, so backing up and returning does not
 * reshuffle the visuals and make the patient think they lost their place.
 */
@Composable
private fun OnboardingHero(step: Int, total: Int, onBack: (() -> Unit)?) {
  val palette = DorkGradients.heroFor(step)
  val start by animateColorAsState(palette[0], tween(600), label = "hero-start")
  val end by animateColorAsState(palette[1], tween(600), label = "hero-end")
  val progress by animateFloatAsState(
    targetValue = (step / total.toFloat()).coerceIn(0f, 1f),
    animationSpec = tween(450),
    label = "hero-progress"
  )

  val kicker = when (step) {
    1 -> "Welcome"
    in 2..3 -> "Your details"
    in 4..8 -> "About you"
    in 9..11 -> "Your health"
    12 -> "Safety"
    else -> "Ready"
  }

  val title = when (step) {
    1 -> "Hello."
    in 2..3 -> "Let's set you up."
    in 4..8 -> "A little about you."
    in 9..11 -> "In your own words."
    12 -> "Who should we call?"
    else -> "You're all set."
  }

  Box(
    modifier = Modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(bottomStart = 30.dp, bottomEnd = 30.dp))
      .background(Brush.linearGradient(listOf(start, end)))
      .padding(start = DorkSpacing.screenHorizontalPadding, end = DorkSpacing.screenHorizontalPadding, top = DorkSpacing.m, bottom = DorkSpacing.l)
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        if (onBack != null) {
          Box(
            modifier = Modifier
              .size(30.dp)
              .clip(CircleShape)
              .background(Color.White.copy(alpha = 0.18f))
              .clickable(onClick = onBack),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
              contentDescription = "Back",
              tint = Color.White,
              modifier = Modifier.size(16.dp)
            )
          }
          Spacer(modifier = Modifier.width(DorkSpacing.s))
        }

        Text(
          text = kicker.uppercase(Locale.US),
          style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.4.sp),
          color = Color.White.copy(alpha = 0.85f),
          modifier = Modifier.weight(1f)
        )

        Text(
          text = "$step / $total",
          style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 0.8.sp),
          color = Color.White.copy(alpha = 0.85f)
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      AnimatedContent(
        targetState = title,
        transitionSpec = { fadeIn(tween(220)) togetherWith fadeOut(tween(120)) },
        label = "hero-title"
      ) { line ->
        Text(
          text = line,
          style = MaterialTheme.typography.displaySmall,
          color = Color.White
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(4.dp)
          .clip(CircleShape)
          .background(Color.White.copy(alpha = 0.25f))
      ) {
        Box(
          modifier = Modifier
            .fillMaxWidth(progress)
            .height(4.dp)
            .clip(CircleShape)
            .background(Color.White)
        )
      }
    }
  }
}

@Composable
private fun StepWelcome() {
  Column(
    modifier = Modifier.fillMaxWidth(),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Spacer(modifier = Modifier.height(DorkSpacing.l))
    Box(
      modifier = Modifier
        .size(78.dp)
        .clip(CircleShape)
        .background(Brush.linearGradient(DorkGradients.Bloom)),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = Icons.Rounded.Favorite,
        contentDescription = null,
        tint = Color.White,
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
      text = "About two minutes. Everything after this is yours to change — nothing here is locked in.",
      style = MaterialTheme.typography.bodyLarge,
      color = DorkTheme.colors.textSecondary
    )

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    Column(
      modifier = Modifier.fillMaxWidth(),
      verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)
    ) {
      WelcomePoint("Conditions and allergies", "Including ones you type yourself", DorkGradients.Bloom)
      WelcomePoint("Medicines and reminders", "Any time of day, with a sound you choose", DorkGradients.Tide)
      WelcomePoint("Who to call", "One contact, for the worst day", DorkGradients.Meadow)
    }
  }
}

@Composable
private fun WelcomePoint(title: String, detail: String, gradient: List<Color>) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(16.dp))
      .background(DorkTheme.colors.card)
      .padding(horizontal = DorkSpacing.m, vertical = DorkSpacing.s),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Box(
      modifier = Modifier
        .size(8.dp)
        .clip(CircleShape)
        .background(Brush.linearGradient(gradient))
    )
    Spacer(modifier = Modifier.width(DorkSpacing.s))
    Column {
      Text(
        text = title,
        style = MaterialTheme.typography.titleSmall,
        color = DorkTheme.colors.textPrimary
      )
      Text(
        text = detail,
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary
      )
    }
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
  val context = LocalContext.current

  fun openPicker() {
    // Open on the date already chosen, or a plausible adult default. Nobody
    // enjoys scrolling from today back forty years.
    val current = uiState.birthDateIso
      .takeIf { it.length == 10 }
      ?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
      ?: LocalDate.of(1995, 1, 1)

    val dialog = DatePickerDialog(
      context,
      { _, year, month, day ->
        viewModel.onDobChange(LocalDate.of(year, month + 1, day).toString())
      },
      current.year,
      current.monthValue - 1,
      current.dayOfMonth
    )

    // A birthday cannot be in the future, and a claim older than 120 years is
    // a typo the calendar should refuse rather than store.
    runCatching { dialog.datePicker.maxDate = System.currentTimeMillis() }
    runCatching {
      val oldest = Calendar.getInstance().apply { add(Calendar.YEAR, -120) }.timeInMillis
      dialog.datePicker.minDate = oldest
    }

    dialog.show()
  }

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "When were you born?",
      style = MaterialTheme.typography.headlineLarge,
      color = DorkTheme.colors.textPrimary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(
      text = "Pick it from the calendar. Age is calculated from this, never typed.",
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkCard(onClick = { openPicker() }, contentPadding = DorkSpacing.l) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(
          text = "DATE OF BIRTH",
          style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.4.sp),
          color = DorkTheme.colors.textTertiary
        )

        Spacer(modifier = Modifier.height(DorkSpacing.xs))

        Row(verticalAlignment = Alignment.Bottom) {
          AnimatedContent(
            targetState = uiState.formattedBirthDate,
            transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(120)) },
            label = "dob"
          ) { formatted ->
            val unset = formatted == "Not set"
            Text(
              text = if (unset) "Choose a date" else formatted,
              style = MaterialTheme.typography.displaySmall,
              color = if (unset) DorkTheme.colors.textTertiary else DorkTheme.colors.textPrimary
            )
          }

          if (uiState.calculatedAge > 0) {
            Spacer(modifier = Modifier.width(DorkSpacing.s))
            Text(
              text = "${uiState.calculatedAge} yrs",
              style = MaterialTheme.typography.titleMedium,
              color = MaterialTheme.colorScheme.primary,
              modifier = Modifier.padding(bottom = 6.dp)
            )
          }
        }

        Spacer(modifier = Modifier.height(DorkSpacing.xs))

        Text(
          text = if (uiState.birthDateIso.isBlank()) {
            "Tap to choose your date of birth"
          } else {
            "Tap to change"
          },
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    }
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
  // Anything selected that is not one of the presets was typed by the patient.
  val custom = uiState.selectedConditions.filterNot { it in options }.sorted()

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(text = "Medical conditions", style = MaterialTheme.typography.headlineLarge, color = DorkTheme.colors.textPrimary)
    Spacer(modifier = Modifier.height(DorkSpacing.xs))
    Text(
      text = "Select what applies, or add your own. Use the name your doctor uses.",
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textSecondary
    )
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
      custom.forEach { condition ->
        DorkChip(
          label = condition,
          selected = true,
          onClick = { viewModel.toggleCondition(condition) }
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    Row(verticalAlignment = Alignment.CenterVertically) {
      DorkTextField(
        value = uiState.customConditionInput,
        onValueChange = viewModel::onCustomConditionChange,
        placeholder = "Add your own condition…",
        modifier = Modifier.weight(1f)
      )
      Spacer(modifier = Modifier.width(DorkSpacing.s))
      DorkButton(
        text = "Add",
        onClick = viewModel::addCustomCondition,
        variant = DorkButtonVariant.Secondary,
        fullWidth = false,
        enabled = uiState.customConditionInput.isNotBlank()
      )
    }

    AnimatedContent(
      targetState = custom.size,
      transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(120)) },
      label = "custom-conditions"
    ) { count ->
      if (count > 0) {
        Text(
          text = "$count added by you · tap a chip to remove it",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textTertiary,
          modifier = Modifier.padding(top = DorkSpacing.s)
        )
      } else {
        Spacer(modifier = Modifier.height(0.dp))
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
