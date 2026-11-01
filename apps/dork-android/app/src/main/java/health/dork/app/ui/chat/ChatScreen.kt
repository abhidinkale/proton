package health.dork.app.ui.chat

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.AddCircleOutline
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Phone
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.data.model.ChatMessage
import health.dork.app.core.data.model.MessageSender
import health.dork.app.core.designsystem.DorkTheme

/**
 * Modern luxury clinic chat screen featuring:
 * - Start-of-app signature glowing amber/ember (dark mode) or serene sky-blue pastel (light mode) canvas
 * - Precision star sparkle crosshair grid
 * - Glassmorphic top bar with doctor presence indicator and verified credential
 * - High-contrast editorial bubble typography with delivery state ticks
 * - Interactive clinical suggestion chips
 * - Floating frosted composer island
 */
@Composable
fun ChatScreen(
  viewModel: ChatViewModel,
  onBackClick: () -> Unit,
  darkTheme: Boolean = isSystemInDarkTheme(),
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val listState = rememberLazyListState()
  var showCallDialog by remember { mutableStateOf(false) }

  val quickPrompts = remember {
    listOf(
      "❤️ Share blood pressure",
      "💊 Refill question",
      "📅 Next consultation",
      "🩺 Log symptom",
      "🧪 Lab result status"
    )
  }

  LaunchedEffect(uiState.messages.size) {
    if (uiState.messages.isNotEmpty()) {
      listState.animateScrollToItem(uiState.messages.size - 1)
    }
  }

  DorkTheme(darkTheme = darkTheme) {
    Box(
      modifier = modifier
        .fillMaxSize()
        .background(if (darkTheme) Color(0xFF0B0E14) else Color.White)
    ) {
      // ── 1. Start-of-App Signature Canvas Background ───────────────────
      ChatCanvasBackground(
        darkTheme = darkTheme,
        modifier = Modifier.fillMaxSize()
      )

      Column(
        modifier = Modifier
          .fillMaxSize()
          .statusBarsPadding()
          .imePadding()
      ) {
        // ── 2. Glassmorphic Clinic Top Bar ──────────────────────────────
        ChatGlassTopBar(
          providerName = uiState.providerName,
          providerSpecialty = uiState.providerSpecialty,
          darkTheme = darkTheme,
          onBackClick = onBackClick,
          onCallClick = { showCallDialog = true }
        )

        // ── 3. Encrypted Local Channel Pill ────────────────────────────
        Box(
          modifier = Modifier
            .fillMaxWidth()
            .padding(top = 10.dp, bottom = 4.dp),
          contentAlignment = Alignment.Center
        ) {
          Surface(
            shape = RoundedCornerShape(percent = 50),
            color = if (darkTheme) Color.White.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.85f),
            border = BorderStroke(
              1.dp,
              if (darkTheme) Color.White.copy(alpha = 0.12f) else Color(0xFFCBD5E1).copy(alpha = 0.6f)
            ),
            shadowElevation = if (darkTheme) 0.dp else 2.dp
          ) {
            Row(
              modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              Icon(
                imageVector = Icons.Rounded.Lock,
                contentDescription = null,
                tint = if (darkTheme) Color(0xFF38BDF8) else Color(0xFF0284C7),
                modifier = Modifier.size(13.dp)
              )
              Spacer(modifier = Modifier.width(6.dp))
              Text(
                text = "End-to-end encrypted · Local care inbox",
                style = MaterialTheme.typography.labelSmall.copy(
                  fontSize = 11.sp,
                  fontWeight = FontWeight.Medium
                ),
                color = if (darkTheme) Color.White.copy(alpha = 0.75f) else Color(0xFF334155)
              )
            }
          }
        }

        // ── 4. Chat Message Feed ────────────────────────────────────────
        LazyColumn(
          state = listState,
          modifier = Modifier
            .weight(1f)
            .padding(horizontal = 16.dp),
          contentPadding = PaddingValues(top = 10.dp, bottom = 12.dp),
          verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
          items(uiState.messages, key = { it.id }) { msg ->
            val isPatient = msg.sender == MessageSender.PATIENT
            if (isPatient) {
              PatientChatBubble(msg = msg, darkTheme = darkTheme)
            } else {
              DoctorChatBubble(
                msg = msg,
                doctorName = uiState.providerName,
                darkTheme = darkTheme
              )
            }
          }
        }

        // ── 5. Quick Suggestion Prompt Chips ───────────────────────────
        LazyRow(
          modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 6.dp),
          contentPadding = PaddingValues(horizontal = 16.dp),
          horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          items(quickPrompts) { prompt ->
            Surface(
              shape = RoundedCornerShape(percent = 50),
              color = if (darkTheme) Color.White.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.90f),
              border = BorderStroke(
                1.dp,
                if (darkTheme) Color.White.copy(alpha = 0.16f) else Color(0xFFCBD5E1)
              ),
              shadowElevation = if (darkTheme) 0.dp else 1.dp,
              modifier = Modifier.clickable {
                viewModel.onInputChange(prompt.substringAfter(" "))
              }
            ) {
              Text(
                text = prompt,
                style = MaterialTheme.typography.labelSmall.copy(
                  fontWeight = FontWeight.Medium,
                  fontSize = 11.5.sp
                ),
                color = if (darkTheme) Color.White.copy(alpha = 0.85f) else Color(0xFF1E293B),
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
              )
            }
          }
        }

        // ── 6. Floating Frosted Composer Island ─────────────────────────
        ChatComposerIsland(
          inputMessage = uiState.inputMessage,
          onInputChange = viewModel::onInputChange,
          onSend = viewModel::sendMessage,
          darkTheme = darkTheme,
          modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 8.dp)
        )
      }

      // Quick Call Confirmation Dialog
      if (showCallDialog) {
        AlertDialog(
          onDismissRequest = { showCallDialog = false },
          title = {
            Text(
              text = "Beacon Hill Health",
              fontWeight = FontWeight.Bold,
              color = DorkTheme.colors.textPrimary
            )
          },
          text = {
            Text(
              text = "Direct line to ${uiState.providerName}'s care team:\n\n+1 (617) 555-0198\n\nOperating hours: Mon-Fri 8:00 AM - 5:30 PM EST.",
              color = DorkTheme.colors.textSecondary
            )
          },
          confirmButton = {
            TextButton(onClick = { showCallDialog = false }) {
              Text("Close", fontWeight = FontWeight.Bold)
            }
          }
        )
      }
    }
  }
}

/**
 * Start-of-app background canvas ported to Chat:
 * Warm radiant ember/amber glow in Dark Mode, serene soft sky-blue gradient in Light Mode.
 */
@Composable
private fun ChatCanvasBackground(darkTheme: Boolean, modifier: Modifier = Modifier) {
  Canvas(modifier = modifier) {
    val width = size.width
    val height = size.height

    if (darkTheme) {
      // 1. Primary Warm Radiant Glow (bottom-right / center focus)
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
    val starRadius = 16.dp.toPx()
    val haloRadius = 36.dp.toPx()

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

    // 4-Point star shape
    val starPath = Path().apply {
      moveTo(crosshairX, crosshairY - starRadius)
      quadraticTo(crosshairX, crosshairY, crosshairX + starRadius, crosshairY)
      quadraticTo(crosshairX, crosshairY, crosshairX, crosshairY + starRadius)
      quadraticTo(crosshairX, crosshairY, crosshairX - starRadius, crosshairY)
      quadraticTo(crosshairX, crosshairY, crosshairX, crosshairY - starRadius)
      close()
    }
    val starColor = if (darkTheme) Color(0xFFFFD54F) else Color(0xFF1E88E5)
    drawPath(path = starPath, color = starColor)
  }
}

/**
 * Top App Bar with physician avatar, online presence dot, and direct phone dialer.
 */
@Composable
private fun ChatGlassTopBar(
  providerName: String,
  providerSpecialty: String,
  darkTheme: Boolean,
  onBackClick: () -> Unit,
  onCallClick: () -> Unit
) {
  Surface(
    color = if (darkTheme) Color(0xD90B0E14) else Color.White.copy(alpha = 0.90f),
    border = BorderStroke(
      1.dp,
      if (darkTheme) Color.White.copy(alpha = 0.10f) else Color(0xFFCBD5E1).copy(alpha = 0.5f)
    ),
    shadowElevation = if (darkTheme) 0.dp else 4.dp,
    modifier = Modifier.fillMaxWidth()
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 14.dp, vertical = 10.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.SpaceBetween
    ) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
      ) {
        // Back Button
        Box(
          modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(if (darkTheme) Color.White.copy(alpha = 0.08f) else Color(0xFFF1F5F9))
            .clickable(onClick = onBackClick),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
            contentDescription = "Back",
            tint = if (darkTheme) Color.White else Color(0xFF0F172A),
            modifier = Modifier.size(20.dp)
          )
        }

        // Doctor Avatar with Online Presence Dot
        Box(modifier = Modifier.size(42.dp)) {
          Box(
            modifier = Modifier
              .size(42.dp)
              .clip(CircleShape)
              .background(
                Brush.linearGradient(
                  listOf(Color(0xFF0284C7), Color(0xFF0369A1))
                )
              ),
            contentAlignment = Alignment.Center
          ) {
            Text(
              text = "SC",
              style = MaterialTheme.typography.titleSmall.copy(
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
              ),
              color = Color.White
            )
          }

          val pulseTransition = rememberInfiniteTransition(label = "doctorPulse")
          val pulseScale by pulseTransition.animateFloat(
            initialValue = 0.92f,
            targetValue = 1.15f,
            animationSpec = infiniteRepeatable(
              animation = tween(1200, easing = FastOutSlowInEasing),
              repeatMode = RepeatMode.Reverse
            ),
            label = "pulseScale"
          )
          val pulseAlpha by pulseTransition.animateFloat(
            initialValue = 0.70f,
            targetValue = 1.0f,
            animationSpec = infiniteRepeatable(
              animation = tween(1200, easing = FastOutSlowInEasing),
              repeatMode = RepeatMode.Reverse
            ),
            label = "pulseAlpha"
          )

          // Active Presence Badge with fluid breathing pulse
          Box(
            modifier = Modifier
              .size((12 * pulseScale).dp)
              .align(Alignment.BottomEnd)
              .clip(CircleShape)
              .background(Color(0xFF22C55E).copy(alpha = pulseAlpha))
              .border(2.dp, if (darkTheme) Color(0xFF0B0E14) else Color.White, CircleShape)
          )
        }

        // Physician Info
        Column {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
          ) {
            Text(
              text = providerName,
              style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp
              ),
              color = if (darkTheme) Color.White else Color(0xFF0F172A)
            )
            Icon(
              imageVector = Icons.Rounded.Verified,
              contentDescription = "Verified Clinic",
              tint = if (darkTheme) Color(0xFF38BDF8) else Color(0xFF0284C7),
              modifier = Modifier.size(15.dp)
            )
          }
          Text(
            text = providerSpecialty.take(30),
            style = MaterialTheme.typography.bodySmall.copy(
              fontSize = 11.5.sp
            ),
            color = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF475569),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
          )
        }
      }

      // Clinic Phone Quick Call Action
      Box(
        modifier = Modifier
          .size(38.dp)
          .clip(CircleShape)
          .background(if (darkTheme) Color.White.copy(alpha = 0.08f) else Color(0xFFF1F5F9))
          .clickable(onClick = onCallClick),
        contentAlignment = Alignment.Center
      ) {
        Icon(
          imageVector = Icons.Rounded.Phone,
          contentDescription = "Call Clinic",
          tint = if (darkTheme) Color(0xFF38BDF8) else Color(0xFF0284C7),
          modifier = Modifier.size(18.dp)
        )
      }
    }
  }
}

/**
 * Incoming Doctor message bubble with frosted glass styling and provider badge.
 */
@Composable
private fun DoctorChatBubble(
  msg: ChatMessage,
  doctorName: String,
  darkTheme: Boolean
) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.Start
  ) {
    Surface(
      shape = RoundedCornerShape(
        topStart = 18.dp,
        topEnd = 18.dp,
        bottomEnd = 18.dp,
        bottomStart = 4.dp
      ),
      color = if (darkTheme) Color(0xD917202D) else Color.White.copy(alpha = 0.95f),
      border = BorderStroke(
        1.dp,
        if (darkTheme) Color.White.copy(alpha = 0.14f) else Color(0xFFCBD5E1).copy(alpha = 0.6f)
      ),
      shadowElevation = if (darkTheme) 0.dp else 4.dp,
      modifier = Modifier.fillMaxWidth(0.85f)
    ) {
      Column(modifier = Modifier.padding(14.dp)) {
        Text(
          text = msg.text,
          style = MaterialTheme.typography.bodyMedium.copy(
            lineHeight = 21.sp,
            fontSize = 14.sp
          ),
          color = if (darkTheme) Color(0xFFF1F5F9) else Color(0xFF0F172A)
        )

        Spacer(modifier = Modifier.height(6.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = "Dr. Chen · Primary Care",
            style = MaterialTheme.typography.labelSmall.copy(
              fontSize = 10.5.sp,
              fontWeight = FontWeight.Medium
            ),
            color = if (darkTheme) Color(0xFF38BDF8) else Color(0xFF0284C7)
          )

          Text(
            text = msg.timestamp,
            style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.5.sp),
            color = if (darkTheme) Color.White.copy(alpha = 0.45f) else Color(0xFF94A3B8)
          )
        }
      }
    }
  }
}

/**
 * Outgoing Patient message bubble with high-contrast luxury ink and delivery status.
 */
@Composable
private fun PatientChatBubble(
  msg: ChatMessage,
  darkTheme: Boolean
) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.End
  ) {
    Surface(
      shape = RoundedCornerShape(
        topStart = 18.dp,
        topEnd = 18.dp,
        bottomEnd = 4.dp,
        bottomStart = 18.dp
      ),
      color = if (darkTheme) Color(0xFF1E293B) else Color(0xFF111827),
      border = BorderStroke(
        1.dp,
        if (darkTheme) Color.White.copy(alpha = 0.18f) else Color(0xFF374151)
      ),
      shadowElevation = 4.dp,
      modifier = Modifier.fillMaxWidth(0.85f)
    ) {
      Column(modifier = Modifier.padding(14.dp)) {
        Text(
          text = msg.text,
          style = MaterialTheme.typography.bodyMedium.copy(
            lineHeight = 21.sp,
            fontSize = 14.sp
          ),
          color = Color.White
        )

        Spacer(modifier = Modifier.height(6.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.End,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = msg.timestamp,
            style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.5.sp),
            color = Color.White.copy(alpha = 0.65f)
          )

          Spacer(modifier = Modifier.width(4.dp))

          Icon(
            imageVector = Icons.Rounded.DoneAll,
            contentDescription = "Delivered",
            tint = Color(0xFF38BDF8),
            modifier = Modifier.size(14.dp)
          )
        }
      }
    }
  }
}

/**
 * Floating frosted glass composer island.
 */
@Composable
private fun ChatComposerIsland(
  inputMessage: String,
  onInputChange: (String) -> Unit,
  onSend: () -> Unit,
  darkTheme: Boolean,
  modifier: Modifier = Modifier
) {
  Surface(
    shape = RoundedCornerShape(32.dp),
    color = if (darkTheme) Color(0xE6131822) else Color.White.copy(alpha = 0.95f),
    border = BorderStroke(
      1.dp,
      if (darkTheme) Color.White.copy(alpha = 0.16f) else Color(0xFFCBD5E1)
    ),
    shadowElevation = if (darkTheme) 4.dp else 10.dp,
    modifier = modifier
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 8.dp, vertical = 6.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      // Attachment Button
      IconButton(
        onClick = { /* Attachment action */ },
        modifier = Modifier.size(38.dp)
      ) {
        Icon(
          imageVector = Icons.Rounded.AddCircleOutline,
          contentDescription = "Attach Medical Document",
          tint = if (darkTheme) Color.White.copy(alpha = 0.60f) else Color(0xFF64748B),
          modifier = Modifier.size(22.dp)
        )
      }

      // Input field
      Box(
        modifier = Modifier
          .weight(1f)
          .padding(horizontal = 8.dp)
      ) {
        if (inputMessage.isEmpty()) {
          Text(
            text = "Message Dr. Chen...",
            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.5.sp),
            color = if (darkTheme) Color.White.copy(alpha = 0.40f) else Color(0xFF94A3B8)
          )
        }
        BasicTextField(
          value = inputMessage,
          onValueChange = onInputChange,
          textStyle = TextStyle(
            fontSize = 14.5.sp,
            color = if (darkTheme) Color.White else Color(0xFF0F172A),
            lineHeight = 20.sp
          ),
          cursorBrush = SolidColor(if (darkTheme) Color(0xFF38BDF8) else Color(0xFF0284C7)),
          modifier = Modifier.fillMaxWidth(),
          maxLines = 4
        )
      }

      // Elevated Circular Send Button
      val canSend = inputMessage.isNotBlank()
      Box(
        modifier = Modifier
          .size(40.dp)
          .clip(CircleShape)
          .background(
            if (canSend) {
              Brush.linearGradient(listOf(Color(0xFF38BDF8), Color(0xFF0284C7)))
            } else {
              SolidColor(if (darkTheme) Color.White.copy(alpha = 0.08f) else Color(0xFFF1F5F9))
            }
          )
          .clickable(enabled = canSend, onClick = onSend),
        contentAlignment = Alignment.Center
      ) {
        Icon(
          imageVector = Icons.AutoMirrored.Rounded.Send,
          contentDescription = "Send Message",
          tint = if (canSend) Color.White else (if (darkTheme) Color.White.copy(alpha = 0.25f) else Color(0xFFCBD5E1)),
          modifier = Modifier.size(18.dp)
        )
      }
    }
  }
}
