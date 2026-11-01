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
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.data.model.BiologicalSex
import health.dork.app.core.data.model.BloodGroup
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.ui.auth.DorkPillCrossLogo
import health.dork.app.ui.welcome.WelcomeScreen
import java.time.LocalDate
import java.util.Calendar
import java.util.Locale

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun OnboardingScreen(
  viewModel: OnboardingViewModel,
  onSignInClick: () -> Unit = {},
  onDemoClick: () -> Unit = {},
  darkTheme: Boolean = isSystemInDarkTheme(),
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()

  if (uiState.currentStep == 1) {
    WelcomeScreen(
      onGetStarted = viewModel::nextStep,
      onSignInClick = onSignInClick,
      onDemoClick = onDemoClick,
      darkTheme = darkTheme,
      modifier = modifier
    )
    return
  }

  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)
  val primaryBtnBg = if (darkTheme) Color.White else Color(0xFF10151E)
  val primaryBtnText = if (darkTheme) Color(0xFF111315) else Color.White

  DorkTheme(darkTheme = darkTheme) {
    Box(
      modifier = modifier
        .fillMaxSize()
        .background(if (darkTheme) Color(0xFF080A0E) else Color.White)
    ) {
      // Adaptive Background
      AdaptiveOnboardingBackground(darkTheme = darkTheme, modifier = Modifier.fillMaxSize())

      Column(
        modifier = Modifier
          .fillMaxSize()
          .statusBarsPadding()
          .navigationBarsPadding()
      ) {
        // Silent Tone Top Bar
        SilentOnboardingHero(
          step = uiState.currentStep,
          total = TOTAL_STEPS,
          darkTheme = darkTheme,
          onBack = if (uiState.currentStep > 1 && uiState.currentStep < 13) viewModel::previousStep else null
        )

        Column(
          modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 24.dp, vertical = 20.dp),
          verticalArrangement = Arrangement.SpaceBetween
        ) {
          Box(modifier = Modifier.weight(1f)) {
            AnimatedContent(
              targetState = uiState.currentStep,
              transitionSpec = {
                (slideInHorizontally(animationSpec = tween(240)) { it / 6 } + fadeIn(tween(200))) togetherWith
                  (slideOutHorizontally(animationSpec = tween(180)) { -it / 8 } + fadeOut(tween(140)))
              },
              label = "silent_onboarding_step"
            ) { step ->
              when (step) {
                2 -> StepAccount(uiState, viewModel, darkTheme)
                3 -> StepName(uiState, viewModel, darkTheme)
                4 -> StepDateOfBirth(uiState, viewModel, darkTheme)
                5 -> StepSex(uiState, viewModel, darkTheme)
                6 -> StepHeight(uiState, viewModel, darkTheme)
                7 -> StepWeight(uiState, viewModel, darkTheme)
                8 -> StepBloodGroup(uiState, viewModel, darkTheme)
                9 -> StepConditions(uiState, viewModel, darkTheme)
                10 -> StepAllergies(uiState, viewModel, darkTheme)
                11 -> StepMedications(uiState, viewModel, darkTheme)
                12 -> StepEmergencyContact(uiState, viewModel, darkTheme)
                13 -> StepComplete(uiState, darkTheme)
                else -> StepAccount(uiState, viewModel, darkTheme)
              }
            }
          }

          Spacer(modifier = Modifier.height(24.dp))

          if (uiState.errorMessage != null) {
            Text(
              text = uiState.errorMessage.orEmpty(),
              style = MaterialTheme.typography.bodySmall,
              color = Color(0xFFD32F2F),
              modifier = Modifier.padding(bottom = 12.dp, start = 4.dp)
            )
          }

          // Primary Action Button
          Button(
            onClick = viewModel::nextStep,
            enabled = !uiState.isSubmitting,
            shape = RoundedCornerShape(percent = 50),
            colors = ButtonDefaults.buttonColors(
              containerColor = primaryBtnBg,
              contentColor = primaryBtnText,
              disabledContainerColor = primaryBtnBg.copy(alpha = 0.35f),
              disabledContentColor = primaryBtnText.copy(alpha = 0.5f)
            ),
            modifier = Modifier
              .fillMaxWidth()
              .height(54.dp)
              .shadow(
                elevation = 8.dp,
                shape = RoundedCornerShape(percent = 50),
                spotColor = if (darkTheme) Color(0xFFF4511E) else Color(0x33000000)
              )
          ) {
            if (uiState.isSubmitting) {
              CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = primaryBtnText,
                strokeWidth = 2.dp
              )
            } else {
              Text(
                text = if (uiState.currentStep == 13) "Complete & enter Dork" else "Continue",
                style = MaterialTheme.typography.titleMedium.copy(
                  fontWeight = FontWeight.Bold,
                  letterSpacing = 0.2.sp
                )
              )
            }
          }
        }
      }
    }
  }
}

private const val TOTAL_STEPS = 13

/**
 * Adaptive Background:
 * - Dark Theme: deep slate with top-left warm ember glow.
 * - Light Theme: soft serene sky-blue to white gradient.
 */
@Composable
private fun AdaptiveOnboardingBackground(darkTheme: Boolean, modifier: Modifier = Modifier) {
  Canvas(modifier = modifier) {
    val width = size.width
    val height = size.height

    if (darkTheme) {
      val topGlow = Brush.radialGradient(
        colorStops = arrayOf(
          0.00f to Color(0xFFFF9E58).copy(alpha = 0.40f),
          0.20f to Color(0xFFE65100).copy(alpha = 0.28f),
          0.45f to Color(0xFF8B2500).copy(alpha = 0.14f),
          0.70f to Color(0xFF3E1205).copy(alpha = 0.06f),
          1.00f to Color.Transparent
        ),
        center = Offset(width * 0.08f, height * 0.06f),
        radius = height * 0.52f
      )
      drawRect(brush = topGlow)

      val bottomGlow = Brush.radialGradient(
        colorStops = arrayOf(
          0.0f to Color(0xFFB71C1C).copy(alpha = 0.10f),
          0.6f to Color(0xFF3E0E08).copy(alpha = 0.04f),
          1.0f to Color.Transparent
        ),
        center = Offset(width * 0.90f, height * 0.95f),
        radius = height * 0.50f
      )
      drawRect(brush = bottomGlow)
    } else {
      val skyGradient = Brush.verticalGradient(
        colorStops = arrayOf(
          0.00f to Color(0xFF8DBBED),
          0.15f to Color(0xFF99C8F6),
          0.35f to Color(0xFFAED8FF),
          0.55f to Color(0xFFC3E0FE),
          0.75f to Color(0xFFE6EFFF),
          0.90f to Color(0xFFFCFDFF),
          1.00f to Color.White
        )
      )
      drawRect(brush = skyGradient)
    }
  }
}

/**
 * Silent Tone Top Bar for question steps.
 */
@Composable
private fun SilentOnboardingHero(
  step: Int,
  total: Int,
  darkTheme: Boolean,
  onBack: (() -> Unit)?
) {
  val progress by animateFloatAsState(
    targetValue = (step / total.toFloat()).coerceIn(0f, 1f),
    animationSpec = tween(400),
    label = "silent-progress"
  )

  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)
  val trackColor = if (darkTheme) Color.White.copy(alpha = 0.12f) else Color(0xFFCCE0F5)
  val progressColor = if (darkTheme) Color.White else Color(0xFF10151E)

  val title = when (step) {
    in 2..3 -> "Let's set you up."
    in 4..8 -> "A little about you."
    in 9..11 -> "In your own words."
    12 -> "Who should we call?"
    else -> "You're all set."
  }

  Column(
    modifier = Modifier
      .fillMaxWidth()
      .padding(start = 24.dp, end = 24.dp, top = 12.dp, bottom = 8.dp)
  ) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically
    ) {
      if (onBack != null) {
        Box(
          modifier = Modifier
            .size(36.dp)
            .clip(CircleShape)
            .background(if (darkTheme) Color.White.copy(alpha = 0.10f) else Color.White.copy(alpha = 0.85f))
            .border(1.dp, if (darkTheme) Color.White.copy(alpha = 0.16f) else Color(0xFFCCE0F5), CircleShape)
            .clickable(onClick = onBack),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
            contentDescription = "Back",
            tint = textPrimary,
            modifier = Modifier.size(18.dp)
          )
        }
        Spacer(modifier = Modifier.width(12.dp))
      }

      DorkPillCrossLogo(tint = textPrimary)

      Spacer(modifier = Modifier.weight(1f))

      Text(
        text = "$step / $total",
        style = MaterialTheme.typography.labelSmall.copy(
          fontFamily = FontFamily.Monospace,
          letterSpacing = 1.sp,
          fontSize = 11.sp
        ),
        color = textSecondary
      )
    }

    Spacer(modifier = Modifier.height(14.dp))

    AnimatedContent(
      targetState = title,
      transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(100)) },
      label = "hero-title"
    ) { line ->
      Text(
        text = line,
        style = MaterialTheme.typography.headlineMedium.copy(
          fontFamily = FontFamily.SansSerif,
          fontWeight = FontWeight.SemiBold,
          fontSize = 24.sp,
          letterSpacing = (-0.4).sp
        ),
        color = textPrimary
      )
    }

    Spacer(modifier = Modifier.height(14.dp))

    // Hairline Progress Indicator
    Box(
      modifier = Modifier
        .fillMaxWidth()
        .height(3.dp)
        .clip(CircleShape)
        .background(trackColor)
    ) {
      Box(
        modifier = Modifier
          .fillMaxWidth(progress)
          .height(3.dp)
          .clip(CircleShape)
          .background(progressColor)
      )
    }
  }
}

/**
 * Adaptive Capsule Chip.
 */
@Composable
private fun SilentChip(
  label: String,
  selected: Boolean,
  darkTheme: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val bg = if (selected) {
    if (darkTheme) Color.White else Color(0xFF10151E)
  } else {
    if (darkTheme) Color.White.copy(alpha = 0.07f) else Color.White.copy(alpha = 0.85f)
  }

  val border = if (selected) {
    null
  } else {
    BorderStroke(1.dp, if (darkTheme) Color.White.copy(alpha = 0.18f) else Color(0xFFCCE0F5))
  }

  val textColor = if (selected) {
    if (darkTheme) Color(0xFF111315) else Color.White
  } else {
    if (darkTheme) Color.White.copy(alpha = 0.82f) else Color(0xFF1A2332)
  }

  Surface(
    modifier = modifier.clickable(
      interactionSource = remember { MutableInteractionSource() },
      indication = null,
      onClick = onClick
    ),
    shape = RoundedCornerShape(percent = 50),
    color = bg,
    border = border
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Text(
        text = label,
        style = MaterialTheme.typography.labelMedium.copy(
          fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
          fontSize = 13.5.sp
        ),
        color = textColor
      )
    }
  }
}

@Composable
private fun StepAccount(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "Create your account",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Your account is verified on this device. Your password is encrypted with PBKDF2 and never stored in plain text.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))
    DorkTextField(
      value = uiState.email,
      onValueChange = viewModel::onEmailChange,
      label = "Email address",
      placeholder = "you@example.com",
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
    )
    Spacer(modifier = Modifier.height(16.dp))
    DorkTextField(
      value = uiState.password,
      onValueChange = viewModel::onPasswordChange,
      label = "Password",
      placeholder = "At least 8 characters",
      visualTransformation = PasswordVisualTransformation(),
      helperText = "Use at least 8 characters. You will need this to sign in again.",
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
    )
    Spacer(modifier = Modifier.height(16.dp))
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
private fun StepName(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "What is your full legal name?",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Used for matching prescriptions and official clinical records.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))
    DorkTextField(
      value = uiState.fullName,
      onValueChange = viewModel::onNameChange,
      label = "Full name",
      placeholder = "e.g. Alex Morgan"
    )
  }
}

@Composable
private fun StepDateOfBirth(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val context = LocalContext.current
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)
  val cardBg = if (darkTheme) Color.White.copy(alpha = 0.06f) else Color.White.copy(alpha = 0.90f)
  val cardBorder = if (darkTheme) Color.White.copy(alpha = 0.14f) else Color(0xFFCCE0F5)

  fun openPicker() {
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
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Pick it from the calendar. Age is calculated from this, never typed.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))

    Box(
      modifier = Modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(20.dp))
        .background(cardBg)
        .border(1.dp, cardBorder, RoundedCornerShape(20.dp))
        .clickable(onClick = { openPicker() })
        .padding(20.dp)
    ) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(
          text = "DATE OF BIRTH",
          style = MaterialTheme.typography.labelSmall.copy(
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.4.sp,
            fontSize = 11.sp
          ),
          color = textSecondary
        )

        Spacer(modifier = Modifier.height(8.dp))

        Row(verticalAlignment = Alignment.Bottom) {
          AnimatedContent(
            targetState = uiState.formattedBirthDate,
            transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(120)) },
            label = "dob"
          ) { formatted ->
            val unset = formatted == "Not set"
            Text(
              text = if (unset) "Choose a date" else formatted,
              style = MaterialTheme.typography.displaySmall.copy(fontSize = 28.sp),
              color = if (unset) textSecondary else textPrimary
            )
          }

          if (uiState.calculatedAge > 0) {
            Spacer(modifier = Modifier.width(10.dp))
            Surface(
              shape = RoundedCornerShape(percent = 50),
              color = Color(0xFFF4511E).copy(alpha = 0.20f),
              border = BorderStroke(1.dp, Color(0xFFF4511E).copy(alpha = 0.40f)),
              modifier = Modifier.padding(bottom = 4.dp)
            ) {
              Text(
                text = "${uiState.calculatedAge} yrs",
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                color = if (darkTheme) Color(0xFFFFA063) else Color(0xFFD84315),
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
          text = if (uiState.birthDateIso.isBlank()) {
            "Tap to choose your date of birth"
          } else {
            "Tap to change"
          },
          style = MaterialTheme.typography.bodySmall,
          color = textSecondary
        )
      }
    }
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepSex(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "Biological sex assigned at birth",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Used to establish clinical reference ranges for diagnostic tests.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
      BiologicalSex.entries.forEach { sex ->
        SilentChip(
          label = sex.displayName,
          selected = uiState.sex == sex,
          darkTheme = darkTheme,
          onClick = { viewModel.onSexChange(sex) },
          modifier = Modifier.fillMaxWidth()
        )
      }
    }
  }
}

@Composable
private fun StepHeight(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "What is your height?",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Used alongside weight to track body metrics and medication dosages.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))
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
private fun StepWeight(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "What is your current weight?",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
      Text(
        text = "Calculated BMI: ",
        style = MaterialTheme.typography.bodyMedium,
        color = textSecondary
      )
      Text(
        text = "${uiState.bmi ?: "--"} kg/m\u00b2",
        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
        color = if (darkTheme) Color(0xFFFFA063) else Color(0xFFD84315)
      )
    }
    Spacer(modifier = Modifier.height(28.dp))
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
private fun StepBloodGroup(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "Blood group",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Essential for emergency medical services and transfusions.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))

    FlowRow(
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      BloodGroup.entries.forEach { bg ->
        SilentChip(
          label = bg.display,
          selected = uiState.bloodGroup == bg,
          darkTheme = darkTheme,
          onClick = { viewModel.onBloodGroupChange(bg) }
        )
      }
    }
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepConditions(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)
  val options = listOf("None", "Diabetes", "Hypertension", "Asthma", "Heart condition", "Thyroid condition", "Migraine", "Other")
  val custom = uiState.selectedConditions.filterNot { it in options }.sorted()

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "Medical conditions",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Select what applies, or add your own.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))

    FlowRow(
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      options.forEach { condition ->
        SilentChip(
          label = condition,
          selected = uiState.selectedConditions.contains(condition),
          darkTheme = darkTheme,
          onClick = { viewModel.toggleCondition(condition) }
        )
      }
      custom.forEach { condition ->
        SilentChip(
          label = condition,
          selected = true,
          darkTheme = darkTheme,
          onClick = { viewModel.toggleCondition(condition) }
        )
      }
    }

    Spacer(modifier = Modifier.height(20.dp))

    Row(verticalAlignment = Alignment.CenterVertically) {
      DorkTextField(
        value = uiState.customConditionInput,
        onValueChange = viewModel::onCustomConditionChange,
        placeholder = "Add your own condition\u2026",
        modifier = Modifier.weight(1f)
      )
      Spacer(modifier = Modifier.width(10.dp))
      Button(
        onClick = viewModel::addCustomCondition,
        enabled = uiState.customConditionInput.isNotBlank(),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
          containerColor = if (darkTheme) Color.White.copy(alpha = 0.15f) else Color(0xFF10151E),
          contentColor = Color.White
        )
      ) {
        Text("Add")
      }
    }
  }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepAllergies(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)
  val commonAllergies = listOf("Penicillin", "Sulfa drugs", "Aspirin", "Peanuts", "Shellfish", "Latex", "Pollen / Seasonal")

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "Allergies",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Select known allergies or type custom ones below.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))

    FlowRow(
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
      commonAllergies.forEach { allergy ->
        SilentChip(
          label = allergy,
          selected = uiState.selectedAllergies.contains(allergy),
          darkTheme = darkTheme,
          onClick = { viewModel.toggleAllergy(allergy) }
        )
      }
    }

    Spacer(modifier = Modifier.height(20.dp))

    Row(verticalAlignment = Alignment.CenterVertically) {
      DorkTextField(
        value = uiState.customAllergyInput,
        onValueChange = viewModel::onCustomAllergyChange,
        placeholder = "Add other allergy...",
        modifier = Modifier.weight(1f)
      )
      Spacer(modifier = Modifier.width(10.dp))
      Button(
        onClick = viewModel::addCustomAllergy,
        enabled = uiState.customAllergyInput.isNotBlank(),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
          containerColor = if (darkTheme) Color.White.copy(alpha = 0.15f) else Color(0xFF10151E),
          contentColor = Color.White
        )
      ) {
        Text("Add")
      }
    }
  }
}

@Composable
private fun StepMedications(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "Current medications",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "List prescription or over-the-counter medications you take regularly.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))

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
private fun StepEmergencyContact(uiState: OnboardingUiState, viewModel: OnboardingViewModel, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)

  Column(modifier = Modifier.fillMaxWidth()) {
    Text(
      text = "Emergency contact",
      style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.SemiBold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "Will be shown on your Emergency Medical ID.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))

    DorkTextField(
      value = uiState.emergencyContactName,
      onValueChange = { viewModel.onEmergencyContactChange(it, uiState.emergencyContactRelation, uiState.emergencyContactPhone) },
      label = "Contact name",
      placeholder = "e.g. Jordan Morgan"
    )
    Spacer(modifier = Modifier.height(16.dp))
    DorkTextField(
      value = uiState.emergencyContactRelation,
      onValueChange = { viewModel.onEmergencyContactChange(uiState.emergencyContactName, it, uiState.emergencyContactPhone) },
      label = "Relationship",
      placeholder = "e.g. Spouse / Sibling"
    )
    Spacer(modifier = Modifier.height(16.dp))
    DorkTextField(
      value = uiState.emergencyContactPhone,
      onValueChange = { viewModel.onEmergencyContactChange(uiState.emergencyContactName, uiState.emergencyContactRelation, it) },
      label = "Phone number",
      placeholder = "+1 (555) 000-0000",
      keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
    )
  }
}

@Composable
private fun StepComplete(uiState: OnboardingUiState, darkTheme: Boolean) {
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF4C586B)
  val cardBg = if (darkTheme) Color.White.copy(alpha = 0.06f) else Color.White.copy(alpha = 0.90f)
  val cardBorder = if (darkTheme) Color.White.copy(alpha = 0.14f) else Color(0xFFCCE0F5)

  Column(
    modifier = Modifier.fillMaxWidth(),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Spacer(modifier = Modifier.height(32.dp))
    Box(
      modifier = Modifier
        .size(80.dp)
        .clip(CircleShape)
        .background(Color(0xFF2E7D32).copy(alpha = 0.22f))
        .border(1.dp, Color(0xFF81C784).copy(alpha = 0.40f), CircleShape),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = Icons.Rounded.CheckCircle,
        contentDescription = null,
        tint = Color(0xFF2E7D32),
        modifier = Modifier.size(46.dp)
      )
    }
    Spacer(modifier = Modifier.height(20.dp))
    Text(
      text = "Profile complete",
      style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.Bold),
      color = textPrimary
    )
    Spacer(modifier = Modifier.height(6.dp))
    Text(
      text = "You can update any detail later in your settings.",
      style = MaterialTheme.typography.bodyMedium,
      color = textSecondary
    )
    Spacer(modifier = Modifier.height(28.dp))

    // Adaptive Summary Card
    Box(
      modifier = Modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(20.dp))
        .background(cardBg)
        .border(1.dp, cardBorder, RoundedCornerShape(20.dp))
        .padding(20.dp)
    ) {
      Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(text = uiState.fullName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = textPrimary)
        Text(text = uiState.email, style = MaterialTheme.typography.bodySmall, color = textSecondary)
        Text(text = "DOB: ${uiState.formattedBirthDate} \u00b7 Blood: ${uiState.bloodGroup.display}", style = MaterialTheme.typography.bodySmall, color = textSecondary)
        Text(
          text = "Height: ${if (uiState.heightCm > 0) "${uiState.heightCm} cm" else "not set"} \u00b7 " +
            "Weight: ${if (uiState.weightKg > 0) "${uiState.weightKg} kg" else "not set"}",
          style = MaterialTheme.typography.bodySmall,
          color = textSecondary
        )
      }
    }
  }
}
