package health.dork.app.core.designsystem

import androidx.compose.ui.graphics.Color

/**
 * Dork Color Token Palette.
 *
 * Warm, editorial, instrument-like. The canvas is a soft grey paper, cards are
 * borderless white, and colour is reserved for clinical signal (score cards,
 * allergy tags, dose state) rather than decoration.
 */
object DorkColors {
  // Light Foundation — warm paper
  val LightBackground = Color(0xFFEDECEA)
  val LightSurface = Color(0xFFFFFFFF)
  val LightSurfaceSecondary = Color(0xFFF6F5F3)
  val LightSurfaceBorder = Color(0xFFE4E2DE)
  val LightSurfaceBorderSubtle = Color(0xFFEFEDE9)

  // Dark Foundation (warm charcoal, not inverted)
  val DarkBackground = Color(0xFF141413)
  val DarkSurface = Color(0xFF1D1D1B)
  val DarkSurfaceSecondary = Color(0xFF262624)
  val DarkSurfaceBorder = Color(0xFF353533)
  val DarkSurfaceBorderSubtle = Color(0xFF2A2A28)

  // Typography - Light
  val TextPrimaryLight = Color(0xFF151719)
  val TextSecondaryLight = Color(0xFF777774)
  val TextTertiaryLight = Color(0xFFA5A4A0)

  // Typography - Dark
  val TextPrimaryDark = Color(0xFFF4F3F0)
  val TextSecondaryDark = Color(0xFFA5A4A0)
  val TextTertiaryDark = Color(0xFF777774)

  // Primary Accent: Ink (buttons, active pills, signed facts)
  val AccentInk = Color(0xFF151719)
  val AccentInkSoft = Color(0xFF2A2A28)
  val AccentNeutral = Color(0xFFF1F0ED)

  // Signal accents
  val Lime = Color(0xFFDDF25B)
  val LimeInk = Color(0xFF26320A)
  val Pink = Color(0xFFFBE3E8)
  val PinkInk = Color(0xFFB3425C)
  val Peach = Color(0xFFFBEEDC)
  val PeachInk = Color(0xFF9A6224)
  val Sage = Color(0xFFE4EFDF)
  val SageInk = Color(0xFF54764C)
  val Sky = Color(0xFFE3EBF6)
  val SkyInk = Color(0xFF3F6287)

  // Gradient score cards
  val GradientGreenStart = Color(0xFFF4D3A6)
  val GradientGreenMid = Color(0xFFE3DE83)
  val GradientGreenAccent = Color(0xFF6FBE5B)
  val GradientGreenEnd = Color(0xFF1F7A34)

  val GradientEmberStart = Color(0xFFC9D5E6)
  val GradientEmberMid = Color(0xFFE8C6B2)
  val GradientEmberAccent = Color(0xFFF19B52)
  val GradientEmberEnd = Color(0xFFF26B3A)

  val GradientPinkStart = Color(0xFFF7C6CF)
  val GradientPinkMid = Color(0xFFF26B8A)
  val GradientPinkEnd = Color(0xFFE84C74)

  // Legacy compatibility tokens used by a few screens
  val AccentTeal = AccentInk
  val AccentTealLight = AccentNeutral
  val AccentTealDark = Color(0xFFB9C0B4)
  val AccentTealDarkSurface = Color(0xFF262624)

  val AccentSlate = Color(0xFF3F6287)
  val AccentSlateLight = Sky
  val AccentSlateDark = Color(0xFF8FB4D8)

  // Semantic Status Colors
  val Success = SageInk
  val SuccessLight = Sage
  val SuccessDark = Color(0xFF9BC48C)

  val Warning = PeachInk
  val WarningLight = Peach
  val WarningDark = Color(0xFFE9C28B)

  val Critical = PinkInk
  val CriticalLight = Pink
  val CriticalDark = Color(0xFFF2A9B9)

  val Info = SkyInk
  val InfoLight = Sky
  val InfoDark = Color(0xFF9EC0E2)

  // Card Shadows
  val CardShadowLight = Color(0x14000000)
  val CardShadowDark = Color(0x33000000)
}
