package health.dork.app.ui.ai

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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.model.MessageSender

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

  // Deep space indigo background matching clean_1.jpg
  val baseBackground = Color(0xFF070810)

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(baseBackground)
  ) {
    // 1. Atmospheric Ambient Purple Glow at center top
    Canvas(modifier = Modifier.fillMaxSize()) {
      drawCircle(
        brush = Brush.radialGradient(
          colors = listOf(Color(0x334F46E5), Color(0x181E1B4B), Color.Transparent),
          center = Offset(size.width * 0.5f, size.height * 0.28f),
          radius = size.width * 0.75f
        ),
        radius = size.width * 0.75f,
        center = Offset(size.width * 0.5f, size.height * 0.28f)
      )
    }

    // 2. Main Content Column
    Column(
      modifier = Modifier
        .fillMaxSize()
        .padding(
          top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() + 10.dp,
          bottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding() + 6.dp
        )
    ) {
      // Centered Elegant "Chat" Header (matching clean_1.jpg)
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = 24.dp, vertical = 8.dp)
      ) {
        Text(
          text = "Chat",
          style = MaterialTheme.typography.titleLarge.copy(
            fontSize = 19.sp,
            fontWeight = FontWeight.Medium,
            letterSpacing = (-0.2).sp
          ),
          color = Color.White,
          modifier = Modifier.align(Alignment.Center)
        )

        if (hasMessages) {
          IconButton(
            onClick = { viewModel.clearConversation() },
            modifier = Modifier
              .size(32.dp)
              .clip(CircleShape)
              .background(Color(0x22FFFFFF))
              .align(Alignment.CenterEnd)
          ) {
            Icon(
              imageVector = Icons.Rounded.Refresh,
              contentDescription = "New Consultation",
              tint = Color.White.copy(alpha = 0.85f),
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
                  if (isDark) Color(0x6620323E) else Color(0xF5FFFFFF)
                } else {
                  if (isDark) Color(0xFF0284C7) else Color(0xFF0F172A)
                },
                border = if (isAi) {
                  BorderStroke(1.dp, if (isDark) Color(0x2EFFFFFF) else Color(0x30CBD5E1))
                } else null,
                modifier = Modifier.fillMaxWidth(if (isAi) 0.94f else 0.82f)
              ) {
                Column(modifier = Modifier.padding(15.dp)) {
                  if (isAi) {
                    Row(
                      verticalAlignment = Alignment.CenterVertically,
                      horizontalArrangement = Arrangement.spacedBy(6.dp),
                      modifier = Modifier.padding(bottom = 6.dp)
                    ) {
                      Icon(
                        imageVector = Icons.Rounded.AutoAwesome,
                        contentDescription = null,
                        tint = if (isDark) Color(0xFF7DD3FC) else Color(0xFF0284C7),
                        modifier = Modifier.size(13.dp)
                      )
                      Text(
                        text = "Clinical Assistant",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isDark) Color(0xFFBAE6FD) else Color(0xFF0369A1)
                      )
                    }
                  }

                  Text(
                    text = msg.text,
                    style = MaterialTheme.typography.bodyMedium,
                    lineHeight = 22.sp,
                    color = if (isAi) {
                      if (isDark) Color(0xFFF1F5F9) else Color(0xFF1E293B)
                    } else Color.White
                  )

                  if (msg.sourceReference != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                      shape = RoundedCornerShape(8.dp),
                      color = if (isDark) Color(0x400C161D) else Color(0xFFF1F5F9),
                      border = BorderStroke(1.dp, if (isDark) Color(0x3338BDF8) else Color(0x20CBD5E1)),
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
                          tint = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7),
                          modifier = Modifier.size(13.dp)
                        )
                        Text(
                          text = msg.sourceReference,
                          style = MaterialTheme.typography.labelSmall,
                          color = if (isDark) Color(0xFFE0F2FE) else Color(0xFF0369A1)
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
                  .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
              ) {
                CircularProgressIndicator(
                  modifier = Modifier.size(13.dp),
                  strokeWidth = 2.dp,
                  color = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)
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
          DottedOrbGraphic()
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
            .background(Color(0x661A2B36))
            .border(1.dp, Color(0x4038BDF8), RoundedCornerShape(16.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
          Text(
            text = uiState.activeAttachment ?: uiState.selectedMode.badgeText,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFFE0F2FE)
          )
          Icon(
            imageVector = Icons.Rounded.Close,
            contentDescription = "Clear",
            tint = Color(0xAAFFFFFF),
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

      // 5. The Exact Frosted Liquid Glass Card from clean_1.jpg
      FrostedLiquidGlassInputCard(
        inputQuery = uiState.inputQuery,
        onInputChange = viewModel::onInputChange,
        onSend = { viewModel.sendQuery() },
        selectedMode = uiState.selectedMode,
        onSelectMode = viewModel::setMode,
        onOpenAttach = { viewModel.toggleAttachSheet(true) },
        onOpenScan = { viewModel.toggleScanDialog(true) },
        isThinking = uiState.isThinking,
        isDark = true,
        modifier = Modifier
          .fillMaxWidth()
          .padding(start = 18.dp, end = 18.dp, bottom = 96.dp)
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

    // 7. Optical Scanner Modal
    if (uiState.showScanDialog) {
      OpticalScannerDialog(
        onScanConfirmed = {
          viewModel.toggleScanDialog(false)
          viewModel.sendQuery("Scan analysis for Rx prescription: $it")
        },
        onDismiss = { viewModel.toggleScanDialog(false) },
        isDark = isDark
      )
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
/**
 * Dotted Constellation Orb Graphic.
 * Renders the futuristic particle orb displayed in the center idle state from clean_1.jpg.
 */
@Composable
fun DottedOrbGraphic(modifier: Modifier = Modifier) {
  val infiniteTransition = rememberInfiniteTransition(label = "orb_pulse")
  val pulseAlpha by infiniteTransition.animateFloat(
    initialValue = 0.60f,
    targetValue = 0.95f,
    animationSpec = infiniteRepeatable(
      animation = tween(2200, easing = FastOutSlowInEasing),
      repeatMode = RepeatMode.Reverse
    ),
    label = "orb_alpha"
  )

  Canvas(modifier = modifier.size(240.dp, 300.dp)) {
    val cx = size.width / 2f
    val cy = size.height * 0.40f
    val maxRadius = size.width * 0.36f

    // 1. Dotted spherical globe
    val steps = 22
    val spacing = 9.dp.toPx()

    for (r in -steps / 2..steps / 2) {
      for (c in -steps / 2..steps / 2) {
        val dx = c * spacing
        val dy = r * spacing
        val dist = kotlin.math.sqrt(dx * dx + dy * dy)
        
        if (dist <= maxRadius) {
          val normalized = 1f - (dist / maxRadius)
          val dotAlpha = (normalized * normalized * pulseAlpha).coerceIn(0.08f, 0.95f)
          val dotRadius = 1.15.dp.toPx() * (0.6f + normalized * 0.7f)
          drawCircle(
            color = Color.White.copy(alpha = dotAlpha),
            radius = dotRadius,
            center = Offset(cx + dx, cy + dy)
          )
        }
      }
    }

    // 2. Dotted keyhole / hourglass neck below the globe
    val neckRows = 7
    val neckCols = 6
    val neckCy = cy + maxRadius + 22.dp.toPx()
    for (r in 0..neckRows) {
      for (c in -neckCols / 2..neckCols / 2) {
        val dx = c * (spacing * 0.72f)
        val dy = r * (spacing * 0.85f)
        val factor = 1f - (kotlin.math.abs(c).toFloat() / (neckCols / 2f))
        val dotAlpha = (factor * 0.45f * pulseAlpha).coerceIn(0.05f, 0.75f)
        drawCircle(
          color = Color.White.copy(alpha = dotAlpha),
          radius = 1.05.dp.toPx(),
          center = Offset(cx + dx, neckCy + dy)
        )
      }
    }
  }
}

/**
 * Frosted Liquid Glass Input Card.
 * Directly matches the layout, placeholder, actions and glowing send button from clean_1.jpg.
 */
@Composable
fun FrostedLiquidGlassInputCard(
  inputQuery: String,
  onInputChange: (String) -> Unit,
  onSend: () -> Unit,
  selectedMode: DorkAiMode,
  onSelectMode: (DorkAiMode) -> Unit,
  onOpenAttach: () -> Unit,
  onOpenScan: () -> Unit,
  isThinking: Boolean,
  isDark: Boolean,
  modifier: Modifier = Modifier
) {
  val cardBackground = Color(0xF0101322)

  // Prismatic neon specular edge glow
  val specularBorder = Brush.linearGradient(
    listOf(
      Color(0xFF8B5CF6).copy(alpha = 0.85f),
      Color(0xFF6366F1).copy(alpha = 0.65f),
      Color(0xFF3B82F6).copy(alpha = 0.50f),
      Color.White.copy(alpha = 0.15f)
    )
  )

  Surface(
    shape = RoundedCornerShape(28.dp),
    color = cardBackground,
    border = BorderStroke(1.2.dp, specularBorder),
    shadowElevation = 18.dp,
    modifier = modifier
      .shadow(
        elevation = 26.dp,
        shape = RoundedCornerShape(28.dp),
        ambientColor = Color.Black.copy(alpha = 0.50f),
        spotColor = Color(0xFF6366F1).copy(alpha = 0.35f)
      )
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 20.dp, vertical = 18.dp)
    ) {
      // Row 1: "Ask me anything about your health" text field
      BasicTextField(
        value = inputQuery,
        onValueChange = onInputChange,
        textStyle = TextStyle(
          color = Color.White,
          fontSize = 17.sp,
          fontWeight = FontWeight.Normal,
          letterSpacing = (-0.2).sp
        ),
        cursorBrush = SolidColor(Color(0xFF8B5CF6)),
        decorationBox = { innerTextField ->
          Box(
            modifier = Modifier.fillMaxWidth(),
            contentAlignment = Alignment.CenterStart
          ) {
            if (inputQuery.isEmpty()) {
              Text(
                text = "Ask me anything about your health",
                style = TextStyle(
                  color = Color.White.copy(alpha = 0.70f),
                  fontSize = 17.sp,
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

      Spacer(modifier = Modifier.height(20.dp))

      // Row 2: 4 Icons on Left, Purple Circular Send Button on Right
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        // Action Icons
        Row(
          horizontalArrangement = Arrangement.spacedBy(10.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          // Icon 1: [+] Attach
          Box(
            modifier = Modifier
              .size(36.dp)
              .clip(RoundedCornerShape(10.dp))
              .clickable(onClick = onOpenAttach),
            contentAlignment = Alignment.Center
          ) {
            SquarePlusGlyph(isDark = true)
          }

          // Icon 2: Globe with pointer arrow (Guidelines Mode)
          Box(
            modifier = Modifier
              .size(36.dp)
              .clip(RoundedCornerShape(10.dp))
              .background(
                if (selectedMode == DorkAiMode.GUIDELINES) Color(0x338B5CF6) else Color.Transparent
              )
              .clickable { onSelectMode(DorkAiMode.GUIDELINES) },
            contentAlignment = Alignment.Center
          ) {
            GlobeCursorGlyph(
              isDark = true,
              isSelected = selectedMode == DorkAiMode.GUIDELINES
            )
          }

          // Icon 3: Microscope (Deep Biomarker Mode)
          Box(
            modifier = Modifier
              .size(36.dp)
              .clip(RoundedCornerShape(10.dp))
              .background(
                if (selectedMode == DorkAiMode.DEEP_LAB) Color(0x338B5CF6) else Color.Transparent
              )
              .clickable { onSelectMode(DorkAiMode.DEEP_LAB) },
            contentAlignment = Alignment.Center
          ) {
            MicroscopeGlyph(
              isDark = true,
              isSelected = selectedMode == DorkAiMode.DEEP_LAB
            )
          }

          // Icon 4: Viewfinder with Plus Sign in Top-Right Corner
          Box(
            modifier = Modifier
              .size(36.dp)
              .clip(RoundedCornerShape(10.dp))
              .background(
                if (selectedMode == DorkAiMode.OPTICAL_SCAN) Color(0x338B5CF6) else Color.Transparent
              )
              .clickable(onClick = onOpenScan),
            contentAlignment = Alignment.Center
          ) {
            ViewfinderPlusGlyph(
              isDark = true,
              isSelected = selectedMode == DorkAiMode.OPTICAL_SCAN
            )
          }
        }

        // Circular Purple Send Button with ↑ arrow (matching clean_1.jpg)
        Box(
          modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(
              Brush.linearGradient(
                listOf(Color(0xFF8B5CF6), Color(0xFF6366F1))
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
            UpwardArrowIcon(modifier = Modifier.size(18.dp))
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
      quadraticBezierTo(left, top, left + r, top)
      lineTo(left + arm, top)
    }
    drawPath(path = tlPath, color = strokeColor, style = Stroke(width = sw, cap = StrokeCap.Round))

    // Bottom-Left corner bracket ⌞
    val blPath = Path().apply {
      moveTo(left, bottom - arm)
      lineTo(left, bottom - r)
      quadraticBezierTo(left, bottom, left + r, bottom)
      lineTo(left + arm, bottom)
    }
    drawPath(path = blPath, color = strokeColor, style = Stroke(width = sw, cap = StrokeCap.Round))

    // Bottom-Right corner bracket ⌟
    val brPath = Path().apply {
      moveTo(right - arm, bottom)
      lineTo(right - r, bottom)
      quadraticBezierTo(right, bottom, right, bottom - r)
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

/**
 * Optical Scanner Dialog.
 */
@Composable
fun OpticalScannerDialog(
  onScanConfirmed: (String) -> Unit,
  onDismiss: () -> Unit,
  isDark: Boolean
) {
  var scannedTarget by remember { mutableStateOf("Amoxicillin 500mg - 3x Daily (Rx #884920)") }

  Dialog(onDismissRequest = onDismiss) {
    Surface(
      shape = RoundedCornerShape(24.dp),
      color = if (isDark) Color(0xFF14242E) else Color.White,
      border = BorderStroke(
        1.2.dp,
        if (isDark) Color(0x5538BDF8) else Color(0x40CBD5E1)
      ),
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp)
    ) {
      Column(
        modifier = Modifier.padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = "Optical Health Scanner",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = if (isDark) Color.White else Color(0xFF0F172A)
          )
          IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
            Icon(
              imageVector = Icons.Rounded.Close,
              contentDescription = "Close",
              tint = if (isDark) Color(0xAAFFFFFF) else Color(0xFF64748B)
            )
          }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Box(
          modifier = Modifier
            .fillMaxWidth()
            .height(140.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(if (isDark) Color(0xFF0C161D) else Color(0xFF0F172A)),
          contentAlignment = Alignment.Center
        ) {
          Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            Icon(
              imageVector = Icons.Rounded.PhotoCamera,
              contentDescription = null,
              tint = Color(0xFF38BDF8),
              modifier = Modifier.size(32.dp)
            )
            Text(
              text = "Prescription Detected",
              style = MaterialTheme.typography.labelSmall,
              color = Color(0xFFBAE6FD)
            )
            Text(
              text = scannedTarget,
              style = MaterialTheme.typography.bodySmall,
              fontWeight = FontWeight.SemiBold,
              color = Color.White
            )
          }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Surface(
          shape = RoundedCornerShape(14.dp),
          color = if (isDark) Color(0xFF0284C7) else Color(0xFF0F172A),
          modifier = Modifier
            .fillMaxWidth()
            .clickable { onScanConfirmed(scannedTarget) }
        ) {
          Box(
            modifier = Modifier.padding(vertical = 12.dp),
            contentAlignment = Alignment.Center
          ) {
            Text(
              text = "Capture & Analyze with Dork AI",
              style = MaterialTheme.typography.labelLarge,
              fontWeight = FontWeight.Bold,
              color = Color.White
            )
          }
        }
      }
    }
  }
}
