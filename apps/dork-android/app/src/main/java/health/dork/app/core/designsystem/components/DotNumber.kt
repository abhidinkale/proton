package health.dork.app.core.designsystem.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkTheme

/**
 * Dot-matrix numerals.
 *
 * Values are drawn as a 5x7 dot matrix so a metric reads as instrument output
 * rather than body copy. The glyph table is intentionally tiny and rendered with
 * circles, which keeps it crisp at any density and independent of font loading.
 */
private val GLYPHS: Map<Char, List<String>> = mapOf(
  '0' to listOf("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
  '1' to listOf("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
  '2' to listOf("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
  '3' to listOf("11111", "00010", "00100", "00010", "00001", "10001", "01110"),
  '4' to listOf("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
  '5' to listOf("11111", "10000", "11110", "00001", "00001", "10001", "01110"),
  '6' to listOf("00110", "01000", "10000", "11110", "10001", "10001", "01110"),
  '7' to listOf("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
  '8' to listOf("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
  '9' to listOf("01110", "10001", "10001", "01111", "00001", "00010", "01100"),
  '/' to listOf("00001", "00010", "00010", "00100", "01000", "01000", "10000"),
  '-' to listOf("00000", "00000", "00000", "11111", "00000", "00000", "00000"),
  '.' to listOf("00000", "00000", "00000", "00000", "00000", "01100", "01100"),
  '%' to listOf("11001", "11010", "00010", "00100", "01000", "01011", "10011")
)

@Composable
fun DotNumber(
  value: String,
  modifier: Modifier = Modifier,
  dotRadius: Dp = 1.0.dp,
  pitch: Dp = 3.6.dp,
  color: Color = DorkTheme.colors.textPrimary,
  contentDescription: String? = null
) {
  val text = value
  val charGapRatio = 1.45f
  val dotsWide = 5f * text.length + charGapRatio * (text.length - 1).coerceAtLeast(0)
  val widthDp = pitch * dotsWide
  val heightDp = pitch * 7f

  Canvas(
    modifier = modifier
      .width(widthDp)
      .height(heightDp)
      .semantics { this.contentDescription = contentDescription ?: text }
  ) {
    val dotPx = dotRadius.toPx()
    val pitchPx = pitch.toPx()
    val gapPx = pitchPx * charGapRatio

    text.forEachIndexed { charIndex, character ->
      val glyph = GLYPHS[character] ?: return@forEachIndexed
      val originX = charIndex * (pitchPx * 5 + gapPx)

      glyph.forEachIndexed { rowIndex, row ->
        row.forEachIndexed { columnIndex, bit ->
          if (bit == '1') {
            drawCircle(
              color = color,
              radius = dotPx,
              center = Offset(
                x = originX + columnIndex * pitchPx + pitchPx / 2f,
                y = rowIndex * pitchPx + pitchPx / 2f
              )
            )
          }
        }
      }
    }
  }
}

/**
 * Dotted trend line. Values are normalised 0..1 and sampled left to right.
 */
@Composable
fun DotSparkline(
  values: List<Float>,
  modifier: Modifier = Modifier,
  color: Color = DorkTheme.colors.textPrimary,
  dotRadius: Dp = 2.dp
) {
  if (values.size < 2) return

  Canvas(modifier = modifier) {
    val radius = dotRadius.toPx()
    val stepX = size.width / (values.size - 1).toFloat()

    values.forEachIndexed { index, raw ->
      val value = raw.coerceIn(0f, 1f)
      drawCircle(
        color = color.copy(alpha = 0.55f + value * 0.45f),
        radius = radius,
        center = Offset(
          x = index * stepX,
          y = size.height - value * size.height
        )
      )
    }
  }
}

/**
 * Dotted meter — a quiet alternative to a progress bar.
 */
@Composable
fun DotMeter(
  filled: Int,
  modifier: Modifier = Modifier,
  count: Int = 11,
  color: Color = DorkTheme.colors.textPrimary
) {
  Canvas(modifier = modifier) {
    val steps = count.coerceAtLeast(1)
    val stepX = if (steps > 1) size.width / (steps - 1) else 0f
    val radius = (size.width / steps) * 0.22f

    repeat(steps) { index ->
      val heightFactor = 0.35f + (index.toFloat() / steps) * 0.65f
      drawCircle(
        color = color.copy(alpha = if (index < filled) 0.95f else 0.2f),
        radius = radius,
        center = Offset(
          x = index * stepX,
          y = size.height - (size.height * heightFactor) + radius
        )
      )
    }
  }
}
