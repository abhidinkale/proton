package health.dork.app.core.designsystem

import androidx.compose.ui.graphics.Color

/**
 * Dork Color Token Palette.
 *
 * Designed with Apple-level restraint, calm clinical sophistication, and high readability.
 * Avoids aggressive hospital blues and harsh rainbow health dashboards.
 */
object DorkColors {
  // Light Foundation
  val LightBackground = Color(0xFFFBFBFA)
  val LightSurface = Color(0xFFFFFFFF)
  val LightSurfaceSecondary = Color(0xFFF4F5F6)
  val LightSurfaceBorder = Color(0xFFE5E7EB)
  val LightSurfaceBorderSubtle = Color(0xFFF0F2F4)

  // Dark Foundation (genuine dark theme, not inverted)
  val DarkBackground = Color(0xFF0F1115)
  val DarkSurface = Color(0xFF171A21)
  val DarkSurfaceSecondary = Color(0xFF1F232C)
  val DarkSurfaceBorder = Color(0xFF2B303C)
  val DarkSurfaceBorderSubtle = Color(0xFF222630)

  // Typography - Light
  val TextPrimaryLight = Color(0xFF111827)
  val TextSecondaryLight = Color(0xFF6B7280)
  val TextTertiaryLight = Color(0xFF9CA3AF)

  // Typography - Dark
  val TextPrimaryDark = Color(0xFFF9FAFB)
  val TextSecondaryDark = Color(0xFF9CA3AF)
  val TextTertiaryDark = Color(0xFF6B7280)

  // Primary Accent: Dork Deep Teal / Pine / Sage
  val AccentTeal = Color(0xFF0F766E)
  val AccentTealLight = Color(0xFFE6F4F1)
  val AccentTealDark = Color(0xFF2DD4BF)
  val AccentTealDarkSurface = Color(0xFF132E2C)

  // Secondary Technology Accent: Muted Slate Cyan
  val AccentSlate = Color(0xFF0284C7)
  val AccentSlateLight = Color(0xFFE0F2FE)
  val AccentSlateDark = Color(0xFF38BDF8)

  // Semantic Status Colors
  val Success = Color(0xFF059669)
  val SuccessLight = Color(0xFFD1FAE5)
  val SuccessDark = Color(0xFF34D399)

  val Warning = Color(0xFFD97706)
  val WarningLight = Color(0xFFFEF3C7)
  val WarningDark = Color(0xFFFBBF24)

  val Critical = Color(0xFFDC2626)
  val CriticalLight = Color(0xFFFEE2E2)
  val CriticalDark = Color(0xFFF87171)

  val Info = Color(0xFF2563EB)
  val InfoLight = Color(0xFFDBEAFE)
  val InfoDark = Color(0xFF60A5FA)

  // Card Overlays & Shadows
  val CardShadowLight = Color(0x0A000000)
  val CardShadowDark = Color(0x33000000)
}
