package health.dork.app.ui.ai

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.displayCutoutPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AddPhotoAlternate
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.PhotoCamera
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import health.dork.app.core.data.model.AiBookingCardData
import health.dork.app.core.data.model.AiBookingStatus
import health.dork.app.core.data.model.AiSlotOption
import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.model.MessageSender
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DorkAiScreen(
  viewModel: DorkAiViewModel,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val isDark = isSystemInDarkTheme()
  val listState = rememberLazyListState()
  val hasMessages = uiState.messages.isNotEmpty()

  LaunchedEffect(uiState.messages.size) {
    if (uiState.messages.isNotEmpty()) {
      listState.animateScrollToItem(uiState.messages.size - 1)
    }
  }

  // Soft whitish-pinkish background matching the APK's Superpower UI/UX
  val baseBackground = if (isDark) Color(0xFF06070D) else Color(0xFFF9F8FA)

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(baseBackground)
  ) {
    // 1. Atmospheric Ambient Soft Whitish-Pinkish Glow
    Canvas(modifier = Modifier.fillMaxSize()) {
      if (isDark) {
        drawCircle(
          brush = Brush.radialGradient(
            colors = listOf(
              Color(0x3B4F46E5),
              Color(0x22312E81),
              Color(0x0C1E1B4B),
              Color.Transparent
            ),
            center = Offset(size.width * 0.5f, size.height * 0.32f),
            radius = size.width * 0.85f
          ),
          radius = size.width * 0.85f,
          center = Offset(size.width * 0.5f, size.height * 0.32f)
        )
      } else {
        // Soft whitish-pinkish atmospheric radial glow at center top
        drawCircle(
          brush = Brush.radialGradient(
            colors = listOf(
              Color(0x4AFDA4AF), // radiant blush rose
              Color(0x25FCE7F3), // light pastel pink
              Color(0x10FAF5FF), // soft lavender
              Color.Transparent
            ),
            center = Offset(size.width * 0.5f, size.height * 0.32f),
            radius = size.width * 0.90f
          ),
          radius = size.width * 0.90f,
          center = Offset(size.width * 0.5f, size.height * 0.32f)
        )

        // Lower warm blush reflection
        drawCircle(
          brush = Brush.radialGradient(
            colors = listOf(
              Color(0x22FFE4E6),
              Color(0x0EFFF1F2),
              Color.Transparent
            ),
            center = Offset(size.width * 0.5f, size.height * 0.80f),
            radius = size.width * 0.70f
          ),
          radius = size.width * 0.70f,
          center = Offset(size.width * 0.5f, size.height * 0.80f)
        )
      }
    }

    // 2. Main Content Column with safe notch & cutout clearances
    Column(
      modifier = Modifier
        .fillMaxSize()
        .statusBarsPadding()
        .displayCutoutPadding()
        .padding(top = 16.dp)
    ) {
      // Centered Elegant "Chat" Header
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 24.dp, vertical = 6.dp)
      ) {
        Text(
          text = "Chat",
          style = MaterialTheme.typography.titleLarge.copy(
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = (-0.3).sp
          ),
          color = if (isDark) Color.White else Color(0xFF0F172A),
          modifier = Modifier.align(Alignment.Center)
        )

        if (hasMessages) {
          IconButton(
            onClick = { viewModel.clearConversation() },
            modifier = Modifier
              .size(32.dp)
              .clip(CircleShape)
              .background(if (isDark) Color(0x22FFFFFF) else Color(0x12000000))
              .align(Alignment.CenterEnd)
          ) {
            Icon(
              imageVector = Icons.Rounded.Refresh,
              contentDescription = "New Consultation",
              tint = if (isDark) Color.White.copy(alpha = 0.85f) else Color(0xFF475569),
              modifier = Modifier.size(16.dp)
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(10.dp))

      // 3. Conversation Stream OR Ambient Dotted Graphic
      if (hasMessages) {
        LazyColumn(
          state = listState,
          contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
          verticalArrangement = Arrangement.spacedBy(14.dp),
          modifier = Modifier
            .weight(1f)
            .fillMaxWidth()
        ) {
          items(uiState.messages, key = { it.id }) { msg ->
            val isAi = msg.sender == MessageSender.DORK_AI

            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = if (isAi) Arrangement.Start else Arrangement.End
            ) {
              Surface(
                shape = RoundedCornerShape(20.dp),
                color = if (isAi) {
                  if (isDark) Color(0x6620323E) else Color(0xFAFDF8F8)
                } else {
                  if (isDark) Color(0xFF0284C7) else Color(0xFF1E293B)
                },
                border = if (isAi) {
                  BorderStroke(1.dp, if (isDark) Color(0x2EFFFFFF) else Color(0x35FDA4AF))
                } else null,
                modifier = Modifier.fillMaxWidth(if (isAi) 0.94f else 0.82f)
              ) {
                Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 13.dp)) {
                  Text(
                    text = msg.text,
                    style = MaterialTheme.typography.bodyMedium,
                    lineHeight = 22.sp,
                    color = if (isAi) {
                      if (isDark) Color(0xFFF1F5F9) else Color(0xFF1E293B)
                    } else Color.White
                  )

                  if (msg.bookingCard != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    AiBookingActionCard(
                      card = msg.bookingCard,
                      isDark = isDark,
                      onSlotSelected = { slotIso ->
                        viewModel.selectBookingSlot(msg.id, slotIso)
                      },
                      onConfirmClick = {
                        viewModel.confirmAiBooking(msg.id)
                      }
                    )
                  }

                  if (msg.sourceReference != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                      shape = RoundedCornerShape(8.dp),
                      color = if (isDark) Color(0x400C161D) else Color(0xFFFFF1F2),
                      border = BorderStroke(1.dp, if (isDark) Color(0x3338BDF8) else Color(0x25FDA4AF)),
                      modifier = Modifier.fillMaxWidth()
                    ) {
                      Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                      ) {
                        Icon(
                          imageVector = Icons.Rounded.CheckCircle,
                          contentDescription = null,
                          tint = if (isDark) Color(0xFF38BDF8) else Color(0xFFE11D48),
                          modifier = Modifier.size(13.dp)
                        )
                        Text(
                          text = msg.sourceReference,
                          style = MaterialTheme.typography.labelSmall,
                          color = if (isDark) Color(0xFFE0F2FE) else Color(0xFF9F1239)
                        )
                      }
                    }
                  }
                }
              }
            }
          }

          if (uiState.isThinking) {
            item {
              Row(
                modifier = Modifier
                  .clip(RoundedCornerShape(14.dp))
                  .background(if (isDark) Color(0x4D20323E) else Color(0xEEFFFFFF))
                  .border(1.dp, if (isDark) Color(0x2EFFFFFF) else Color(0x30FDA4AF), RoundedCornerShape(14.dp))
                  .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
              ) {
                CircularProgressIndicator(
                  modifier = Modifier.size(13.dp),
                  strokeWidth = 2.dp,
                  color = if (isDark) Color(0xFF38BDF8) else Color(0xFFE11D48)
                )
                Text(
                  text = "Synthesizing on-device records…",
                  style = MaterialTheme.typography.bodySmall,
                  color = if (isDark) Color(0xFFCBD5E1) else Color(0xFF64748B)
                )
              }
            }
          }
        }
      } else {
        Box(
          modifier = Modifier
            .weight(1f)
            .fillMaxWidth(),
          contentAlignment = Alignment.Center
        ) {
          Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 20.dp)
          ) {
            DottedOrbGraphic(isDark = isDark)

            Spacer(modifier = Modifier.height(14.dp))

            Text(
              text = "What would you like me to do?",
              style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
              color = if (isDark) Color(0xFFCBD5E1) else Color(0xFF475569)
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
              horizontalArrangement = Arrangement.spacedBy(8.dp),
              modifier = Modifier.fillMaxWidth(),
              verticalAlignment = Alignment.CenterVertically
            ) {
              StarterChip(
                icon = Icons.Rounded.CalendarToday,
                text = "Book Dr. Sarah Chen",
                isDark = isDark,
                onClick = { viewModel.sendQuery("Can you book me an appointment with Dr Sarah Chen?") },
                modifier = Modifier.weight(1f)
              )
              StarterChip(
                icon = Icons.Rounded.CalendarToday,
                text = "Book Dr. Lin",
                isDark = isDark,
                onClick = { viewModel.sendQuery("can u book me appoitment at dr lin ?") },
                modifier = Modifier.weight(1f)
              )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
              horizontalArrangement = Arrangement.spacedBy(8.dp),
              modifier = Modifier.fillMaxWidth(),
              verticalAlignment = Alignment.CenterVertically
            ) {
              StarterChip(
                icon = Icons.Rounded.Science,
                text = "Explain CBC labs",
                isDark = isDark,
                onClick = { viewModel.sendQuery("Explain my latest CBC report") },
                modifier = Modifier.weight(1f)
              )
              StarterChip(
                icon = Icons.Rounded.Description,
                text = "My Medications",
                isDark = isDark,
                onClick = { viewModel.sendQuery("What medications am I taking?") },
                modifier = Modifier.weight(1f)
              )
            }
          }
        }
      }

      // 4. Active Mode or Attachment Badge (if selected)
      AnimatedVisibility(
        visible = uiState.selectedMode != DorkAiMode.SYNTHESIS || uiState.activeAttachment != null,
        enter = fadeIn() + slideInVertically { it / 2 },
        exit = fadeOut() + slideOutVertically { it / 2 },
        modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp)
      ) {
        Row(
          modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(if (isDark) Color(0x661A2B36) else Color(0x20F43F5E))
            .border(1.dp, if (isDark) Color(0x4038BDF8) else Color(0x40FB7185), RoundedCornerShape(16.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
          Text(
            text = uiState.activeAttachment ?: uiState.selectedMode.badgeText,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = if (isDark) Color(0xFFE0F2FE) else Color(0xFF9F1239)
          )
          Icon(
            imageVector = Icons.Rounded.Close,
            contentDescription = "Clear",
            tint = if (isDark) Color(0xAAFFFFFF) else Color(0xFF9F1239),
            modifier = Modifier
              .size(14.dp)
              .clickable {
                if (uiState.activeAttachment != null) {
                  viewModel.clearAttachment()
                } else {
                  viewModel.setMode(DorkAiMode.SYNTHESIS)
                }
              }
          )
        }
      }

      // 5. The Exact Frosted Liquid Glass Card
      FrostedLiquidGlassInputCard(
        inputQuery = uiState.inputQuery,
        onInputChange = viewModel::onInputChange,
        onSend = { viewModel.sendQuery() },
        selectedMode = uiState.selectedMode,
        onSelectMode = viewModel::setMode,
        onOpenAttach = { viewModel.toggleAttachSheet(true) },
        isThinking = uiState.isThinking,
        isDark = isDark,
        modifier = Modifier
          .fillMaxWidth()
          .padding(start = 16.dp, end = 16.dp, bottom = 112.dp)
      )
    }

    // 6. Attachment Bottom Sheet
    if (uiState.showAttachSheet) {
      ModalBottomSheet(
        onDismissRequest = { viewModel.toggleAttachSheet(false) },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = if (isDark) Color(0xFF13222B) else Color.White
      ) {
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp)
        ) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = "Attach Health Record",
              style = MaterialTheme.typography.titleMedium,
              fontWeight = FontWeight.Bold,
              color = if (isDark) Color.White else Color(0xFF0F172A)
            )
            IconButton(onClick = { viewModel.toggleAttachSheet(false) }) {
              Icon(
                imageVector = Icons.Rounded.Close,
                contentDescription = "Close",
                tint = if (isDark) Color(0xAAFFFFFF) else Color(0xFF64748B)
              )
            }
          }

          Spacer(modifier = Modifier.height(10.dp))

          uiState.availableAttachments.forEach { item ->
            Surface(
              shape = RoundedCornerShape(12.dp),
              color = if (isDark) Color(0x33283942) else Color(0xFFF8FAFC),
              border = BorderStroke(1.dp, if (isDark) Color(0x22FFFFFF) else Color(0x20CBD5E1)),
              modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp)
                .clickable {
                  viewModel.attachRecord(item)
                }
            ) {
              Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
              ) {
                Icon(
                  imageVector = Icons.Rounded.Description,
                  contentDescription = null,
                  tint = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7),
                  modifier = Modifier.size(18.dp)
                )
                Text(
                  text = item,
                  style = MaterialTheme.typography.bodyMedium,
                  color = if (isDark) Color.White else Color(0xFF1E293B)
                )
              }
            }
          }

          Spacer(modifier = Modifier.height(24.dp))
        }
      }
    }
  }
}

/**
 * The Exact Frosted Liquid Glass Input Card from 1000199550.jpg:
 * - Large rounded corners (~34dp)
 * - Translucent blurred liquid glass backdrop
 * - Top prismatic / iridescent specular refraction sheen
 * - "Ask me anything..." text input
 * - Row of 4 icons:
 *   1) [+] Rounded square with plus
 *   2) Globe with cursor pointer arrow
 *   3) Microscope
 *   4) Viewfinder with plus sign in top right corner
 */
private data class MatrixDot(
  val col: Int,
  val row: Int,
  val zWeight: Float,
  val baseRadiusDp: Float,
  val minAlpha: Float,
  val maxAlpha: Float
)

private val StaticMatrixDots: List<MatrixDot> = buildList {
  val bulbRadiusSteps = 10.2f
  val bulbCenterRow = -4.5f

  for (r in -15..5) {
    val dySteps = r - bulbCenterRow
    val maxColSteps = kotlin.math.sqrt((bulbRadiusSteps * bulbRadiusSteps - dySteps * dySteps).coerceAtLeast(0f))
    if (maxColSteps > 0f) {
      val maxCol = maxColSteps.toInt()
      for (c in -maxCol..maxCol) {
        val distSteps = kotlin.math.sqrt(c * c + dySteps * dySteps)
        if (distSteps <= bulbRadiusSteps) {
          val zNorm = kotlin.math.sqrt((1f - (distSteps / bulbRadiusSteps)).coerceIn(0f, 1f))
          add(
            MatrixDot(
              col = c,
              row = r,
              zWeight = 0.82f * zNorm * zNorm,
              baseRadiusDp = 1.05f + 0.5f * zNorm,
              minAlpha = 0.12f,
              maxAlpha = 0.96f
            )
          )
        }
      }
    }
  }

  for (r in 7..11) {
    for (c in -2..2) {
      val colDist = kotlin.math.abs(c) / 2f
      val zNorm = 1f - colDist * 0.45f
      add(
        MatrixDot(
          col = c,
          row = r,
          zWeight = 0.70f * zNorm,
          baseRadiusDp = 1.1f + 0.35f * zNorm,
          minAlpha = 0.15f,
          maxAlpha = 0.94f
        )
      )
    }
  }

  val baseRows = 9
  for (i in 0 until baseRows) {
    val r = 13 + i
    val halfWidth = when (i) {
      0 -> 3
      1 -> 4
      2 -> 5
      3 -> 6
      4 -> 7
      5 -> 8
      6 -> 9
      7 -> 9
      else -> 7
    }

    for (c in -halfWidth..halfWidth) {
      val cNorm = kotlin.math.abs(c).toFloat() / halfWidth.coerceAtLeast(1)
      val zNorm = kotlin.math.sqrt((1f - cNorm * cNorm).coerceAtLeast(0f))
      val verticalFactor = (1f - (i - 4) * (i - 4) / 28f).coerceIn(0.6f, 1f)
      add(
        MatrixDot(
          col = c,
          row = r,
          zWeight = 0.75f * zNorm * verticalFactor,
          baseRadiusDp = 1.05f + 0.45f * zNorm,
          minAlpha = 0.12f,
          maxAlpha = 0.92f
        )
      )
    }
  }
}

/**
 * Pre-computed Dotted Hologram Matrix Graphic.
 * Renders at a rock-solid 120 FPS with zero runtime trigonometry or inner loop allocations.
 */
@Composable
fun DottedOrbGraphic(
  modifier: Modifier = Modifier,
  isDark: Boolean = false
) {
  val infiniteTransition = rememberInfiniteTransition(label = "matrix_pulse")
  val pulse by infiniteTransition.animateFloat(
    initialValue = 0.82f,
    targetValue = 1.0f,
    animationSpec = infiniteRepeatable(
      animation = tween(2400, easing = FastOutSlowInEasing),
      repeatMode = RepeatMode.Reverse
    ),
    label = "matrix_glow"
  )

  val dotBaseColor = if (isDark) Color.White else Color(0xFF282560)

  Canvas(modifier = modifier.size(280.dp, 360.dp)) {
    val cx = size.width / 2f
    val cy = size.height * 0.44f
    val spacing = 8.8.dp.toPx()
    val dpToPx = density

    StaticMatrixDots.forEach { dot ->
      val alpha = (dot.minAlpha + dot.zWeight * pulse).coerceIn(dot.minAlpha, dot.maxAlpha)
      drawCircle(
        color = dotBaseColor.copy(alpha = alpha),
        radius = dot.baseRadiusDp * dpToPx,
        center = Offset(cx + dot.col * spacing, cy + dot.row * spacing)
      )
    }
  }
}

/**
 * Frosted Liquid Glass Input Card.
 * Matches the reference design:
 * - High corner radius (32.dp)
 * - Neon specular highlight slit along the top center rim
 * - Placeholder "Ask me anything about your health"
 * - 4 icons on the left: [+] [🌐] [🔬] [⛶]
 * - Glowing circular send button with [↑] on the right
 */
@Composable
fun FrostedLiquidGlassInputCard(
  inputQuery: String,
  onInputChange: (String) -> Unit,
  onSend: () -> Unit,
  selectedMode: DorkAiMode,
  onSelectMode: (DorkAiMode) -> Unit,
  onOpenAttach: () -> Unit,
  isThinking: Boolean,
  isDark: Boolean = false,
  modifier: Modifier = Modifier
) {
  val cardBackground = if (isDark) {
    Brush.verticalGradient(
      listOf(
        Color(0xDD151832),
        Color(0xF20B0D1E)
      )
    )
  } else {
    Brush.verticalGradient(
      listOf(
        Color(0xF8FFFFFF),
        Color(0xEEFDF2F4)
      )
    )
  }

  val borderBrush = if (isDark) {
    Brush.verticalGradient(
      listOf(
        Color(0x55818CF8),
        Color(0x223B82F6),
        Color(0x0C1E1B4B)
      )
    )
  } else {
    Brush.verticalGradient(
      listOf(
        Color(0x85F472B6),
        Color(0x40C084FC),
        Color(0x20CBD5E1)
      )
    )
  }

  val ambientGlowColors = if (isDark) {
    listOf(
      Color(0x336366F1),
      Color(0x184F46E5),
      Color.Transparent
    )
  } else {
    listOf(
      Color(0x45FDA4AF),
      Color(0x1CF472B6),
      Color.Transparent
    )
  }

  val specularSlitColors = if (isDark) {
    listOf(
      Color.Transparent,
      Color(0x80818CF8),
      Color(0xFFE0E7FF),
      Color(0x80818CF8),
      Color.Transparent
    )
  } else {
    listOf(
      Color.Transparent,
      Color(0x95FB7185),
      Color(0xFFFFCCD5),
      Color(0x95FB7185),
      Color.Transparent
    )
  }

  val specularGlowColors = if (isDark) {
    listOf(
      Color(0x35818CF8),
      Color(0x106366F1),
      Color.Transparent
    )
  } else {
    listOf(
      Color(0x35FDA4AF),
      Color(0x12F472B6),
      Color.Transparent
    )
  }

  Box(
    modifier = modifier,
    contentAlignment = Alignment.Center
  ) {
    // Ambient back-glow behind the liquid glass card
    Box(
      modifier = Modifier
        .matchParentSize()
        .padding(horizontal = 8.dp, vertical = 4.dp)
        .background(
          brush = Brush.radialGradient(
            colors = ambientGlowColors,
            radius = 320f
          ),
          shape = RoundedCornerShape(32.dp)
        )
    )

    Surface(
      shape = RoundedCornerShape(32.dp),
      color = Color.Transparent,
      border = BorderStroke(1.2.dp, borderBrush),
      shadowElevation = if (isDark) 20.dp else 10.dp,
      modifier = Modifier
        .fillMaxWidth()
        .clip(RoundedCornerShape(32.dp))
        .background(cardBackground)
    ) {
      Box(modifier = Modifier.fillMaxWidth()) {
        // Specular neon laser slit highlight along the top rim
        Box(
          modifier = Modifier
            .fillMaxWidth(0.50f)
            .height(2.5.dp)
            .align(Alignment.TopCenter)
            .clip(RoundedCornerShape(2.dp))
            .background(
              Brush.horizontalGradient(specularSlitColors)
            )
        )

        // Soft internal ambient glow below the laser slit
        Box(
          modifier = Modifier
            .fillMaxWidth(0.66f)
            .height(14.dp)
            .align(Alignment.TopCenter)
            .background(
              Brush.radialGradient(
                colors = specularGlowColors,
                radius = 180f
              )
            )
        )

        Column(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 22.dp, vertical = 20.dp)
        ) {
          // Row 1: "Ask me anything about your health" text field
          BasicTextField(
            value = inputQuery,
            onValueChange = onInputChange,
            textStyle = TextStyle(
              color = if (isDark) Color.White else Color(0xFF0F172A),
              fontSize = 16.5.sp,
              fontWeight = FontWeight.Normal,
              letterSpacing = (-0.2).sp
            ),
            cursorBrush = SolidColor(if (isDark) Color(0xFF818CF8) else Color(0xFFE11D48)),
            decorationBox = { innerTextField ->
              Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.CenterStart
              ) {
                if (inputQuery.isEmpty()) {
                  Text(
                    text = "Ask me anything about your health",
                    style = TextStyle(
                      color = if (isDark) Color.White.copy(alpha = 0.72f) else Color(0xFF94A3B8),
                      fontSize = 16.5.sp,
                      fontWeight = FontWeight.Normal,
                      letterSpacing = (-0.2).sp
                    )
                  )
                }
                innerTextField()
              }
            },
            modifier = Modifier.fillMaxWidth()
          )

          Spacer(modifier = Modifier.height(22.dp))

          // Row 2: Action Icons on Left, Glowing Lavender Send Button on Right
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            // Action Icons
            Row(
              horizontalArrangement = Arrangement.spacedBy(14.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              // Icon 1: [+] Attach
              Box(
                modifier = Modifier
                  .size(32.dp)
                  .clickable(onClick = onOpenAttach),
                contentAlignment = Alignment.Center
              ) {
                SquarePlusGlyph(isDark = isDark)
              }

              // Icon 2: Globe with pointer arrow (Guidelines Mode)
              Box(
                modifier = Modifier
                  .size(32.dp)
                  .clip(RoundedCornerShape(8.dp))
                  .background(
                    if (selectedMode == DorkAiMode.GUIDELINES) {
                      if (isDark) Color(0x338B5CF6) else Color(0x20F43F5E)
                    } else Color.Transparent
                  )
                  .clickable { onSelectMode(DorkAiMode.GUIDELINES) },
                contentAlignment = Alignment.Center
              ) {
                GlobeCursorGlyph(
                  isDark = isDark,
                  isSelected = selectedMode == DorkAiMode.GUIDELINES
                )
              }

              // Icon 3: Microscope (Deep Biomarker Mode)
              Box(
                modifier = Modifier
                  .size(32.dp)
                  .clip(RoundedCornerShape(8.dp))
                  .background(
                    if (selectedMode == DorkAiMode.DEEP_LAB) {
                      if (isDark) Color(0x338B5CF6) else Color(0x20F43F5E)
                    } else Color.Transparent
                  )
                  .clickable { onSelectMode(DorkAiMode.DEEP_LAB) },
                contentAlignment = Alignment.Center
              ) {
                MicroscopeGlyph(
                  isDark = isDark,
                  isSelected = selectedMode == DorkAiMode.DEEP_LAB
                )
              }
            }

            // Circular Send Button with ↑ arrow
            Box(
              modifier = Modifier
                .size(38.dp)
                .clip(CircleShape)
                .background(
                  Brush.linearGradient(
                    listOf(Color(0xFF818CF8), Color(0xFF6366F1))
                  )
                )
                .clickable(
                  enabled = !isThinking && inputQuery.isNotBlank(),
                  onClick = onSend
                ),
              contentAlignment = Alignment.Center
            ) {
              if (isThinking) {
                CircularProgressIndicator(
                  modifier = Modifier.size(16.dp),
                  color = Color.White,
                  strokeWidth = 2.dp
                )
              } else {
                UpwardArrowIcon(modifier = Modifier.size(17.dp))
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Pixel-perfect upward arrow glyph matching clean_1.jpg send button.
 */
@Composable
fun UpwardArrowIcon(modifier: Modifier = Modifier) {
  Canvas(modifier = modifier) {
    val sw = 2.2.dp.toPx()
    val midX = size.width / 2f
    val topY = size.height * 0.22f
    val botY = size.height * 0.78f
    val wing = size.width * 0.26f

    // Vertical line
    drawLine(
      color = Color.White,
      start = Offset(midX, botY),
      end = Offset(midX, topY),
      strokeWidth = sw,
      cap = StrokeCap.Round
    )
    // Left arrow wing
    drawLine(
      color = Color.White,
      start = Offset(midX - wing, topY + wing),
      end = Offset(midX, topY),
      strokeWidth = sw,
      cap = StrokeCap.Round
    )
    // Right arrow wing
    drawLine(
      color = Color.White,
      start = Offset(midX + wing, topY + wing),
      end = Offset(midX, topY),
      strokeWidth = sw,
      cap = StrokeCap.Round
    )
  }
}

/**
 * Icon 1: Rounded square with plus sign inside [+] matching 1000199550.jpg
 */
@Composable
fun SquarePlusGlyph(isDark: Boolean) {
  val strokeColor = if (isDark) Color.White.copy(alpha = 0.90f) else Color(0xFF1E293B)

  Canvas(modifier = Modifier.size(24.dp)) {
    val pad = 1.dp.toPx()
    val round = 6.dp.toPx()
    val strokeWidth = 1.8.dp.toPx()

    // Outer rounded square
    drawRoundRect(
      color = strokeColor,
      topLeft = Offset(pad, pad),
      size = Size(size.width - 2 * pad, size.height - 2 * pad),
      cornerRadius = CornerRadius(round, round),
      style = Stroke(width = strokeWidth)
    )

    // Horizontal bar of plus
    val midY = size.height / 2
    val midX = size.width / 2
    val arm = 4.5.dp.toPx()

    drawLine(
      color = strokeColor,
      start = Offset(midX - arm, midY),
      end = Offset(midX + arm, midY),
      strokeWidth = strokeWidth,
      cap = StrokeCap.Round
    )

    // Vertical bar of plus
    drawLine(
      color = strokeColor,
      start = Offset(midX, midY - arm),
      end = Offset(midX, midY + arm),
      strokeWidth = strokeWidth,
      cap = StrokeCap.Round
    )
  }
}

/**
 * Icon 2: Globe with cursor pointer arrow matching 1000199550.jpg
 */
@Composable
fun GlobeCursorGlyph(isDark: Boolean, isSelected: Boolean) {
  val strokeColor = when {
    isSelected -> if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)
    isDark -> Color.White.copy(alpha = 0.90f)
    else -> Color(0xFF1E293B)
  }

  Canvas(modifier = Modifier.size(24.dp)) {
    val cx = size.width * 0.44f
    val cy = size.height * 0.48f
    val r = 9.dp.toPx()
    val sw = 1.7.dp.toPx()

    // Globe circle
    drawCircle(
      color = strokeColor,
      radius = r,
      center = Offset(cx, cy),
      style = Stroke(width = sw)
    )

    // Horizontal equator
    drawLine(
      color = strokeColor,
      start = Offset(cx - r, cy),
      end = Offset(cx + r, cy),
      strokeWidth = sw
    )

    // Longitude ellipse
    drawOval(
      color = strokeColor,
      topLeft = Offset(cx - r * 0.48f, cy - r),
      size = Size(r * 0.96f, 2 * r),
      style = Stroke(width = sw)
    )

    // Cursor pointer arrow at bottom-right
    val arrowX = size.width * 0.65f
    val arrowY = size.height * 0.68f

    val cursorPath = Path().apply {
      moveTo(arrowX, arrowY)
      lineTo(arrowX + 7.dp.toPx(), arrowY + 3.dp.toPx())
      lineTo(arrowX + 4.dp.toPx(), arrowY + 4.dp.toPx())
      lineTo(arrowX + 6.dp.toPx(), arrowY + 8.dp.toPx())
      lineTo(arrowX + 4.5.dp.toPx(), arrowY + 8.5.dp.toPx())
      lineTo(arrowX + 2.5.dp.toPx(), arrowY + 4.5.dp.toPx())
      lineTo(arrowX, arrowY + 7.dp.toPx())
      close()
    }

    drawPath(
      path = cursorPath,
      color = strokeColor,
      style = Stroke(width = 1.3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
    )
  }
}

/**
 * Icon 3: Microscope matching 1000199550.jpg
 */
@Composable
fun MicroscopeGlyph(isDark: Boolean, isSelected: Boolean) {
  val strokeColor = when {
    isSelected -> if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)
    isDark -> Color.White.copy(alpha = 0.90f)
    else -> Color(0xFF1E293B)
  }

  Canvas(modifier = Modifier.size(24.dp)) {
    val sw = 1.8.dp.toPx()

    // Base stand horizontal line
    val baseY = size.height * 0.88f
    drawLine(
      color = strokeColor,
      start = Offset(size.width * 0.15f, baseY),
      end = Offset(size.width * 0.85f, baseY),
      strokeWidth = sw,
      cap = StrokeCap.Round
    )

    // Specimen stage horizontal line
    val stageY = size.height * 0.68f
    drawLine(
      color = strokeColor,
      start = Offset(size.width * 0.28f, stageY),
      end = Offset(size.width * 0.72f, stageY),
      strokeWidth = sw,
      cap = StrokeCap.Round
    )

    // Curved neck stand
    val armPath = Path().apply {
      moveTo(size.width * 0.72f, baseY)
      lineTo(size.width * 0.72f, stageY)
      quadraticTo(
        size.width * 0.72f, size.height * 0.40f,
        size.width * 0.52f, size.height * 0.40f
      )
    }
    drawPath(path = armPath, color = strokeColor, style = Stroke(width = sw, cap = StrokeCap.Round))

    // Angled microscope tube
    drawLine(
      color = strokeColor,
      start = Offset(size.width * 0.58f, size.height * 0.18f),
      end = Offset(size.width * 0.38f, size.height * 0.55f),
      strokeWidth = sw * 1.5f,
      cap = StrokeCap.Round
    )

    // Eyepiece knob
    drawCircle(
      color = strokeColor,
      radius = 2.4.dp.toPx(),
      center = Offset(size.width * 0.62f, size.height * 0.14f)
    )
  }
}

/**
 * Icon 4: Viewfinder with plus sign in top right corner matching 1000199550.jpg
 */
@Composable
fun ViewfinderPlusGlyph(isDark: Boolean, isSelected: Boolean) {
  val strokeColor = when {
    isSelected -> if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)
    isDark -> Color.White.copy(alpha = 0.90f)
    else -> Color(0xFF1E293B)
  }

  Canvas(modifier = Modifier.size(24.dp)) {
    val sw = 1.8.dp.toPx()
    val arm = 5.dp.toPx()
    val r = 2.dp.toPx()

    val left = size.width * 0.14f
    val right = size.width * 0.86f
    val top = size.height * 0.14f
    val bottom = size.height * 0.86f

    // Top-Left corner bracket ⌜
    val tlPath = Path().apply {
      moveTo(left, top + arm)
      lineTo(left, top + r)
      quadraticTo(left, top, left + r, top)
      lineTo(left + arm, top)
    }
    drawPath(path = tlPath, color = strokeColor, style = Stroke(width = sw, cap = StrokeCap.Round))

    // Bottom-Left corner bracket ⌞
    val blPath = Path().apply {
      moveTo(left, bottom - arm)
      lineTo(left, bottom - r)
      quadraticTo(left, bottom, left + r, bottom)
      lineTo(left + arm, bottom)
    }
    drawPath(path = blPath, color = strokeColor, style = Stroke(width = sw, cap = StrokeCap.Round))

    // Bottom-Right corner bracket ⌟
    val brPath = Path().apply {
      moveTo(right - arm, bottom)
      lineTo(right - r, bottom)
      quadraticTo(right, bottom, right, bottom - r)
      lineTo(right, bottom - arm)
    }
    drawPath(path = brPath, color = strokeColor, style = Stroke(width = sw, cap = StrokeCap.Round))

    // Plus symbol in top-right
    val plusCx = right - 1.5.dp.toPx()
    val plusCy = top + 1.5.dp.toPx()
    val plusArm = 3.2.dp.toPx()

    // Horizontal line of plus
    drawLine(
      color = strokeColor,
      start = Offset(plusCx - plusArm, plusCy),
      end = Offset(plusCx + plusArm, plusCy),
      strokeWidth = sw,
      cap = StrokeCap.Round
    )

    // Vertical line of plus
    drawLine(
      color = strokeColor,
      start = Offset(plusCx, plusCy - plusArm),
      end = Offset(plusCx, plusCy + plusArm),
      strokeWidth = sw,
      cap = StrokeCap.Round
    )
  }
}

/**
 * Moody oceanic ripple background matching reference image 1000199550.jpg:
 * Deep marine blues, cyan mist, and soft ripple gradients.
 */
@Composable
fun MoodyOceanicBackground(
  isDark: Boolean,
  modifier: Modifier = Modifier
) {
  val transition = rememberInfiniteTransition(label = "OceanRipple")
  val breathScale by transition.animateFloat(
    initialValue = 0.95f,
    targetValue = 1.05f,
    animationSpec = infiniteRepeatable(
      animation = tween(4500, easing = FastOutSlowInEasing),
      repeatMode = RepeatMode.Reverse
    ),
    label = "breathScale"
  )

  Canvas(modifier = modifier) {
    val w = size.width
    val h = size.height

    if (isDark) {
      // Deep marine oceanic background
      drawRect(
        brush = Brush.verticalGradient(
          0.0f to Color(0xFF0F1B24),
          0.40f to Color(0xFF13232E),
          0.70f to Color(0xFF101C25),
          1.0f to Color(0xFF0B141A)
        )
      )

      // Ocean wave ripple ambient glow 1 (Top-Right deep teal-cyan)
      drawCircle(
        brush = Brush.radialGradient(
          0.0f to Color(0x550284C7),
          0.50f to Color(0x250369A1),
          1.0f to Color.Transparent,
          center = Offset(w * 0.75f, h * 0.35f),
          radius = w * 0.90f * breathScale
        ),
        radius = w * 0.90f * breathScale,
        center = Offset(w * 0.75f, h * 0.35f)
      )

      // Ocean wave ripple ambient glow 2 (Bottom-Left soft marine emerald)
      drawCircle(
        brush = Brush.radialGradient(
          0.0f to Color(0x380D9488),
          0.50f to Color(0x150F766E),
          1.0f to Color.Transparent,
          center = Offset(w * 0.25f, h * 0.65f),
          radius = w * 0.85f * breathScale
        ),
        radius = w * 0.85f * breathScale,
        center = Offset(w * 0.25f, h * 0.65f)
      )
    } else {
      // Light mode serene pearlescent seafoam
      drawRect(
        brush = Brush.verticalGradient(
          0.0f to Color(0xFFF1F5F9),
          0.50f to Color(0xFFE2E8F0),
          1.0f to Color(0xFFF8FAFC)
        )
      )

      drawCircle(
        brush = Brush.radialGradient(
          0.0f to Color(0x40BAE6FD),
          0.60f to Color(0x20E0F2FE),
          1.0f to Color.Transparent,
          center = Offset(w * 0.75f, h * 0.35f),
          radius = w * 0.90f * breathScale
        ),
        radius = w * 0.90f * breathScale,
        center = Offset(w * 0.75f, h * 0.35f)
      )
    }
  }
}
