package health.dork.app.ui.welcome

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

/**
 * Editorial Hero Welcome Screen matching the luxury brutalist dark-to-ember aesthetic in Dark Mode
 * and serene soft sky-blue to white pastel gradient in Light Mode.
 *
 * Positioned right before the sign-up flow, presenting:
 * - Adaptive Canvas:
 *     - Dark Mode: OLED deep black canvas with radiant warm ember glow blooming in the lower half
 *     - Light Mode: Serene soft sky-blue to white pastel gradient inspired by pristine clinical clarity
 * - Fine crosshair grid with luminous 4-point sparkle star
 * - Monospace marginal indicators (T260, 01X)
 * - "Welcome" eyebrow with inline-capsule headline:
 *     "Explore the [pill]"
 *     "world's [pill] leading"
 *     "healthcare [pill]"
 *     "automation"
 *     "...dork"
 * - Frosted circular options button and high-contrast forward action button.
 */
@Composable
fun WelcomeScreen(
  onGetStarted: () -> Unit,
  onSignInClick: () -> Unit = {},
  onDemoClick: () -> Unit = {},
  darkTheme: Boolean = isSystemInDarkTheme(),
  modifier: Modifier = Modifier
) {
  var showOptionsSheet by remember { mutableStateOf(false) }

  // Theme-aware color variables
  val bgSolid = if (darkTheme) Color.Black else Color.White
  val textPrimary = if (darkTheme) Color.White else Color(0xFF0F172A)
  val textEyebrow = if (darkTheme) Color.White.copy(alpha = 0.78f) else Color(0xFF2E4868)
  val textMarginal = if (darkTheme) Color.White.copy(alpha = 0.35f) else Color(0xFF1E3A5F).copy(alpha = 0.45f)
  val textAutomation = if (darkTheme) Color.White else Color(0xFF090D16)
  val textDork = if (darkTheme) Color.White.copy(alpha = 0.90f) else Color(0xFF1E3A5F)

  val leftBtnBg = if (darkTheme) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.85f)
  val leftBtnBorder = if (darkTheme) Color.White.copy(alpha = 0.22f) else Color(0xFFBDD8F2)
  val leftBtnTint = if (darkTheme) Color.White.copy(alpha = 0.85f) else Color(0xFF1A2B42)

  val rightBtnBg = if (darkTheme) Color.White else Color(0xFF10151E)
  val rightBtnTint = if (darkTheme) Color(0xFF14171A) else Color.White
  val rightBtnSpot = if (darkTheme) Color(0xFFF4511E) else Color(0x331E3A5F)

  DorkTheme(darkTheme = darkTheme) {
    Box(
      modifier = modifier
        .fillMaxSize()
        .background(bgSolid)
    ) {
      // 1. Radiant Ambient Background & Grid Canvas
      WelcomeCanvasBackground(darkTheme = darkTheme, modifier = Modifier.fillMaxSize())

      // 2. Left margin technical annotations
      Column(
        modifier = Modifier
          .align(Alignment.TopStart)
          .statusBarsPadding()
          .padding(top = 180.dp, start = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
      ) {
        Text(
          text = "T260",
          fontFamily = FontFamily.Monospace,
          fontSize = 10.sp,
          fontWeight = FontWeight.Medium,
          letterSpacing = 1.5.sp,
          color = textMarginal,
          modifier = Modifier.rotate(-90f)
        )
        Text(
          text = "01X",
          fontFamily = FontFamily.Monospace,
          fontSize = 10.sp,
          fontWeight = FontWeight.Medium,
          letterSpacing = 1.5.sp,
          color = textMarginal,
          modifier = Modifier.rotate(-90f)
        )
      }

      // 3. Main Content & Headline
      Column(
        modifier = Modifier
          .fillMaxSize()
          .statusBarsPadding()
          .navigationBarsPadding()
          .padding(horizontal = 28.dp),
        verticalArrangement = Arrangement.Bottom
      ) {
        // Eyebrow
        Text(
          text = "Welcome",
          style = MaterialTheme.typography.titleMedium.copy(
            fontFamily = FontFamily.SansSerif,
            fontWeight = FontWeight.Normal,
            fontSize = 17.sp,
            letterSpacing = 0.sp
          ),
          color = textEyebrow
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Line 1: Explore the [pill]
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.Start
        ) {
          Text(
            text = "Explore the",
            style = MaterialTheme.typography.headlineLarge.copy(
              fontFamily = FontFamily.SansSerif,
              fontWeight = FontWeight.Normal,
              fontSize = 32.sp,
              lineHeight = 38.sp,
              letterSpacing = (-0.5).sp
            ),
            color = textPrimary
          )
          Spacer(modifier = Modifier.width(10.dp))
          InlineCapsule(darkTheme = darkTheme)
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Line 2: world's [pill] leading
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.Start
        ) {
          Text(
            text = "world\u2019s",
            style = MaterialTheme.typography.headlineLarge.copy(
              fontFamily = FontFamily.SansSerif,
              fontWeight = FontWeight.Normal,
              fontSize = 32.sp,
              lineHeight = 38.sp,
              letterSpacing = (-0.5).sp
            ),
            color = textPrimary
          )
          Spacer(modifier = Modifier.width(10.dp))
          InlineCapsule(darkTheme = darkTheme)
          Spacer(modifier = Modifier.width(10.dp))
          Text(
            text = "leading",
            style = MaterialTheme.typography.headlineLarge.copy(
              fontFamily = FontFamily.SansSerif,
              fontWeight = FontWeight.Normal,
              fontSize = 32.sp,
              lineHeight = 38.sp,
              letterSpacing = (-0.5).sp
            ),
            color = textPrimary
          )
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Line 3: healthcare [pill]
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.Start
        ) {
          Text(
            text = "healthcare",
            style = MaterialTheme.typography.headlineLarge.copy(
              fontFamily = FontFamily.SansSerif,
              fontWeight = FontWeight.Normal,
              fontSize = 32.sp,
              lineHeight = 38.sp,
              letterSpacing = (-0.5).sp
            ),
            color = textPrimary
          )
          Spacer(modifier = Modifier.width(10.dp))
          InlineCapsule(darkTheme = darkTheme)
        }

        Spacer(modifier = Modifier.height(6.dp))

        // Line 4: automation (bold highlight)
        Text(
          text = "automation",
          style = MaterialTheme.typography.displaySmall.copy(
            fontFamily = FontFamily.SansSerif,
            fontWeight = FontWeight.Bold,
            fontSize = 35.sp,
            lineHeight = 40.sp,
            letterSpacing = (-0.8).sp
          ),
          color = textAutomation
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Line 5: ...dork
        Text(
          text = "...dork",
          style = MaterialTheme.typography.titleLarge.copy(
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.Medium,
            fontSize = 20.sp,
            letterSpacing = 1.2.sp
          ),
          color = textDork
        )

        Spacer(modifier = Modifier.height(48.dp))

        // 4. Bottom Action Bar: [Glass Icon] ... [Solid Action FAB ->]
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 24.dp),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          // Left Frosted Action Button (Options / Sign In / Demo)
          Box(
            modifier = Modifier
              .size(56.dp)
              .clip(CircleShape)
              .background(leftBtnBg)
              .border(1.dp, leftBtnBorder, CircleShape)
              .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = { showOptionsSheet = true }
              ),
            contentAlignment = Alignment.Center
          ) {
            SolarApertureIcon(
              modifier = Modifier.size(24.dp),
              tint = leftBtnTint
            )
          }

          // Right Solid High-Contrast Action Button (Forward -> Sign Up / Onboarding)
          Box(
            modifier = Modifier
              .size(64.dp)
              .shadow(elevation = 12.dp, shape = CircleShape, spotColor = rightBtnSpot)
              .clip(CircleShape)
              .background(rightBtnBg)
              .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onGetStarted
              ),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = Icons.AutoMirrored.Rounded.ArrowForward,
              contentDescription = "Get Started",
              tint = rightBtnTint,
              modifier = Modifier.size(26.dp)
            )
          }
        }
      }

      // 5. Secondary Options Sheet (Glass overlay when left button tapped)
      AnimatedVisibility(
        visible = showOptionsSheet,
        enter = fadeIn() + slideInVertically { it / 2 },
        exit = fadeOut() + slideOutVertically { it / 2 }
      ) {
        val sheetBg = if (darkTheme) Color(0xFF181B22) else Color.White
        val sheetBorder = if (darkTheme) Color.White.copy(alpha = 0.14f) else Color(0xFFD6E4F0)
        val sheetItemBg = if (darkTheme) Color.White.copy(alpha = 0.08f) else Color(0xFFF4F7FB)
        val sheetItemBorder = if (darkTheme) Color.Transparent else Color(0xFFE2ECF7)
        val sheetTitle = if (darkTheme) Color.White else Color(0xFF10151E)
        val sheetSub = if (darkTheme) Color.White.copy(alpha = 0.60f) else Color(0xFF64748B)

        Box(
          modifier = Modifier
            .fillMaxSize()
            .background(if (darkTheme) Color.Black.copy(alpha = 0.70f) else Color.Black.copy(alpha = 0.45f))
            .clickable(
              interactionSource = remember { MutableInteractionSource() },
              indication = null,
              onClick = { showOptionsSheet = false }
            ),
          contentAlignment = Alignment.BottomCenter
        ) {
          Surface(
            modifier = Modifier
              .fillMaxWidth()
              .padding(16.dp)
              .navigationBarsPadding(),
            shape = RoundedCornerShape(24.dp),
            color = sheetBg,
            border = BorderStroke(1.dp, sheetBorder),
            tonalElevation = 8.dp
          ) {
            Column(
              modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
            ) {
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
              ) {
                Text(
                  text = "Dork Health",
                  style = MaterialTheme.typography.titleMedium,
                  fontWeight = FontWeight.SemiBold,
                  color = sheetTitle
                )
                Box(
                  modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(if (darkTheme) Color.White.copy(alpha = 0.10f) else Color(0xFFEFF3F8))
                    .clickable { showOptionsSheet = false },
                  contentAlignment = Alignment.Center
                ) {
                  Icon(
                    imageVector = Icons.Rounded.Close,
                    contentDescription = "Close",
                    tint = if (darkTheme) Color.White else Color(0xFF4C586B),
                    modifier = Modifier.size(18.dp)
                  )
                }
              }

              Spacer(modifier = Modifier.height(16.dp))

              // Option 1: Sign in with existing account
              Row(
                modifier = Modifier
                  .fillMaxWidth()
                  .clip(RoundedCornerShape(14.dp))
                  .background(sheetItemBg)
                  .border(1.dp, sheetItemBorder, RoundedCornerShape(14.dp))
                  .clickable {
                    showOptionsSheet = false
                    onSignInClick()
                  }
                  .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = Icons.Rounded.Lock,
                  contentDescription = null,
                  tint = if (darkTheme) Color.White else Color(0xFF10151E),
                  modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                  Text(
                    text = "Sign in to existing account",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = sheetTitle
                  )
                  Text(
                    text = "Returning patients with a local password",
                    style = MaterialTheme.typography.bodySmall,
                    color = sheetSub
                  )
                }
              }

              Spacer(modifier = Modifier.height(10.dp))

              // Option 2: Demo record
              Row(
                modifier = Modifier
                  .fillMaxWidth()
                  .clip(RoundedCornerShape(14.dp))
                  .background(sheetItemBg)
                  .border(1.dp, sheetItemBorder, RoundedCornerShape(14.dp))
                  .clickable {
                    showOptionsSheet = false
                    onDemoClick()
                  }
                  .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = Icons.Rounded.Shield,
                  contentDescription = null,
                  tint = if (darkTheme) Color(0xFFFFA063) else Color(0xFFE65100),
                  modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                  Text(
                    text = "Open synthetic demo patient",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = sheetTitle
                  )
                  Text(
                    text = "Explore offline clinical workflows safely",
                    style = MaterialTheme.typography.bodySmall,
                    color = sheetSub
                  )
                }
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Capsule / Pill graphic element embedded in headline lines.
 */
@Composable
private fun InlineCapsule(darkTheme: Boolean, modifier: Modifier = Modifier) {
  val bg = if (darkTheme) Color.White.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.70f)
  val border = if (darkTheme) Color.White.copy(alpha = 0.32f) else Color(0xFF96BDE4)
  val dotColor = if (darkTheme) Color.White.copy(alpha = 0.45f) else Color(0xFF244F7D)

  Box(
    modifier = modifier
      .size(width = 38.dp, height = 20.dp)
      .clip(RoundedCornerShape(percent = 50))
      .background(bg)
      .border(1.dp, border, RoundedCornerShape(percent = 50)),
    contentAlignment = Alignment.Center
  ) {
    Box(
      modifier = Modifier
        .size(width = 12.dp, height = 6.dp)
        .clip(RoundedCornerShape(percent = 50))
        .background(dotColor)
    )
  }
}

/**
 * Draws the rich radiant ember glow (Dark Mode) or serene sky-blue soft gradient (Light Mode)
 * and the precision crosshair star grid.
 */
@Composable
private fun WelcomeCanvasBackground(darkTheme: Boolean, modifier: Modifier = Modifier) {
  Canvas(modifier = modifier) {
    val width = size.width
    val height = size.height

    if (darkTheme) {
      // 1. Primary Warm Radiant Glow (bottom-right / bottom-center focus)
      val radialBrush = Brush.radialGradient(
        colorStops = arrayOf(
          0.00f to Color(0xFFFFB74D).copy(alpha = 0.95f),
          0.18f to Color(0xFFF4511E).copy(alpha = 0.92f),
          0.35f to Color(0xFFD84315).copy(alpha = 0.88f),
          0.52f to Color(0xFFB71C1C).copy(alpha = 0.80f),
          0.70f to Color(0xFF4A0E08).copy(alpha = 0.65f),
          0.85f to Color(0xFF140403).copy(alpha = 0.35f),
          1.00f to Color.Transparent
        ),
        center = Offset(width * 0.72f, height * 0.84f),
        radius = height * 0.72f
      )
      drawRect(brush = radialBrush)

      // 2. Secondary Magenta/Rose Ambient Flare on the left diagonal
      val secondaryGlow = Brush.radialGradient(
        colorStops = arrayOf(
          0.00f to Color(0xFFAD1457).copy(alpha = 0.35f),
          0.45f to Color(0xFF880E4F).copy(alpha = 0.18f),
          1.00f to Color.Transparent
        ),
        center = Offset(width * 0.15f, height * 0.72f),
        radius = height * 0.50f
      )
      drawRect(brush = secondaryGlow)
    } else {
      // Light Mode: Serene soft sky-blue to white pastel gradient
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

      // Soft radiant azure mist on upper-left to echo the subtle luminescence
      val mistGlow = Brush.radialGradient(
        colorStops = arrayOf(
          0.00f to Color(0xFF7CB8F7).copy(alpha = 0.30f),
          0.50f to Color(0xFFA5D1FC).copy(alpha = 0.12f),
          1.00f to Color.Transparent
        ),
        center = Offset(width * 0.20f, height * 0.25f),
        radius = height * 0.45f
      )
      drawRect(brush = mistGlow)
    }

    // 3. Precision Hairline Grid
    val crosshairX = width * 0.50f
    val crosshairY = height * 0.28f
    val gridColor = if (darkTheme) Color.White.copy(alpha = 0.08f) else Color(0xFF2A527A).copy(alpha = 0.12f)

    // Vertical line (from top down to middle)
    drawLine(
      color = gridColor,
      start = Offset(crosshairX, 0f),
      end = Offset(crosshairX, height * 0.46f),
      strokeWidth = 1.dp.toPx()
    )

    // Horizontal line (across full width)
    drawLine(
      color = gridColor,
      start = Offset(0f, crosshairY),
      end = Offset(width, crosshairY),
      strokeWidth = 1.dp.toPx()
    )

    // 4. Luminous 4-Point Sparkle Star at Crosshair Center
    val starRadius = 18.dp.toPx()
    val haloRadius = 40.dp.toPx()

    val haloColors = if (darkTheme) {
      listOf(
        Color(0xFFFFA063).copy(alpha = 0.35f),
        Color(0xFFF4511E).copy(alpha = 0.15f),
        Color.Transparent
      )
    } else {
      listOf(
        Color(0xFF7CB8F7).copy(alpha = 0.45f),
        Color(0xFF99C8F6).copy(alpha = 0.20f),
        Color.Transparent
      )
    }

    // Halo glow
    drawCircle(
      brush = Brush.radialGradient(
        colors = haloColors,
        center = Offset(crosshairX, crosshairY),
        radius = haloRadius
      ),
      radius = haloRadius,
      center = Offset(crosshairX, crosshairY)
    )

    // 4-point Star Shape (concave curved diamond)
    val starPath = Path().apply {
      moveTo(crosshairX, crosshairY - starRadius)
      // Top to Right tip
      quadraticTo(crosshairX + starRadius * 0.16f, crosshairY - starRadius * 0.16f, crosshairX + starRadius, crosshairY)
      // Right to Bottom tip
      quadraticTo(crosshairX + starRadius * 0.16f, crosshairY + starRadius * 0.16f, crosshairX, crosshairY + starRadius)
      // Bottom to Left tip
      quadraticTo(crosshairX - starRadius * 0.16f, crosshairY + starRadius * 0.16f, crosshairX - starRadius, crosshairY)
      // Left to Top tip
      quadraticTo(crosshairX - starRadius * 0.16f, crosshairY - starRadius * 0.16f, crosshairX, crosshairY - starRadius)
      close()
    }

    val starColor = if (darkTheme) Color.White.copy(alpha = 0.92f) else Color(0xFF1E3A5F)
    drawPath(
      path = starPath,
      color = starColor
    )
  }
}

/**
 * Solar Aperture icon drawn with geometric precision.
 */
@Composable
private fun SolarApertureIcon(
  modifier: Modifier = Modifier,
  tint: Color = Color.White
) {
  Canvas(modifier = modifier) {
    val center = Offset(size.width / 2, size.height / 2)
    val outerR = size.width * 0.40f
    val innerR = size.width * 0.20f

    // Center circle
    drawCircle(
      color = tint,
      radius = innerR,
      style = Stroke(width = 1.6.dp.toPx())
    )

    // 8 radial notches
    for (i in 0 until 8) {
      val angle = Math.toRadians((i * 45).toDouble())
      val cos = Math.cos(angle).toFloat()
      val sin = Math.sin(angle).toFloat()

      val start = Offset(center.x + innerR * 1.3f * cos, center.y + innerR * 1.3f * sin)
      val end = Offset(center.x + outerR * cos, center.y + outerR * sin)

      drawLine(
        color = tint,
        start = start,
        end = end,
        strokeWidth = 1.6.dp.toPx(),
        cap = StrokeCap.Round
      )
    }
  }
}
