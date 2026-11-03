package health.dork.app.core.designsystem.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.BiomarkerTrendSeries
import health.dork.app.core.data.model.LabStatus
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

/**
 * High-precision physiological biomarker trajectory chart.
 *
 * Visualizes longitudinal trends across medical encounters with:
 * - A shaded green target corridor representing the clinical reference range.
 * - Smooth cubic bezier interpolation between verified lab observations.
 * - Interactive tap inspection revealing point-in-time laboratory readings.
 */
@Composable
fun BiomarkerTrendChart(
  trend: BiomarkerTrendSeries,
  modifier: Modifier = Modifier
) {
  var selectedIndex by remember { mutableIntStateOf(trend.points.size - 1) }
  val activePoint = trend.points.getOrNull(selectedIndex) ?: trend.latestPoint

  val statusBadgeType = when (activePoint?.status) {
    LabStatus.WITHIN_RANGE -> DorkStatusType.Success
    LabStatus.ABOVE_RANGE, LabStatus.BELOW_RANGE -> DorkStatusType.Warning
    null -> DorkStatusType.Info
  }

  val lineColor = DorkTheme.colors.accentSlate
  val safeBandColor = DorkTheme.colors.sage.copy(alpha = 0.35f)
  val safeLineColor = DorkTheme.colors.sageInk.copy(alpha = 0.5f)
  val gridColor = DorkTheme.colors.surfaceBorderSubtle
  val primaryTextColor = DorkTheme.colors.textPrimary
  val secondaryTextColor = DorkTheme.colors.textSecondary

  DorkCard(
    modifier = modifier.fillMaxWidth(),
    contentPadding = DorkSpacing.m
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      // Top Header: Biomarker Name & Reference Range
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = trend.testName,
            style = MaterialTheme.typography.titleMedium,
            color = primaryTextColor
          )
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = "Ref: ${trend.referenceRangeLow} – ${trend.referenceRangeHigh} ${trend.unit}",
            style = MaterialTheme.typography.bodySmall,
            color = secondaryTextColor
          )
        }

        activePoint?.let { pt ->
          DorkStatusBadge(text = pt.status.label, type = statusBadgeType)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      // Highlighted Value Callout
      Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier.fillMaxWidth()
      ) {
        Row(verticalAlignment = Alignment.Bottom) {
          Text(
            text = activePoint?.numericValue?.toString() ?: "—",
            style = MaterialTheme.typography.displaySmall,
            color = primaryTextColor
          )
          Spacer(modifier = Modifier.width(4.dp))
          Text(
            text = trend.unit,
            style = MaterialTheme.typography.titleSmall,
            color = secondaryTextColor,
            modifier = Modifier.padding(bottom = 3.dp)
          )
        }

        trend.changePercentage?.let { pct ->
          val isPositive = pct > 0
          val pctText = "${if (isPositive) "+" else ""}$pct%"
          val pctBg = if (pct <= 0) DorkTheme.colors.sage else DorkTheme.colors.peach
          val pctInk = if (pct <= 0) DorkTheme.colors.sageInk else DorkTheme.colors.peachInk

          Box(
            modifier = Modifier
              .clip(RoundedCornerShape(6.dp))
              .background(pctBg)
              .padding(horizontal = 8.dp, vertical = 4.dp)
          ) {
            Text(
              text = "$pctText vs prior",
              style = MaterialTheme.typography.labelSmall,
              color = pctInk
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      // Canvas Chart
      val points = trend.points
      if (points.isNotEmpty()) {
        val yMin = minOf(
          points.minOf { it.numericValue },
          trend.referenceRangeLow
        ) * 0.90
        val yMax = maxOf(
          points.maxOf { it.numericValue },
          trend.referenceRangeHigh
        ) * 1.10
        val ySpan = (yMax - yMin).coerceAtLeast(1.0)

        Box(
          modifier = Modifier
            .fillMaxWidth()
            .height(130.dp)
        ) {
          Canvas(
            modifier = Modifier
              .fillMaxWidth()
              .height(130.dp)
              .pointerInput(points) {
                detectTapGestures { offset ->
                  val stepX = size.width / (points.size.coerceAtLeast(2) - 1)
                  val tappedIndex = (offset.x / stepX).toInt().coerceIn(0, points.size - 1)
                  selectedIndex = tappedIndex
                }
              }
          ) {
            val width = size.width
            val height = size.height

            fun toY(v: Double): Float {
              val normalized = (v - yMin) / ySpan
              return (height - (normalized * height)).toFloat().coerceIn(0f, height)
            }

            // Draw Reference Range Corridor (Safe Zone)
            val refTopY = toY(trend.referenceRangeHigh)
            val refBottomY = toY(trend.referenceRangeLow)
            val refHeight = (refBottomY - refTopY).coerceAtLeast(4f)

            drawRect(
              color = safeBandColor,
              topLeft = Offset(0f, refTopY),
              size = Size(width, refHeight)
            )

            // Dashed bounds for reference range
            val dashEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
            drawLine(
              color = safeLineColor,
              start = Offset(0f, refTopY),
              end = Offset(width, refTopY),
              strokeWidth = 1.5f,
              pathEffect = dashEffect
            )
            drawLine(
              color = safeLineColor,
              start = Offset(0f, refBottomY),
              end = Offset(width, refBottomY),
              strokeWidth = 1.5f,
              pathEffect = dashEffect
            )

            if (points.size >= 2) {
              val stepX = width / (points.size - 1)
              val path = Path()

              val coords = points.mapIndexed { index, pt ->
                Offset(index * stepX, toY(pt.numericValue))
              }

              path.moveTo(coords[0].x, coords[0].y)
              for (i in 1 until coords.size) {
                val p0 = coords[i - 1]
                val p1 = coords[i]
                val midX = (p0.x + p1.x) / 2f
                path.cubicTo(midX, p0.y, midX, p1.y, p1.x, p1.y)
              }

              drawPath(
                path = path,
                color = lineColor,
                style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round)
              )

              // Draw point dots
              coords.forEachIndexed { i, coord ->
                val isSelected = i == selectedIndex
                val dotRadius = if (isSelected) 6.dp.toPx() else 4.dp.toPx()
                val dotColor = if (isSelected) lineColor else primaryTextColor

                if (isSelected) {
                  drawCircle(
                    color = lineColor.copy(alpha = 0.25f),
                    radius = 12.dp.toPx(),
                    center = coord
                  )
                }

                drawCircle(
                  color = dotColor,
                  radius = dotRadius,
                  center = coord
                )
                drawCircle(
                  color = Color.White,
                  radius = dotRadius * 0.45f,
                  center = coord
                )
              }
            } else if (points.size == 1) {
              val singleCoord = Offset(width / 2f, toY(points[0].numericValue))
              drawCircle(
                color = lineColor,
                radius = 6.dp.toPx(),
                center = singleCoord
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(DorkSpacing.xs))

        // Date Labels Along X Axis
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween
        ) {
          points.forEachIndexed { idx, pt ->
            val isSelected = idx == selectedIndex
            Text(
              text = pt.displayDate.take(11),
              style = MaterialTheme.typography.labelSmall,
              color = if (isSelected) primaryTextColor else secondaryTextColor
            )
          }
        }
      }
    }
  }
}
