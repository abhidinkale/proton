package health.dork.app.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

@Immutable
data class DorkExtendedColors(
  val surfaceSecondary: Color,
  val surfaceBorder: Color,
  val surfaceBorderSubtle: Color,
  val textPrimary: Color,
  val textSecondary: Color,
  val textTertiary: Color,
  val accentTeal: Color,
  val accentTealContainer: Color,
  val accentSlate: Color,
  val success: Color,
  val successContainer: Color,
  val warning: Color,
  val warningContainer: Color,
  val critical: Color,
  val criticalContainer: Color,
  val info: Color,
  val infoContainer: Color,
  val cardShadow: Color
)

val LocalDorkExtendedColors = staticCompositionLocalOf {
  DorkExtendedColors(
    surfaceSecondary = DorkColors.LightSurfaceSecondary,
    surfaceBorder = DorkColors.LightSurfaceBorder,
    surfaceBorderSubtle = DorkColors.LightSurfaceBorderSubtle,
    textPrimary = DorkColors.TextPrimaryLight,
    textSecondary = DorkColors.TextSecondaryLight,
    textTertiary = DorkColors.TextTertiaryLight,
    accentTeal = DorkColors.AccentTeal,
    accentTealContainer = DorkColors.AccentTealLight,
    accentSlate = DorkColors.AccentSlate,
    success = DorkColors.Success,
    successContainer = DorkColors.SuccessLight,
    warning = DorkColors.Warning,
    warningContainer = DorkColors.WarningLight,
    critical = DorkColors.Critical,
    criticalContainer = DorkColors.CriticalLight,
    info = DorkColors.Info,
    infoContainer = DorkColors.InfoLight,
    cardShadow = DorkColors.CardShadowLight
  )
}

private val LightColorScheme = lightColorScheme(
  primary = DorkColors.AccentTeal,
  onPrimary = Color.White,
  primaryContainer = DorkColors.AccentTealLight,
  onPrimaryContainer = DorkColors.AccentTeal,
  secondary = DorkColors.AccentSlate,
  onSecondary = Color.White,
  background = DorkColors.LightBackground,
  onBackground = DorkColors.TextPrimaryLight,
  surface = DorkColors.LightSurface,
  onSurface = DorkColors.TextPrimaryLight,
  surfaceVariant = DorkColors.LightSurfaceSecondary,
  onSurfaceVariant = DorkColors.TextSecondaryLight,
  outline = DorkColors.LightSurfaceBorder,
  outlineVariant = DorkColors.LightSurfaceBorderSubtle,
  error = DorkColors.Critical,
  onError = Color.White,
  errorContainer = DorkColors.CriticalLight,
  onErrorContainer = DorkColors.Critical
)

private val DarkColorScheme = darkColorScheme(
  primary = DorkColors.AccentTealDark,
  onPrimary = DorkColors.DarkBackground,
  primaryContainer = DorkColors.AccentTealDarkSurface,
  onPrimaryContainer = DorkColors.AccentTealDark,
  secondary = DorkColors.AccentSlateDark,
  onSecondary = DorkColors.DarkBackground,
  background = DorkColors.DarkBackground,
  onBackground = DorkColors.TextPrimaryDark,
  surface = DorkColors.DarkSurface,
  onSurface = DorkColors.TextPrimaryDark,
  surfaceVariant = DorkColors.DarkSurfaceSecondary,
  onSurfaceVariant = DorkColors.TextSecondaryDark,
  outline = DorkColors.DarkSurfaceBorder,
  outlineVariant = DorkColors.DarkSurfaceBorderSubtle,
  error = DorkColors.CriticalDark,
  onError = DorkColors.DarkBackground,
  errorContainer = DorkColors.Critical,
  onErrorContainer = Color.White
)

object DorkTheme {
  val colors: DorkExtendedColors
    @Composable
    get() = LocalDorkExtendedColors.current

  val spacing: DorkSpacing = DorkSpacing
  val shapes: DorkShapes = DorkShapes
}

@Composable
fun DorkTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  content: @Composable () -> Unit
) {
  val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

  val extendedColors = if (darkTheme) {
    DorkExtendedColors(
      surfaceSecondary = DorkColors.DarkSurfaceSecondary,
      surfaceBorder = DorkColors.DarkSurfaceBorder,
      surfaceBorderSubtle = DorkColors.DarkSurfaceBorderSubtle,
      textPrimary = DorkColors.TextPrimaryDark,
      textSecondary = DorkColors.TextSecondaryDark,
      textTertiary = DorkColors.TextTertiaryDark,
      accentTeal = DorkColors.AccentTealDark,
      accentTealContainer = DorkColors.AccentTealDarkSurface,
      accentSlate = DorkColors.AccentSlateDark,
      success = DorkColors.SuccessDark,
      successContainer = DorkColors.Success,
      warning = DorkColors.WarningDark,
      warningContainer = DorkColors.Warning,
      critical = DorkColors.CriticalDark,
      criticalContainer = DorkColors.Critical,
      info = DorkColors.InfoDark,
      infoContainer = DorkColors.Info,
      cardShadow = DorkColors.CardShadowDark
    )
  } else {
    DorkExtendedColors(
      surfaceSecondary = DorkColors.LightSurfaceSecondary,
      surfaceBorder = DorkColors.LightSurfaceBorder,
      surfaceBorderSubtle = DorkColors.LightSurfaceBorderSubtle,
      textPrimary = DorkColors.TextPrimaryLight,
      textSecondary = DorkColors.TextSecondaryLight,
      textTertiary = DorkColors.TextTertiaryLight,
      accentTeal = DorkColors.AccentTeal,
      accentTealContainer = DorkColors.AccentTealLight,
      accentSlate = DorkColors.AccentSlate,
      success = DorkColors.Success,
      successContainer = DorkColors.SuccessLight,
      warning = DorkColors.Warning,
      warningContainer = DorkColors.WarningLight,
      critical = DorkColors.Critical,
      criticalContainer = DorkColors.CriticalLight,
      info = DorkColors.Info,
      infoContainer = DorkColors.InfoLight,
      cardShadow = DorkColors.CardShadowLight
    )
  }

  CompositionLocalProvider(
    LocalDorkExtendedColors provides extendedColors
  ) {
    MaterialTheme(
      colorScheme = colorScheme,
      typography = DorkTypography,
      content = content
    )
  }
}
