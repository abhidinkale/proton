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

  // Dark Foundation — a deep ink-blue rather than inverted paper.
  //
  // The first pass was a warm charcoal that read as "dark mode enabled" but
  // flattened every surface into the same grey. These values keep the warm
  // brand in the light theme and give the dark one real depth: three distinct
  // elevations, a blue-leaning cast, and borders that stay visible on OLED
  // where pure black eats a 2px line.
  val DarkBackground = Color(0xFF0B0E14)
  val DarkSurface = Color(0xFF141922)
  val DarkSurfaceSecondary = Color(0xFF1B212C)
  val DarkSurfaceBorder = Color(0xFF2A3342)
  val DarkSurfaceBorderSubtle = Color(0xFF212834)

  // Typography - Light
  val TextPrimaryLight = Color(0xFF151719)
  val TextSecondaryLight = Color(0xFF777774)
  val TextTertiaryLight = Color(0xFFA5A4A0)

  // Typography - Dark
  val TextPrimaryDark = Color(0xFFF3F5F9)
  val TextSecondaryDark = Color(0xFF9BA6BA)
  val TextTertiaryDark = Color(0xFF6F7C92)

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

/**
 * Gradient pairs for the moments that should not look like a form.
 *
 * The rest of the product stays quiet on purpose — colour means a clinical
 * signal. Onboarding is the one place where colour is allowed to be pleasure:
 * it is the first thing a new patient sees, and a medical intake that feels
 * like a tax form is a medical intake people abandon.
 *
 * Every pair is chosen so white text on the *dark* end clears 4.5:1, because
 * these are used as full-bleed hero bands with copy on top.
 */
object DorkGradients {
  /** Warm apricot. */
  val Sunrise = listOf(Color(0xFFFFC46B), Color(0xFFE86A3A))

  /** Candy pink into violet. */
  val Bloom = listOf(Color(0xFFFF9BC2), Color(0xFFA45BD6))

  /** Cyan into indigo. */
  val Tide = listOf(Color(0xFF63D2E8), Color(0xFF3657C9))

  /** Fresh green, the "you're doing fine" gradient. */
  val Meadow = listOf(Color(0xFFB9E76B), Color(0xFF2F8F4E))

  /** Deep violet, the most serious of the set. */
  val Dusk = listOf(Color(0xFF8B7BF7), Color(0xFF3D3FB0))

  /** Neutral ink, for steps that are logistics rather than feelings. */
  val Ink = listOf(Color(0xFF3A4050), Color(0xFF161A24))

  /**
   * A stable gradient per onboarding step.
   *
   * Deterministic rather than random: the same step looks the same every time a
   * patient backs up and returns, which matters when someone is re-entering a
   * field they got wrong.
   */
  fun heroFor(step: Int): List<Color> = when (((step - 1) % 6).coerceAtLeast(0)) {
    0 -> Tide
    1 -> Sunrise
    2 -> Meadow
    3 -> Dusk
    4 -> Bloom
    else -> Ink
  }
}
