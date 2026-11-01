package health.dork.app.ui.auth

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Mail
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.designsystem.DorkTheme

/**
 * Adaptive Auth Screen supporting both Dark Mode (titanium canvas + top-left ember glow)
 * and Light Mode (soft sky-blue to white gradient canvas).
 */
@Composable
fun AuthScreen(
  viewModel: AuthViewModel,
  onBackToWelcome: (() -> Unit)? = null,
  darkTheme: Boolean = isSystemInDarkTheme(),
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val registeredEmail by viewModel.registeredEmail.collectAsState()
  val scrollState = rememberScrollState()

  BackHandler(enabled = onBackToWelcome != null) {
    onBackToWelcome?.invoke()
  }

  // Dynamic color palette based on theme mode
  val textPrimary = if (darkTheme) Color.White else Color(0xFF10151E)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.55f) else Color(0xFF4C586B)
  val primaryBtnBg = if (darkTheme) Color.White else Color(0xFF10151E)
  val primaryBtnText = if (darkTheme) Color(0xFF111315) else Color.White
  val pillSurface = if (darkTheme) Color.White.copy(alpha = 0.06f) else Color.White.copy(alpha = 0.90f)
  val pillBorder = if (darkTheme) Color.White.copy(alpha = 0.14f) else Color(0xFFCCE0F5)
  val dividerColor = if (darkTheme) Color.White.copy(alpha = 0.12f) else Color(0xFFBDD4EC)

  DorkTheme(darkTheme = darkTheme) {
    Box(
      modifier = modifier
        .fillMaxSize()
        .background(if (darkTheme) Color(0xFF11141A) else Color.White)
    ) {
      // Background gradient
      Canvas(modifier = Modifier.fillMaxSize()) {
        val width = size.width
        val height = size.height

        if (darkTheme) {
          // Dark Mode: Top-left warm radiant amber glow
          val amberGlow = Brush.radialGradient(
            colorStops = arrayOf(
              0.00f to Color(0xFFFF9E58).copy(alpha = 0.50f),
              0.20f to Color(0xFFE65100).copy(alpha = 0.35f),
              0.45f to Color(0xFF8B2500).copy(alpha = 0.18f),
              0.70f to Color(0xFF3E1205).copy(alpha = 0.08f),
              1.00f to Color.Transparent
            ),
            center = Offset(width * 0.08f, height * 0.08f),
            radius = height * 0.58f
          )
          drawRect(brush = amberGlow)
        } else {
          // Light Mode: Soft sky-blue to white serene vertical gradient (matching reference image)
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

      Column(
        modifier = Modifier
          .fillMaxSize()
          .statusBarsPadding()
          .navigationBarsPadding()
          .verticalScroll(scrollState)
          .padding(horizontal = 26.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.Start,
        verticalArrangement = Arrangement.Top
      ) {
        // Top navigation bar & Brand Logo
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp, bottom = 28.dp),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          DorkPillCrossLogo(tint = textPrimary)

          if (onBackToWelcome != null) {
            Box(
              modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(if (darkTheme) Color.White.copy(alpha = 0.10f) else Color.White.copy(alpha = 0.85f))
                .border(1.dp, pillBorder, CircleShape)
                .clickable(
                  interactionSource = remember { MutableInteractionSource() },
                  indication = null,
                  onClick = onBackToWelcome
                ),
              contentAlignment = Alignment.Center
            ) {
              Icon(
                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                contentDescription = "Back",
                tint = textPrimary,
                modifier = Modifier.size(18.dp)
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Headline & Subtitle
        Text(
          text = "Your Health,\nSimplified.",
          style = MaterialTheme.typography.displayMedium.copy(
            fontFamily = FontFamily.SansSerif,
            fontWeight = FontWeight.Normal,
            fontSize = 38.sp,
            lineHeight = 44.sp,
            letterSpacing = (-1.0).sp
          ),
          color = textPrimary
        )

        Spacer(modifier = Modifier.height(10.dp))

        Text(
          text = "Track   •   Consult   •   Manage",
          style = MaterialTheme.typography.bodyMedium.copy(
            fontSize = 13.sp,
            letterSpacing = 0.8.sp
          ),
          color = textSecondary
        )

        Spacer(modifier = Modifier.height(34.dp))

        // Email field
        PillTextField(
          value = uiState.emailInput,
          onValueChange = viewModel::onEmailChange,
          placeholder = "Email address",
          darkTheme = darkTheme,
          leadingIcon = {
            Icon(
              imageVector = Icons.Rounded.Mail,
              contentDescription = null,
              tint = textSecondary,
              modifier = Modifier.size(18.dp)
            )
          },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Password field
        PillTextField(
          value = uiState.passwordInput,
          onValueChange = viewModel::onPasswordChange,
          placeholder = "Password",
          darkTheme = darkTheme,
          visualTransformation = if (uiState.passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
          leadingIcon = {
            Icon(
              imageVector = Icons.Rounded.Lock,
              contentDescription = null,
              tint = textSecondary,
              modifier = Modifier.size(18.dp)
            )
          },
          trailingIcon = {
            IconButton(onClick = viewModel::togglePasswordVisibility) {
              Icon(
                imageVector = if (uiState.passwordVisible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                contentDescription = if (uiState.passwordVisible) "Hide password" else "Show password",
                tint = textSecondary,
                modifier = Modifier.size(18.dp)
              )
            }
          },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
        )

        AnimatedVisibility(visible = uiState.errorMessage != null) {
          Text(
            text = uiState.errorMessage.orEmpty(),
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFFD32F2F),
            modifier = Modifier.padding(top = 8.dp, start = 8.dp)
          )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Primary Action Button (Sign in)
        Button(
          onClick = viewModel::signIn,
          enabled = !uiState.isLoading,
          shape = RoundedCornerShape(percent = 50),
          colors = ButtonDefaults.buttonColors(
            containerColor = primaryBtnBg,
            contentColor = primaryBtnText,
            disabledContainerColor = primaryBtnBg.copy(alpha = 0.4f),
            disabledContentColor = primaryBtnText.copy(alpha = 0.5f)
          ),
          modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .shadow(
              elevation = 8.dp,
              shape = RoundedCornerShape(percent = 50),
              spotColor = if (darkTheme) Color(0xFFF4511E) else Color(0x33000000)
            )
        ) {
          if (uiState.isLoading) {
            CircularProgressIndicator(
              modifier = Modifier.size(20.dp),
              color = primaryBtnText,
              strokeWidth = 2.dp
            )
          } else {
            Text(
              text = "Sign in",
              style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp
              )
            )
          }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Demo Patient Button (Translucent pill)
        Button(
          onClick = viewModel::signInDemo,
          enabled = !uiState.isLoading,
          shape = RoundedCornerShape(percent = 50),
          colors = ButtonDefaults.buttonColors(
            containerColor = pillSurface,
            contentColor = textPrimary
          ),
          border = androidx.compose.foundation.BorderStroke(1.dp, pillBorder),
          modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
        ) {
          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.Rounded.Shield,
              contentDescription = null,
              tint = if (darkTheme) Color(0xFFFFA063) else Color(0xFFE65100),
              modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
              text = "Open synthetic demo patient",
              style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.Medium,
                fontSize = 14.sp
              )
            )
          }
        }

        Spacer(modifier = Modifier.height(28.dp))

        // "── or ──" Divider
        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically
        ) {
          HorizontalDivider(
            modifier = Modifier.weight(1f),
            thickness = 1.dp,
            color = dividerColor
          )
          Text(
            text = "or",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp),
            color = textSecondary,
            modifier = Modifier.padding(horizontal = 14.dp)
          )
          HorizontalDivider(
            modifier = Modifier.weight(1f),
            thickness = 1.dp,
            color = dividerColor
          )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Create a new account button
        Button(
          onClick = { viewModel.startSignUp(initialStep = 2) },
          shape = RoundedCornerShape(percent = 50),
          colors = ButtonDefaults.buttonColors(
            containerColor = pillSurface,
            contentColor = textPrimary
          ),
          border = androidx.compose.foundation.BorderStroke(1.dp, pillBorder),
          modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
        ) {
          Text(
            text = "Create a new account",
            style = MaterialTheme.typography.bodyMedium.copy(
              fontWeight = FontWeight.Medium,
              fontSize = 14.sp
            )
          )
        }

        Spacer(modifier = Modifier.height(28.dp))

        // Bottom link
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.Center
        ) {
          Text(
            text = "Already have an account? ",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 13.sp),
            color = textSecondary
          )
          Text(
            text = "Log in",
            style = MaterialTheme.typography.bodySmall.copy(
              fontWeight = FontWeight.Bold,
              fontSize = 13.sp
            ),
            color = textPrimary,
            modifier = Modifier.clickable {
              // Focus email input or scroll up
            }
          )
        }
      }
    }
  }
}

/**
 * Adaptive Dork Brand Mark (Cross-Pill + Wordmark) supporting dark and light tints.
 */
@Composable
fun DorkPillCrossLogo(
  modifier: Modifier = Modifier,
  tint: Color = Color.White
) {
  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = modifier
  ) {
    Box(
      modifier = Modifier.size(26.dp),
      contentAlignment = Alignment.Center
    ) {
      // Horizontal rounded pill
      Box(
        modifier = Modifier
          .size(width = 24.dp, height = 9.5.dp)
          .clip(RoundedCornerShape(percent = 50))
          .background(tint)
      )
      // Vertical rounded pill
      Box(
        modifier = Modifier
          .size(width = 9.5.dp, height = 24.dp)
          .clip(RoundedCornerShape(percent = 50))
          .background(tint)
      )
    }
    Spacer(modifier = Modifier.width(10.dp))
    Text(
      text = "Dork",
      style = MaterialTheme.typography.titleLarge.copy(
        fontWeight = FontWeight.Bold,
        fontSize = 21.sp,
        letterSpacing = (-0.3).sp
      ),
      color = tint
    )
  }
}

/**
 * Adaptive Pill-shaped text field.
 */
@Composable
private fun PillTextField(
  value: String,
  onValueChange: (String) -> Unit,
  placeholder: String,
  darkTheme: Boolean = true,
  leadingIcon: @Composable (() -> Unit)? = null,
  trailingIcon: @Composable (() -> Unit)? = null,
  visualTransformation: VisualTransformation = VisualTransformation.None,
  keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
  modifier: Modifier = Modifier
) {
  val containerColor = if (darkTheme) Color.White.copy(alpha = 0.06f) else Color.White.copy(alpha = 0.90f)
  val borderColor = if (darkTheme) Color.White.copy(alpha = 0.14f) else Color(0xFFCCE0F5)
  val focusedBorder = if (darkTheme) Color(0xFFFFA063).copy(alpha = 0.70f) else Color(0xFF1976D2)
  val textColor = if (darkTheme) Color.White else Color(0xFF10151E)
  val placeholderColor = if (darkTheme) Color.White.copy(alpha = 0.40f) else Color(0xFF6B7A8E)

  OutlinedTextField(
    value = value,
    onValueChange = onValueChange,
    singleLine = true,
    placeholder = {
      Text(
        text = placeholder,
        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
        color = placeholderColor
      )
    },
    leadingIcon = leadingIcon,
    trailingIcon = trailingIcon,
    visualTransformation = visualTransformation,
    keyboardOptions = keyboardOptions,
    shape = RoundedCornerShape(percent = 50),
    colors = OutlinedTextFieldDefaults.colors(
      focusedContainerColor = containerColor,
      unfocusedContainerColor = containerColor,
      focusedBorderColor = focusedBorder,
      unfocusedBorderColor = borderColor,
      focusedTextColor = textColor,
      unfocusedTextColor = textColor
    ),
    modifier = modifier
      .fillMaxWidth()
      .height(52.dp)
  )
}
