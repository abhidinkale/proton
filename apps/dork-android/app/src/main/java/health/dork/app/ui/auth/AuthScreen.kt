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
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.input.VisualTransformation
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
  val registeredEmail by viewModel.registeredEmail.collectAsState()
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

    DorkCard(contentPadding = DorkSpacing.xl) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(
          text = "Sign in",
          style = MaterialTheme.typography.headlineMedium,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.xxs))
        Text(
          text = if (registeredEmail == null) {
            "This device has no patient account yet. Create one to start."
          } else {
            "Account on this device: $registeredEmail"
          },
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )

        Spacer(modifier = Modifier.height(DorkSpacing.m))

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
          placeholder = "At least 8 characters",
          visualTransformation = if (uiState.passwordVisible) {
            VisualTransformation.None
          } else {
            PasswordVisualTransformation()
          },
          leadingIcon = {
            Icon(
              imageVector = Icons.Rounded.Lock,
              contentDescription = null,
              tint = DorkTheme.colors.textTertiary,
              modifier = Modifier.size(18.dp)
            )
          },
          trailingIcon = {
            IconButton(onClick = viewModel::togglePasswordVisibility) {
              Icon(
                imageVector = if (uiState.passwordVisible) {
                  Icons.Rounded.VisibilityOff
                } else {
                  Icons.Rounded.Visibility
                },
                contentDescription = if (uiState.passwordVisible) "Hide password" else "Show password",
                tint = DorkTheme.colors.textTertiary,
                modifier = Modifier.size(18.dp)
              )
            }
          },
          errorMessage = uiState.errorMessage,
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
        )

        Spacer(modifier = Modifier.height(DorkSpacing.l))

        DorkButton(
          text = "Sign in",
          onClick = viewModel::signIn,
          loading = uiState.isLoading,
          variant = DorkButtonVariant.Primary
        )

        Spacer(modifier = Modifier.height(DorkSpacing.s))

        DorkButton(
          text = "Create a new account",
          onClick = viewModel::startSignUp,
          variant = DorkButtonVariant.Ghost
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkCard(
      contentPadding = DorkSpacing.m,
      backgroundColor = DorkTheme.colors.surfaceSecondary
    ) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(
            imageVector = Icons.Rounded.Shield,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
          )
          Spacer(modifier = Modifier.width(DorkSpacing.s))
          Text(
            text = "Synthetic demo patient",
            style = MaterialTheme.typography.titleSmall,
            color = DorkTheme.colors.textPrimary
          )
        }
        Spacer(modifier = Modifier.height(DorkSpacing.xxs))
        Text(
          text = "Open Alex Morgan's fictional record to explore scheduling, doses, records and the on-device assistant. No real patient data is involved.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        DorkButton(
          text = "Open demo record",
          onClick = viewModel::signInDemo,
          variant = DorkButtonVariant.Secondary,
          enabled = !uiState.isLoading
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    Text(
      text = "Accounts are verified on this device. Profile data never leaves it.",
      style = MaterialTheme.typography.bodySmall,
      color = DorkTheme.colors.textTertiary,
      modifier = Modifier.padding(horizontal = DorkSpacing.m)
    )
  }
}
