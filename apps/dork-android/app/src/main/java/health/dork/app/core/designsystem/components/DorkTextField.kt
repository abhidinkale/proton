package health.dork.app.core.designsystem.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

@Composable
fun DorkTextField(
  value: String,
  onValueChange: (String) -> Unit,
  modifier: Modifier = Modifier,
  label: String? = null,
  placeholder: String? = null,
  helperText: String? = null,
  errorMessage: String? = null,
  isError: Boolean = errorMessage != null,
  enabled: Boolean = true,
  singleLine: Boolean = true,
  maxLines: Int = 1,
  leadingIcon: @Composable (() -> Unit)? = null,
  trailingIcon: @Composable (() -> Unit)? = null,
  keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
  keyboardActions: KeyboardActions = KeyboardActions.Default,
  visualTransformation: VisualTransformation = VisualTransformation.None
) {
  Column(modifier = modifier.fillMaxWidth()) {
    if (label != null) {
      Text(
        text = label,
        style = MaterialTheme.typography.labelMedium,
        color = DorkTheme.colors.textSecondary,
        modifier = Modifier.padding(bottom = DorkSpacing.xxs)
      )
    }

    OutlinedTextField(
      value = value,
      onValueChange = onValueChange,
      modifier = Modifier.fillMaxWidth(),
      enabled = enabled,
      singleLine = singleLine,
      maxLines = maxLines,
      isError = isError,
      shape = DorkShapes.medium,
      placeholder = placeholder?.let {
        {
          Text(
            text = it,
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textTertiary
          )
        }
      },
      leadingIcon = leadingIcon,
      trailingIcon = trailingIcon,
      keyboardOptions = keyboardOptions,
      keyboardActions = keyboardActions,
      visualTransformation = visualTransformation,
      colors = OutlinedTextFieldDefaults.colors(
        focusedContainerColor = DorkTheme.colors.surfaceSecondary,
        unfocusedContainerColor = DorkTheme.colors.surfaceSecondary,
        disabledContainerColor = DorkTheme.colors.surfaceSecondary.copy(alpha = 0.5f),
        focusedBorderColor = MaterialTheme.colorScheme.primary,
        unfocusedBorderColor = DorkTheme.colors.surfaceBorder,
        errorBorderColor = DorkTheme.colors.critical,
        focusedTextColor = DorkTheme.colors.textPrimary,
        unfocusedTextColor = DorkTheme.colors.textPrimary
      )
    )

    AnimatedVisibility(visible = isError && errorMessage != null) {
      Text(
        text = errorMessage.orEmpty(),
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.critical,
        modifier = Modifier.padding(top = DorkSpacing.xxs, start = DorkSpacing.xs)
      )
    }

    if (!isError && helperText != null) {
      Text(
        text = helperText,
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary,
        modifier = Modifier.padding(top = DorkSpacing.xxs, start = DorkSpacing.xs)
      )
    }
  }
}
