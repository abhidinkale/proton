package health.dork.app.core.designsystem.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

enum class DorkButtonVariant {
  Primary,
  Secondary,
  Ghost,
  Critical
}

@Composable
fun DorkButton(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  variant: DorkButtonVariant = DorkButtonVariant.Primary,
  enabled: Boolean = true,
  loading: Boolean = false,
  leadingIcon: @Composable (() -> Unit)? = null,
  trailingIcon: @Composable (() -> Unit)? = null,
  fullWidth: Boolean = true
) {
  val widthModifier = if (fullWidth) modifier.fillMaxWidth() else modifier
  val finalModifier = widthModifier.height(52.dp)
  val shape = DorkShapes.pill
  val interactionSource = remember { MutableInteractionSource() }

  when (variant) {
    DorkButtonVariant.Primary -> {
      Button(
        onClick = onClick,
        modifier = finalModifier,
        enabled = enabled && !loading,
        shape = shape,
        colors = ButtonDefaults.buttonColors(
          containerColor = MaterialTheme.colorScheme.primary,
          contentColor = MaterialTheme.colorScheme.onPrimary,
          disabledContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
          disabledContentColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
        ),
        contentPadding = PaddingValues(horizontal = DorkSpacing.xl, vertical = DorkSpacing.s),
        interactionSource = interactionSource
      ) {
        ButtonContent(text, loading, leadingIcon, trailingIcon, MaterialTheme.colorScheme.onPrimary)
      }
    }
    DorkButtonVariant.Secondary -> {
      OutlinedButton(
        onClick = onClick,
        modifier = finalModifier,
        enabled = enabled && !loading,
        shape = shape,
        border = BorderStroke(1.dp, Color.Transparent),
        colors = ButtonDefaults.outlinedButtonColors(
          containerColor = DorkTheme.colors.surfaceSecondary,
          contentColor = DorkTheme.colors.textPrimary,
          disabledContainerColor = DorkTheme.colors.surfaceSecondary.copy(alpha = 0.4f),
          disabledContentColor = DorkTheme.colors.textSecondary.copy(alpha = 0.4f)
        ),
        contentPadding = PaddingValues(horizontal = DorkSpacing.xl, vertical = DorkSpacing.s),
        interactionSource = interactionSource
      ) {
        ButtonContent(text, loading, leadingIcon, trailingIcon, DorkTheme.colors.textPrimary)
      }
    }
    DorkButtonVariant.Ghost -> {
      TextButton(
        onClick = onClick,
        modifier = finalModifier,
        enabled = enabled && !loading,
        shape = shape,
        colors = ButtonDefaults.textButtonColors(
          contentColor = MaterialTheme.colorScheme.primary
        ),
        contentPadding = PaddingValues(horizontal = DorkSpacing.m, vertical = DorkSpacing.s),
        interactionSource = interactionSource
      ) {
        ButtonContent(text, loading, leadingIcon, trailingIcon, MaterialTheme.colorScheme.primary)
      }
    }
    DorkButtonVariant.Critical -> {
      Button(
        onClick = onClick,
        modifier = finalModifier,
        enabled = enabled && !loading,
        shape = shape,
        colors = ButtonDefaults.buttonColors(
          containerColor = DorkTheme.colors.critical,
          contentColor = Color.White
        ),
        contentPadding = PaddingValues(horizontal = DorkSpacing.xl, vertical = DorkSpacing.s),
        interactionSource = interactionSource
      ) {
        ButtonContent(text, loading, leadingIcon, trailingIcon, Color.White)
      }
    }
  }
}

@Composable
private fun ButtonContent(
  text: String,
  loading: Boolean,
  leadingIcon: @Composable (() -> Unit)?,
  trailingIcon: @Composable (() -> Unit)?,
  contentColor: Color
) {
  Row(verticalAlignment = Alignment.CenterVertically) {
    if (loading) {
      CircularProgressIndicator(
        modifier = Modifier.size(18.dp),
        strokeWidth = 2.dp,
        color = contentColor
      )
      Spacer(modifier = Modifier.width(DorkSpacing.s))
    } else {
      leadingIcon?.let {
        it()
        Spacer(modifier = Modifier.width(DorkSpacing.xs))
      }
    }
    Text(
      text = text,
      style = MaterialTheme.typography.labelLarge,
      color = contentColor
    )
    if (!loading && trailingIcon != null) {
      Spacer(modifier = Modifier.width(DorkSpacing.xs))
      trailingIcon()
    }
  }
}
