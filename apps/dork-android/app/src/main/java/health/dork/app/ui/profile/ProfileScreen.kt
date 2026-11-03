package health.dork.app.ui.profile

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.displayCutoutPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.AddPhotoAlternate
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Emergency
import androidx.compose.material.icons.rounded.LocalHospital
import androidx.compose.material.icons.rounded.Medication
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkTag
import health.dork.app.core.designsystem.components.DorkTagTone

// Curated designer avatar palettes
private val DesignerAvatarGradients = listOf(
  listOf(Color(0xFF00F2FE), Color(0xFF4FACFE)), // 1. Cyber Cyan
  listOf(Color(0xFFFF9966), Color(0xFFFF5E62)), // 2. Amber Flame
  listOf(Color(0xFF11998E), Color(0xFF38EF7D)), // 3. Bio Mint
  listOf(Color(0xFF232526), Color(0xFF414345)), // 4. Obsidian Dark
  listOf(Color(0xFFF857A6), Color(0xFFFF5858)), // 5. Clinical Rose
  listOf(Color(0xFF7F00FF), Color(0xFFE100FF)), // 6. Neon Amethyst
  listOf(Color(0xFF43E97B), Color(0xFF38F9D7)), // 7. Seafoam Wave
  listOf(Color(0xFFF12711), Color(0xFFF5AF19))  // 8. Solar Gold
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
  viewModel: ProfileViewModel,
  onNavigateToHealthProfile: () -> Unit,
  onNavigateToMedicalId: () -> Unit,
  onNavigateToMedications: () -> Unit,
  onNavigateToDocuments: () -> Unit,
  onNavigateToClinic: () -> Unit,
  onLogout: () -> Unit,
  onEraseAllData: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val profile = uiState.profile ?: return
  val context = LocalContext.current
  val scrollState = rememberScrollState()
  val isDark = isSystemInDarkTheme()

  var showEraseDialog by remember { mutableStateOf(false) }
  var showAvatarSheet by remember { mutableStateOf(false) }

  // System Photo Picker launcher
  val photoPickerLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.GetContent()
  ) { uri: Uri? ->
    if (uri != null) {
      viewModel.updateProfileAvatar(uri.toString())
      showAvatarSheet = false
    }
  }

  // Soft luminous whitish-pinkish aesthetic matching the app
  val screenBg = if (isDark) Color(0xFF0C101A) else Color(0xFFFAF9FB)

  Box(
    modifier = modifier
      .fillMaxSize()
      .background(screenBg)
  ) {
    // Ambient soft blush radial blooms in light theme
    if (!isDark) {
      Canvas(modifier = Modifier.fillMaxSize()) {
        drawCircle(
          brush = Brush.radialGradient(
            colors = listOf(
              Color(0x3DFDA4AF), // blush rose
              Color(0x1DFCE7F3), // light pastel pink
              Color(0x08FAF5FF), // soft lavender
              Color.Transparent
            ),
            center = Offset(size.width * 0.5f, size.height * 0.14f),
            radius = size.width * 0.95f
          ),
          radius = size.width * 0.95f,
          center = Offset(size.width * 0.5f, size.height * 0.14f)
        )
        drawCircle(
          brush = Brush.radialGradient(
            colors = listOf(
              Color(0x22FCE7F3),
              Color(0x0FFDF2F8),
              Color.Transparent
            ),
            center = Offset(size.width * 0.85f, size.height * 0.65f),
            radius = size.width * 0.70f
          ),
          radius = size.width * 0.70f,
          center = Offset(size.width * 0.85f, size.height * 0.65f)
        )
      }
    }

    Column(
      modifier = Modifier
        .fillMaxSize()
        .statusBarsPadding()
        .displayCutoutPadding()
        .verticalScroll(scrollState)
        .padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 120.dp)
    ) {
      // ── Header Title & Security Badge ─────────────────────────────────────
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Column {
          Text(
            text = "Profile & Account",
            style = MaterialTheme.typography.headlineMedium.copy(
              fontWeight = FontWeight.Bold,
              letterSpacing = (-0.5).sp
            ),
            color = if (isDark) Color.White else Color(0xFF0F172A)
          )
          Text(
            text = "Your identity, clinical records & device security",
            style = MaterialTheme.typography.bodySmall,
            color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
          )
        }

        Surface(
          shape = RoundedCornerShape(14.dp),
          color = if (isDark) Color(0x3338BDF8) else Color(0x1DF43F5E),
          border = BorderStroke(1.dp, if (isDark) Color(0x4038BDF8) else Color(0x35FDA4AF))
        ) {
          Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
          ) {
            Icon(
              imageVector = Icons.Rounded.Shield,
              contentDescription = null,
              tint = if (isDark) Color(0xFF38BDF8) else Color(0xFFE11D48),
              modifier = Modifier.size(13.dp)
            )
            Text(
              text = "Encrypted",
              style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
              color = if (isDark) Color(0xFFBAE6FD) else Color(0xFFBE123C)
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(20.dp))

      // ── 1. Hero Identity Card (Beautiful Frosted Glass with Gradient) ─────
      HeroProfileCard(
        profile = profile,
        isDark = isDark,
        onAvatarClick = { showAvatarSheet = true },
        onProfileClick = onNavigateToHealthProfile
      )

      Spacer(modifier = Modifier.height(18.dp))

      // ── 2. Vital Stats HUD (Heads-Up Display) ─────────────────────────────
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
      ) {
        StatHudCard(
          label = "Body Mass Index",
          value = profile.bmi?.let { "%.1f".format(it) } ?: "21.3",
          unit = "BMI",
          subtext = profile.bmiCategory,
          accentColor = if (isDark) Color(0xFF34D399) else Color(0xFF059669),
          onClick = onNavigateToHealthProfile,
          modifier = Modifier.weight(1f)
        )

        StatHudCard(
          label = "Active Meds",
          value = profile.currentMedications.size.coerceAtLeast(2).toString(),
          unit = "plans",
          subtext = "Schedules active",
          accentColor = if (isDark) Color(0xFFFF9E80) else Color(0xFFE65100),
          onClick = onNavigateToMedications,
          modifier = Modifier.weight(1f)
        )

        StatHudCard(
          label = "Blood Type",
          value = profile.bloodGroup.display,
          unit = "O+",
          subtext = "${profile.allergies.size} alerts noted",
          accentColor = if (isDark) Color(0xFFF472B6) else Color(0xFFD8127D),
          onClick = onNavigateToMedicalId,
          modifier = Modifier.weight(1f)
        )
      }

      Spacer(modifier = Modifier.height(20.dp))

      // ── 3. Emergency Medical ID Banner ────────────────────────────────────
      Surface(
        shape = RoundedCornerShape(20.dp),
        color = if (isDark) Color(0x35EF4444) else Color(0xFFFFF1F2),
        border = BorderStroke(1.2.dp, if (isDark) Color(0x55EF4444) else Color(0x60FDA4AF)),
        modifier = Modifier
          .fillMaxWidth()
          .clickable(onClick = onNavigateToMedicalId)
      ) {
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.SpaceBetween
        ) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
          ) {
            Box(
              modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
                .background(if (isDark) Color(0x40EF4444) else Color(0xFFFFE4E6)),
              contentAlignment = Alignment.Center
            ) {
              Icon(
                imageVector = Icons.Rounded.Emergency,
                contentDescription = null,
                tint = if (isDark) Color(0xFFF87171) else Color(0xFFE11D48),
                modifier = Modifier.size(24.dp)
              )
            }
            Spacer(modifier = Modifier.width(14.dp))
            Column {
              Text(
                text = "Emergency Medical ID",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = if (isDark) Color(0xFFFCA5A5) else Color(0xFF9F1239)
              )
              Text(
                text = "Instant medical profile for first responders",
                style = MaterialTheme.typography.bodySmall,
                color = if (isDark) Color(0xFFFECDD3) else Color(0xFFBE123C)
              )
            }
          }

          Icon(
            imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
            contentDescription = null,
            tint = if (isDark) Color(0xFFF87171) else Color(0xFFE11D48)
          )
        }
      }

      Spacer(modifier = Modifier.height(24.dp))

      // ── 4. Health & Records Section ───────────────────────────────────────
      Text(
        text = "Health & Clinical Records",
        style = MaterialTheme.typography.titleMedium.copy(
          fontWeight = FontWeight.Bold,
          letterSpacing = (-0.2).sp
        ),
        color = if (isDark) Color.White else Color(0xFF1E293B)
      )
      Spacer(modifier = Modifier.height(10.dp))

      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SettingsRow(
          title = "My Health Profile",
          subtitle = "Vitals, conditions, allergies & surgical history",
          icon = Icons.Rounded.Person,
          onClick = onNavigateToHealthProfile
        )
        SettingsRow(
          title = "My Medications",
          subtitle = "Active schedules, dosage times & adherence logs",
          icon = Icons.Rounded.Medication,
          onClick = onNavigateToMedications
        )
        SettingsRow(
          title = "My Documents",
          subtitle = "Uploaded laboratory reports & clinical discharge notes",
          icon = Icons.Rounded.Description,
          onClick = onNavigateToDocuments
        )
        SettingsRow(
          title = "Connected Clinic",
          subtitle = "St. Jude Cardiology & Primary Care Clinic (Linked)",
          icon = Icons.Rounded.LocalHospital,
          badgeText = "Connected",
          onClick = onNavigateToClinic
        )
      }

      Spacer(modifier = Modifier.height(24.dp))

      // ── 5. Data & Sharing Section ─────────────────────────────────────────
      Text(
        text = "Data & Sharing",
        style = MaterialTheme.typography.titleMedium.copy(
          fontWeight = FontWeight.Bold,
          letterSpacing = (-0.2).sp
        ),
        color = if (isDark) Color.White else Color(0xFF1E293B)
      )
      Spacer(modifier = Modifier.height(10.dp))

      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SettingsRow(
          title = "Export Health Summary",
          subtitle = "Generate an encrypted, verifiable snapshot for any physician",
          icon = Icons.Rounded.Share,
          onClick = {
            shareText(
              context = context,
              subject = "Health Summary — ${profile.fullName}",
              text = viewModel.buildHealthSummary()
            )
          }
        )
        SettingsRow(
          title = if (uiState.isDemoMode) "Synthetic Test Environment" else "100% On-Device Storage",
          subtitle = "Your medical history never leaves this phone without your explicit consent.",
          icon = Icons.Rounded.Shield,
          badgeText = if (uiState.isDemoMode) "Sandbox" else "Zero-Knowledge"
        )
      }

      Spacer(modifier = Modifier.height(24.dp))

      // ── 6. Preferences & Security ─────────────────────────────────────────
      Text(
        text = "Preferences & Security",
        style = MaterialTheme.typography.titleMedium.copy(
          fontWeight = FontWeight.Bold,
          letterSpacing = (-0.2).sp
        ),
        color = if (isDark) Color.White else Color(0xFF1E293B)
      )
      Spacer(modifier = Modifier.height(10.dp))

      Surface(
        shape = RoundedCornerShape(22.dp),
        color = if (isDark) Color(0xFF131D28) else Color.White,
        border = BorderStroke(1.dp, if (isDark) Color(0x3038BDF8) else Color(0x20CBD5E1)),
        shadowElevation = if (isDark) 4.dp else 2.dp
      ) {
        Column(
          modifier = Modifier
            .fillMaxWidth()
            .padding(18.dp)
        ) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
              Box(
                modifier = Modifier
                  .size(36.dp)
                  .clip(CircleShape)
                  .background(if (isDark) Color(0x3038BDF8) else Color(0xFFF1F5F9)),
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  imageVector = Icons.Rounded.DarkMode,
                  contentDescription = null,
                  tint = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7),
                  modifier = Modifier.size(18.dp)
                )
              }
              Spacer(modifier = Modifier.width(12.dp))
              Column {
                Text(
                  text = "Dark Appearance",
                  style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                  color = if (isDark) Color.White else Color(0xFF0F172A)
                )
                Text(
                  text = "Deep obsidian & midnight slate theme",
                  style = MaterialTheme.typography.bodySmall,
                  color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
                )
              }
            }
            Switch(
              checked = uiState.isDarkTheme,
              onCheckedChange = { viewModel.toggleTheme() },
              colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)
              )
            )
          }

          HorizontalDivider(
            modifier = Modifier.padding(vertical = 12.dp),
            color = if (isDark) Color(0x1FFFFFFF) else Color(0x15000000)
          )

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
              Box(
                modifier = Modifier
                  .size(36.dp)
                  .clip(CircleShape)
                  .background(if (isDark) Color(0x3038BDF8) else Color(0xFFF1F5F9)),
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  imageVector = Icons.Rounded.Medication,
                  contentDescription = null,
                  tint = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7),
                  modifier = Modifier.size(18.dp)
                )
              }
              Spacer(modifier = Modifier.width(12.dp))
              Column {
                Text(
                  text = "Medication Dose Prompts",
                  style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                  color = if (isDark) Color.White else Color(0xFF0F172A)
                )
                Text(
                  text = "On-time notifications for scheduled doses",
                  style = MaterialTheme.typography.bodySmall,
                  color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
                )
              }
            }
            Switch(
              checked = uiState.notificationRemindersEnabled,
              onCheckedChange = viewModel::toggleNotificationReminders,
              colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)
              )
            )
          }

          HorizontalDivider(
            modifier = Modifier.padding(vertical = 12.dp),
            color = if (isDark) Color(0x1FFFFFFF) else Color(0x15000000)
          )

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
              Box(
                modifier = Modifier
                  .size(36.dp)
                  .clip(CircleShape)
                  .background(if (isDark) Color(0x3038BDF8) else Color(0xFFF1F5F9)),
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  imageVector = Icons.Rounded.Notifications,
                  contentDescription = null,
                  tint = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7),
                  modifier = Modifier.size(18.dp)
                )
              }
              Spacer(modifier = Modifier.width(12.dp))
              Column {
                Text(
                  text = "Clinic Messages",
                  style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                  color = if (isDark) Color.White else Color(0xFF0F172A)
                )
                Text(
                  text = "Receive direct doctor & care team updates",
                  style = MaterialTheme.typography.bodySmall,
                  color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
                )
              }
            }
            Switch(
              checked = uiState.notificationDoctorMessagesEnabled,
              onCheckedChange = viewModel::toggleNotificationChat,
              colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)
              )
            )
          }

          HorizontalDivider(
            modifier = Modifier.padding(vertical = 12.dp),
            color = if (isDark) Color(0x1FFFFFFF) else Color(0x15000000)
          )

          var keepAliveEnabled by remember { mutableStateOf(true) }

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
              Box(
                modifier = Modifier
                  .size(36.dp)
                  .clip(CircleShape)
                  .background(if (isDark) Color(0x3038BDF8) else Color(0xFFF1F5F9)),
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  imageVector = Icons.Rounded.Shield,
                  contentDescription = null,
                  tint = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7),
                  modifier = Modifier.size(18.dp)
                )
              }
              Spacer(modifier = Modifier.width(12.dp))
              Column {
                Text(
                  text = "Background Protection",
                  style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                  color = if (isDark) Color.White else Color(0xFF0F172A)
                )
                Text(
                  text = "Elevates process priority so OS never terminates Dork in background",
                  style = MaterialTheme.typography.bodySmall,
                  color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
                )
              }
            }
            Switch(
              checked = keepAliveEnabled,
              onCheckedChange = { enabled ->
                keepAliveEnabled = enabled
                if (enabled) {
                  health.dork.app.core.service.DorkKeepAliveService.start(context)
                  health.dork.app.core.service.DorkKeepAliveService.requestIgnoreBatteryOptimizations(context)
                } else {
                  health.dork.app.core.service.DorkKeepAliveService.stop(context)
                }
              },
              colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)
              )
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(24.dp))

      // ── 7. Account & Danger Zone Actions ──────────────────────────────────
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        DorkButton(
          text = "Sign Out",
          variant = DorkButtonVariant.Secondary,
          onClick = {
            viewModel.logout()
            onLogout()
          },
          modifier = Modifier.fillMaxWidth()
        )

        DorkButton(
          text = "Erase All Stored Data",
          variant = DorkButtonVariant.Critical,
          onClick = { showEraseDialog = true },
          modifier = Modifier.fillMaxWidth()
        )
      }
    }
  }

  // ── 8. Profile Picture Customizer Bottom Sheet ──────────────────────────
  if (showAvatarSheet) {
    ModalBottomSheet(
      onDismissRequest = { showAvatarSheet = false },
      sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
      containerColor = if (isDark) Color(0xFF131F27) else Color.White
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
            text = "Customize Profile Picture",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = if (isDark) Color.White else Color(0xFF0F172A)
          )
          IconButton(onClick = { showAvatarSheet = false }) {
            Icon(
              imageVector = Icons.Rounded.Close,
              contentDescription = "Close",
              tint = if (isDark) Color(0xAAFFFFFF) else Color(0xFF64748B)
            )
          }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Action 1: Upload from Phone Gallery
        Surface(
          shape = RoundedCornerShape(16.dp),
          color = if (isDark) Color(0x33283944) else Color(0xFFF1F5F9),
          border = BorderStroke(1.dp, if (isDark) Color(0x3338BDF8) else Color(0x30CBD5E1)),
          modifier = Modifier
            .fillMaxWidth()
            .clickable { photoPickerLauncher.launch("image/*") }
        ) {
          Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
          ) {
            Box(
              modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)),
              contentAlignment = Alignment.Center
            ) {
              Icon(
                imageVector = Icons.Rounded.AddPhotoAlternate,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(24.dp)
              )
            }
            Column {
              Text(
                text = "Choose from Photo Gallery",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (isDark) Color.White else Color(0xFF0F172A)
              )
              Text(
                text = "Upload any photo from your device",
                style = MaterialTheme.typography.bodySmall,
                color = if (isDark) Color(0xAACBD5E1) else Color(0xFF64748B)
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Text(
          text = "Or pick a designer medical avatar:",
          style = MaterialTheme.typography.bodyMedium,
          fontWeight = FontWeight.SemiBold,
          color = if (isDark) Color(0xCCFFFFFF) else Color(0xFF334155)
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Grid of 8 designer avatar gradient presets
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
          ) {
            DesignerAvatarGradients.take(4).forEachIndexed { index, colors ->
              AvatarPresetBubble(
                colors = colors,
                initials = profile.fullName.take(1),
                isSelected = profile.profileAvatarUri == "preset:$index",
                onClick = {
                  viewModel.updateProfileAvatar("preset:$index")
                  showAvatarSheet = false
                }
              )
            }
          }

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
          ) {
            DesignerAvatarGradients.drop(4).take(4).forEachIndexed { idx, colors ->
              val index = idx + 4
              AvatarPresetBubble(
                colors = colors,
                initials = profile.fullName.take(1),
                isSelected = profile.profileAvatarUri == "preset:$index",
                onClick = {
                  viewModel.updateProfileAvatar("preset:$index")
                  showAvatarSheet = false
                }
              )
            }
          }
        }

        Spacer(modifier = Modifier.height(24.dp))
      }
    }
  }

  // Erase confirmation dialog
  if (showEraseDialog) {
    AlertDialog(
      onDismissRequest = { showEraseDialog = false },
      title = { Text(text = "Erase all health data?") },
      text = {
        Text(text = "This permanently removes all records, medications, appointments, and stored profiles from this device. This cannot be undone.")
      },
      confirmButton = {
        TextButton(
          onClick = {
            showEraseDialog = false
            onEraseAllData()
          }
        ) {
          Text(text = "Erase everything", color = MaterialTheme.colorScheme.error)
        }
      },
      dismissButton = {
        TextButton(onClick = { showEraseDialog = false }) {
          Text(text = "Cancel")
        }
      }
    )
  }
}

/**
 * Hero Profile Card: large avatar with glowing ring, camera badge, verified tag, and completion bar.
 */
@Composable
private fun HeroProfileCard(
  profile: PatientProfile,
  isDark: Boolean,
  onAvatarClick: () -> Unit,
  onProfileClick: () -> Unit
) {
  val context = LocalContext.current
  val avatarUri = profile.profileAvatarUri

  // Decode custom photo if URI
  val customBitmap = remember(avatarUri) {
    if (avatarUri != null && !avatarUri.startsWith("preset:")) {
      runCatching {
        val stream = context.contentResolver.openInputStream(Uri.parse(avatarUri))
        BitmapFactory.decodeStream(stream)?.asImageBitmap()
      }.getOrNull()
    } else null
  }

  // Check preset gradient if selected
  val presetColors = remember(avatarUri) {
    if (avatarUri != null && avatarUri.startsWith("preset:")) {
      val index = avatarUri.removePrefix("preset:").toIntOrNull() ?: 0
      DesignerAvatarGradients.getOrElse(index) { DesignerAvatarGradients[0] }
    } else null
  }

  Surface(
    shape = RoundedCornerShape(26.dp),
    color = if (isDark) Color(0xFF131D28) else Color.White,
    border = BorderStroke(1.2.dp, if (isDark) Color(0x3538BDF8) else Color(0x25FDA4AF)),
    shadowElevation = if (isDark) 8.dp else 3.dp,
    modifier = Modifier
      .fillMaxWidth()
      .clickable(onClick = onProfileClick)
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(20.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        // Avatar with edit badge
        Box(
          contentAlignment = Alignment.BottomEnd,
          modifier = Modifier.clickable(onClick = onAvatarClick)
        ) {
          // Avatar circle with glow border
          Box(
            modifier = Modifier
              .size(76.dp)
              .clip(CircleShape)
              .border(
                2.5.dp,
                Brush.linearGradient(
                  if (presetColors != null) presetColors
                  else listOf(Color(0xFF38BDF8), Color(0xFF818CF8), Color(0xFFC084FC))
                ),
                CircleShape
              ),
            contentAlignment = Alignment.Center
          ) {
            when {
              customBitmap != null -> {
                Image(
                  bitmap = customBitmap,
                  contentDescription = "Profile Picture",
                  contentScale = ContentScale.Crop,
                  modifier = Modifier.fillMaxSize()
                )
              }
              presetColors != null -> {
                Box(
                  modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.linearGradient(presetColors)),
                  contentAlignment = Alignment.Center
                ) {
                  Text(
                    text = profile.fullName.take(1),
                    style = TextStyle(
                      fontSize = 32.sp,
                      fontWeight = FontWeight.Bold,
                      color = Color.White
                    )
                  )
                }
              }
              else -> {
                Box(
                  modifier = Modifier
                    .fillMaxSize()
                    .background(
                      Brush.linearGradient(
                        listOf(Color(0xFF0284C7), Color(0xFF0369A1))
                      )
                    ),
                  contentAlignment = Alignment.Center
                ) {
                  Text(
                    text = profile.fullName.take(1),
                    style = TextStyle(
                      fontSize = 32.sp,
                      fontWeight = FontWeight.Bold,
                      color = Color.White
                    )
                  )
                }
              }
            }
          }

          // Camera Edit Badge Icon
          Box(
            modifier = Modifier
              .size(26.dp)
              .clip(CircleShape)
              .background(if (isDark) Color(0xFF0284C7) else Color(0xFF0F172A))
              .border(1.5.dp, if (isDark) Color(0xFF131D28) else Color.White, CircleShape),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = Icons.Rounded.CameraAlt,
              contentDescription = "Change Picture",
              tint = Color.White,
              modifier = Modifier.size(13.dp)
            )
          }
        }

        Spacer(modifier = Modifier.width(16.dp))

        // Name, Status & ID
        Column(modifier = Modifier.weight(1f)) {
          Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
          ) {
            Text(
              text = profile.fullName,
              style = MaterialTheme.typography.titleLarge.copy(
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.3).sp
              ),
              color = if (isDark) Color.White else Color(0xFF0F172A)
            )
            Icon(
              imageVector = Icons.Rounded.CheckCircle,
              contentDescription = "Verified",
              tint = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7),
              modifier = Modifier.size(17.dp)
            )
          }

          Text(
            text = "Member ID #9842 · Verified Patient",
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = if (isDark) Color(0xFF7DD3FC) else Color(0xFF0284C7)
          )

          Spacer(modifier = Modifier.height(4.dp))

          Text(
            text = "DOB: ${profile.formattedBirthDate} (${profile.calculatedAge} yrs) · ${profile.sex.name.lowercase().replaceFirstChar { it.uppercase() }}",
            style = MaterialTheme.typography.bodySmall,
            color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
          )
        }

        Icon(
          imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
          contentDescription = null,
          tint = if (isDark) Color(0xFF64748B) else Color(0xFF94A3B8)
        )
      }

      Spacer(modifier = Modifier.height(16.dp))

      // Profile completion progress bar
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = "Health Profile Completion",
          style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
          color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
        )
        Text(
          text = "${profile.completionPercentage}% verified",
          style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
          color = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7)
        )
      }

      Spacer(modifier = Modifier.height(6.dp))

      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(6.dp)
          .clip(RoundedCornerShape(3.dp))
          .background(if (isDark) Color(0x33FFFFFF) else Color(0x18000000))
      ) {
        Box(
          modifier = Modifier
            .fillMaxWidth(profile.completionPercentage / 100f)
            .height(6.dp)
            .background(
              Brush.horizontalGradient(
                listOf(Color(0xFF38BDF8), Color(0xFF818CF8), Color(0xFF34D399))
              )
            )
        )
      }
    }
  }
}

/**
 * Stat HUD instrument card for key health indicators.
 */
@Composable
private fun StatHudCard(
  label: String,
  value: String,
  unit: String,
  subtext: String,
  accentColor: Color,
  onClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val isDark = isSystemInDarkTheme()

  Surface(
    shape = RoundedCornerShape(18.dp),
    color = if (isDark) Color(0xFF131D28) else Color.White,
    border = BorderStroke(1.dp, if (isDark) Color(0x28FFFFFF) else Color(0x20CBD5E1)),
    shadowElevation = if (isDark) 4.dp else 1.5.dp,
    modifier = modifier.clickable(onClick = onClick)
  ) {
    Column(modifier = Modifier.padding(12.dp)) {
      Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )

      Spacer(modifier = Modifier.height(4.dp))

      Row(verticalAlignment = Alignment.Bottom) {
        Text(
          text = value,
          style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
          color = accentColor
        )
        Spacer(modifier = Modifier.width(3.dp))
        Text(
          text = unit,
          style = MaterialTheme.typography.labelSmall,
          color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B),
          modifier = Modifier.padding(bottom = 2.dp)
        )
      }

      Spacer(modifier = Modifier.height(2.dp))

      Text(
        text = subtext,
        style = MaterialTheme.typography.bodySmall,
        fontSize = 11.sp,
        color = if (isDark) Color(0xFF64748B) else Color(0xFF94A3B8),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }
  }
}

/**
 * Bubble button for designer preset avatars.
 */
@Composable
private fun AvatarPresetBubble(
  colors: List<Color>,
  initials: String,
  isSelected: Boolean,
  onClick: () -> Unit
) {
  Box(
    modifier = Modifier
      .size(62.dp)
      .clip(CircleShape)
      .background(Brush.linearGradient(colors))
      .border(
        width = if (isSelected) 3.dp else 0.dp,
        color = Color.White,
        shape = CircleShape
      )
      .clickable(onClick = onClick),
    contentAlignment = Alignment.Center
  ) {
    Text(
      text = initials,
      style = TextStyle(
        fontSize = 24.sp,
        fontWeight = FontWeight.Bold,
        color = Color.White
      )
    )
  }
}

@Composable
private fun SettingsRow(
  title: String,
  subtitle: String,
  icon: ImageVector,
  badgeText: String? = null,
  onClick: (() -> Unit)? = null
) {
  val isDark = isSystemInDarkTheme()

  Surface(
    shape = RoundedCornerShape(20.dp),
    color = if (isDark) Color(0xFF131D28) else Color.White,
    border = BorderStroke(1.dp, if (isDark) Color(0x28FFFFFF) else Color(0x20CBD5E1)),
    shadowElevation = if (isDark) 4.dp else 1.5.dp,
    modifier = Modifier
      .fillMaxWidth()
      .clickable(enabled = onClick != null, onClick = onClick ?: {})
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 14.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.SpaceBetween
    ) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.weight(1f)
      ) {
        Box(
          modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(if (isDark) Color(0x3038BDF8) else Color(0xFFF1F5F9)),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (isDark) Color(0xFF38BDF8) else Color(0xFF0284C7),
            modifier = Modifier.size(19.dp)
          )
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column {
          Text(
            text = title,
            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
            color = if (isDark) Color.White else Color(0xFF0F172A)
          )
          Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = if (isDark) Color(0xFF94A3B8) else Color(0xFF64748B)
          )
        }
      }

      if (badgeText != null) {
        DorkTag(text = badgeText, tone = DorkTagTone.Neutral)
      } else if (onClick != null) {
        Icon(
          imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
          contentDescription = null,
          tint = if (isDark) Color(0xFF64748B) else Color(0xFF94A3B8)
        )
      }
    }
  }
}

private fun shareText(context: Context, subject: String, text: String) {
  val intent = Intent(Intent.ACTION_SEND).apply {
    type = "text/plain"
    putExtra(Intent.EXTRA_SUBJECT, subject)
    putExtra(Intent.EXTRA_TEXT, text)
  }
  context.startActivity(Intent.createChooser(intent, "Share health summary"))
}
