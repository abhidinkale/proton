package health.dork.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Mail
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkTextField

@Composable
fun AuthScreen(
  viewModel: AuthViewModel,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val isDemoMode by viewModel.isDemoMode.collectAsState()
  val scrollState = rememberScrollState()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
      .verticalScroll(scrollState)
      .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.xxl),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center
  ) {
    // App Logo / Symbol
    Box(
      modifier = Modifier
        .size(68.dp)
        .clip(CircleShape)
        .background(MaterialTheme.colorScheme.primaryContainer),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = Icons.Rounded.Favorite,
        contentDescription = "Dork Health",
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.size(36.dp)
      )
    }

    Spacer(modifier = Modifier.height(DorkSpacing.m))

    Text(
      text = "Dork",
      style = MaterialTheme.typography.displayMedium,
      color = DorkTheme.colors.textPrimary
    )

    Text(
      text = "Your health, organized.",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary,
      modifier = Modifier.padding(top = DorkSpacing.xxs)
    )

    Spacer(modifier = Modifier.height(DorkSpacing.xxl))

    DorkCard(
      contentPadding = DorkSpacing.xl
    ) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(
          text = "Sign In",
          style = MaterialTheme.typography.headlineMedium,
          color = DorkTheme.colors.textPrimary
        )

        Spacer(modifier = Modifier.height(DorkSpacing.s))

        DorkTextField(
          value = uiState.emailInput,
          onValueChange = viewModel::onEmailChange,
          label = "Email address",
          placeholder = "you@example.com",
          leadingIcon = {
            Icon(
              imageVector = Icons.Rounded.Mail,
              contentDescription = null,
              tint = DorkTheme.colors.textTertiary,
              modifier = Modifier.size(18.dp)
            )
          },
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
        )

        Spacer(modifier = Modifier.height(DorkSpacing.m))

        DorkTextField(
          value = uiState.passwordInput,
          onValueChange = viewModel::onPasswordChange,
          label = "Password",
          placeholder = "••••••••",
          visualTransformation = PasswordVisualTransformation(),
          leadingIcon = {
            Icon(
              imageVector = Icons.Rounded.Lock,
              contentDescription = null,
              tint = DorkTheme.colors.textTertiary,
              modifier = Modifier.size(18.dp)
            )
          },
          errorMessage = uiState.errorMessage,
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
        )

        Spacer(modifier = Modifier.height(DorkSpacing.l))

        DorkButton(
          text = "Sign in to Dork",
          onClick = viewModel::signIn,
          loading = uiState.isLoading,
          variant = DorkButtonVariant.Primary
        )

        Spacer(modifier = Modifier.height(DorkSpacing.s))

        DorkButton(
          text = "New to Dork? Create account",
          onClick = viewModel::startSignUp,
          variant = DorkButtonVariant.Ghost
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    // Demo Mode Card
    DorkCard(
      contentPadding = DorkSpacing.m,
      backgroundColor = DorkTheme.colors.surfaceSecondary.copy(alpha = 0.6f)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          modifier = Modifier.weight(1f)
        ) {
          Icon(
            imageVector = Icons.Rounded.Shield,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
          )
          Spacer(modifier = Modifier.width(DorkSpacing.s))
          Column {
            Text(
              text = "Demo Synthetic Mode",
              style = MaterialTheme.typography.titleSmall,
              color = DorkTheme.colors.textPrimary
            )
            Text(
              text = "Pre-loaded with Alex Morgan synthetic patient data",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
        }

        Switch(
          checked = isDemoMode,
          onCheckedChange = viewModel::toggleDemoMode,
          colors = SwitchDefaults.colors(
            checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
            checkedTrackColor = MaterialTheme.colorScheme.primary
          )
        )
      }
    }
  }
}
