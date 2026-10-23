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
  val canvas: Color,
  val card: Color,
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
  val cardShadow: Color,
  val lime: Color,
  val limeInk: Color,
  val pink: Color,
  val pinkInk: Color,
  val peach: Color,
  val peachInk: Color,
  val sage: Color,
  val sageInk: Color,
  val sky: Color,
  val skyInk: Color
)

val LocalDorkExtendedColors = staticCompositionLocalOf {
  DorkExtendedColors(
    canvas = DorkColors.LightBackground,
    card = DorkColors.LightSurface,
    surfaceSecondary = DorkColors.LightSurfaceSecondary,
    surfaceBorder = DorkColors.LightSurfaceBorder,
    surfaceBorderSubtle = DorkColors.LightSurfaceBorderSubtle,
    textPrimary = DorkColors.TextPrimaryLight,
    textSecondary = DorkColors.TextSecondaryLight,
    textTertiary = DorkColors.TextTertiaryLight,
    accentTeal = DorkColors.AccentInk,
    accentTealContainer = DorkColors.AccentNeutral,
    accentSlate = DorkColors.AccentSlate,
    success = DorkColors.Success,
    successContainer = DorkColors.SuccessLight,
    warning = DorkColors.Warning,
    warningContainer = DorkColors.WarningLight,
    critical = DorkColors.Critical,
    criticalContainer = DorkColors.CriticalLight,
    info = DorkColors.Info,
    infoContainer = DorkColors.InfoLight,
    cardShadow = DorkColors.CardShadowLight,
    lime = DorkColors.Lime,
    limeInk = DorkColors.LimeInk,
    pink = DorkColors.Pink,
    pinkInk = DorkColors.PinkInk,
    peach = DorkColors.Peach,
    peachInk = DorkColors.PeachInk,
    sage = DorkColors.Sage,
    sageInk = DorkColors.SageInk,
    sky = DorkColors.Sky,
    skyInk = DorkColors.SkyInk
  )
}

private val LightColorScheme = lightColorScheme(
  primary = DorkColors.AccentInk,
  onPrimary = Color.White,
  primaryContainer = DorkColors.AccentNeutral,
  onPrimaryContainer = DorkColors.AccentInk,
  secondary = DorkColors.LimeInk,
  onSecondary = DorkColors.Lime,
  secondaryContainer = DorkColors.Lime,
  onSecondaryContainer = DorkColors.LimeInk,
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
  primary = Color(0xFFF4F3F0),
  onPrimary = DorkColors.DarkBackground,
  primaryContainer = DorkColors.DarkSurfaceSecondary,
  onPrimaryContainer = Color(0xFFF4F3F0),
  secondary = DorkColors.Lime,
  onSecondary = DorkColors.LimeInk,
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
      canvas = DorkColors.DarkBackground,
      card = DorkColors.DarkSurface,
      surfaceSecondary = DorkColors.DarkSurfaceSecondary,
      surfaceBorder = DorkColors.DarkSurfaceBorder,
      surfaceBorderSubtle = DorkColors.DarkSurfaceBorderSubtle,
      textPrimary = DorkColors.TextPrimaryDark,
      textSecondary = DorkColors.TextSecondaryDark,
      textTertiary = DorkColors.TextTertiaryDark,
      accentTeal = Color(0xFFF4F3F0),
      accentTealContainer = DorkColors.DarkSurfaceSecondary,
      accentSlate = DorkColors.AccentSlateDark,
      success = DorkColors.SuccessDark,
      successContainer = Color(0xFF1F2E1C),
      warning = DorkColors.WarningDark,
      warningContainer = Color(0xFF33280F),
      critical = DorkColors.CriticalDark,
      criticalContainer = Color(0xFF341B22),
      info = DorkColors.InfoDark,
      infoContainer = Color(0xFF172433),
      cardShadow = DorkColors.CardShadowDark,
      lime = DorkColors.Lime,
      limeInk = DorkColors.LimeInk,
      pink = Color(0xFF3A2229),
      pinkInk = Color(0xFFF2A9B9),
      peach = Color(0xFF33280F),
      peachInk = Color(0xFFE9C28B),
      sage = Color(0xFF1F2E1C),
      sageInk = Color(0xFF9BC48C),
      sky = Color(0xFF172433),
      skyInk = Color(0xFF9EC0E2)
    )
  } else {
    DorkExtendedColors(
      canvas = DorkColors.LightBackground,
      card = DorkColors.LightSurface,
      surfaceSecondary = DorkColors.LightSurfaceSecondary,
      surfaceBorder = DorkColors.LightSurfaceBorder,
      surfaceBorderSubtle = DorkColors.LightSurfaceBorderSubtle,
      textPrimary = DorkColors.TextPrimaryLight,
      textSecondary = DorkColors.TextSecondaryLight,
      textTertiary = DorkColors.TextTertiaryLight,
      accentTeal = DorkColors.AccentInk,
      accentTealContainer = DorkColors.AccentNeutral,
      accentSlate = DorkColors.AccentSlate,
      success = DorkColors.Success,
      successContainer = DorkColors.SuccessLight,
      warning = DorkColors.Warning,
      warningContainer = DorkColors.WarningLight,
      critical = DorkColors.Critical,
      criticalContainer = DorkColors.CriticalLight,
      info = DorkColors.Info,
      infoContainer = DorkColors.InfoLight,
      cardShadow = DorkColors.CardShadowLight,
      lime = DorkColors.Lime,
      limeInk = DorkColors.LimeInk,
      pink = DorkColors.Pink,
      pinkInk = DorkColors.PinkInk,
      peach = DorkColors.Peach,
      peachInk = DorkColors.PeachInk,
      sage = DorkColors.Sage,
      sageInk = DorkColors.SageInk,
      sky = DorkColors.Sky,
      skyInk = DorkColors.SkyInk
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
