package health.dork.app.core.designsystem.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

@Composable
fun DorkSkeleton(
  modifier: Modifier = Modifier,
  shape: RoundedCornerShape = DorkShapes.medium
) {
  val transition = rememberInfiniteTransition(label = "skeleton_shimmer")
  val translateAnim by transition.animateFloat(
    initialValue = 0f,
    targetValue = 1000f,
    animationSpec = infiniteRepeatable(
      animation = tween(durationMillis = 1200, easing = LinearEasing),
      repeatMode = RepeatMode.Restart
    ),
    label = "skeleton_shimmer_translate"
  )

  val baseColor = DorkTheme.colors.surfaceSecondary
  val highlightColor = DorkTheme.colors.surfaceBorder

  val brush = Brush.linearGradient(
    colors = listOf(baseColor, highlightColor, baseColor),
    start = Offset(x = translateAnim - 300f, y = translateAnim - 300f),
    end = Offset(x = translateAnim, y = translateAnim)
  )

  Box(
    modifier = modifier
      .clip(shape)
      .background(brush)
  )
}

@Composable
fun DorkLoadingSkeletonCard(
  modifier: Modifier = Modifier,
  height: Dp = 100.dp
) {
  DorkCard(
    modifier = modifier,
    contentPadding = DorkSpacing.m
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        DorkSkeleton(
          modifier = Modifier
            .width(140.dp)
            .height(20.dp)
        )
        DorkSkeleton(
          modifier = Modifier
            .width(60.dp)
            .height(16.dp),
          shape = DorkShapes.pill
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      DorkSkeleton(
        modifier = Modifier
          .fillMaxWidth(0.85f)
          .height(16.dp)
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xs))

      DorkSkeleton(
        modifier = Modifier
          .fillMaxWidth(0.5f)
          .height(14.dp)
      )
    }
  }
}

@Composable
fun DorkLoadingScreen(
  modifier: Modifier = Modifier,
  itemCount: Int = 4
) {
  Column(
    modifier = modifier
      .fillMaxWidth()
      .padding(DorkSpacing.screenHorizontalPadding),
    verticalArrangement = Arrangement.spacedBy(DorkSpacing.m)
  ) {
    repeat(itemCount) {
      DorkLoadingSkeletonCard()
    }
  }
}
