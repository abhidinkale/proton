package health.dork.app.ui.profile

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.AddPhotoAlternate
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.DeleteForever
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Emergency
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.LocalHospital
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Medication
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
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
import health.dork.app.core.designsystem.DorkSpacing
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

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
      .verticalScroll(scrollState)
      .padding(horizontal = 20.dp, vertical = 24.dp)
  ) {
    // Top Title & Badges
    // ── Header Title ─────────────────────────────────────────────────────────
    Text(
      text = "Profile & Account",
      style = MaterialTheme.typography.headlineMedium,
      fontWeight = FontWeight.Bold,
      color = DorkTheme.colors.textPrimary
    )

    Spacer(modifier = Modifier.height(18.dp))

    // ── 1. Hero Identity Glass Card ───────────────────────────────────────
    HeroProfileCard(
      profile = profile,
      isDark = isDark,
      onAvatarClick = { showAvatarSheet = true },
      onProfileClick = onNavigateToHealthProfile
    )

    Spacer(modifier = Modifier.height(24.dp))

    // ── 2. Health & Records Section ───────────────────────────────────────
    Text(
      text = "Health & Clinical Records",
      style = MaterialTheme.typography.titleMedium,
      fontWeight = FontWeight.SemiBold,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(10.dp))

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
      style = MaterialTheme.typography.titleMedium,
      fontWeight = FontWeight.SemiBold,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(10.dp))

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
      style = MaterialTheme.typography.titleMedium,
      fontWeight = FontWeight.SemiBold,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(10.dp))

    DorkCard(contentPadding = 16.dp) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Icon(
              imageVector = Icons.Rounded.DarkMode,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
              Text(
                text = "Dark Appearance",
                style = MaterialTheme.typography.titleSmall,
                color = DorkTheme.colors.textPrimary
              )
              Text(
                text = "Deep obsidian & midnight slate theme",
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textSecondary
              )
            }
          }
          Switch(
            checked = uiState.isDarkTheme,
            onCheckedChange = { viewModel.toggleTheme() },
            colors = SwitchDefaults.colors(
              checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
              checkedTrackColor = MaterialTheme.colorScheme.primary
            )
          )
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = DorkTheme.colors.surfaceBorderSubtle)

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Icon(
              imageVector = Icons.Rounded.Medication,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
              Text(
                text = "Medication Dose Prompts",
                style = MaterialTheme.typography.titleSmall,
                color = DorkTheme.colors.textPrimary
              )
              Text(
                text = "On-time notifications for scheduled doses",
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textSecondary
              )
            }
          }
          Switch(
            checked = uiState.notificationRemindersEnabled,
            onCheckedChange = viewModel::toggleNotificationReminders,
            colors = SwitchDefaults.colors(
              checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
              checkedTrackColor = MaterialTheme.colorScheme.primary
            )
          )
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = DorkTheme.colors.surfaceBorderSubtle)

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Icon(
              imageVector = Icons.Rounded.Notifications,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
              Text(
                text = "Clinic Messages",
                style = MaterialTheme.typography.titleSmall,
                color = DorkTheme.colors.textPrimary
              )
              Text(
                text = "Receive direct doctor & care team updates",
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textSecondary
              )
            }
          }
          Switch(
            checked = uiState.notificationDoctorMessagesEnabled,
            onCheckedChange = viewModel::toggleNotificationChat,
            colors = SwitchDefaults.colors(
              checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
              checkedTrackColor = MaterialTheme.colorScheme.primary
            )
          )
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = DorkTheme.colors.surfaceBorderSubtle)

        var keepAliveEnabled by remember {
          mutableStateOf(true)
        }

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Icon(
              imageVector = Icons.Rounded.Shield,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column {
              Text(
                text = "Background Protection",
                style = MaterialTheme.typography.titleSmall,
                color = DorkTheme.colors.textPrimary
              )
              Text(
                text = "Elevates process priority so OS never terminates Dork in background",
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textSecondary
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
              checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
              checkedTrackColor = MaterialTheme.colorScheme.primary
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

    Spacer(modifier = Modifier.height(108.dp))
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
    color = if (isDark) Color(0xFF131F27) else Color(0xFFFFFFFF),
    border = BorderStroke(1.2.dp, if (isDark) Color(0x3338BDF8) else Color(0x20CBD5E1)),
    shadowElevation = if (isDark) 12.dp else 4.dp,
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
              .border(1.5.dp, if (isDark) Color(0xFF131F27) else Color.White, CircleShape),
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

        // Name & Age / Sex
        Column(modifier = Modifier.weight(1f)) {
          Text(
            text = profile.fullName,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = DorkTheme.colors.textPrimary
          )

          Spacer(modifier = Modifier.height(4.dp))

          Text(
            text = "${profile.calculatedAge} yrs · ${profile.sex.name.lowercase().replaceFirstChar { it.uppercase() }}",
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textSecondary
          )
        }

        Icon(
          imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
          contentDescription = null,
          tint = DorkTheme.colors.textTertiary
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
    color = if (isDark) Color(0xFF131F27) else Color(0xFFFFFFFF),
    border = BorderStroke(1.dp, if (isDark) Color(0x28FFFFFF) else Color(0x25CBD5E1)),
    modifier = modifier.clickable(onClick = onClick)
  ) {
    Column(modifier = Modifier.padding(12.dp)) {
      Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = DorkTheme.colors.textSecondary,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )

      Spacer(modifier = Modifier.height(4.dp))

      Row(verticalAlignment = Alignment.Bottom) {
        Text(
          text = value,
          style = MaterialTheme.typography.titleLarge,
          fontWeight = FontWeight.Bold,
          color = accentColor
        )
        Spacer(modifier = Modifier.width(3.dp))
        Text(
          text = unit,
          style = MaterialTheme.typography.labelSmall,
          color = DorkTheme.colors.textSecondary,
          modifier = Modifier.padding(bottom = 2.dp)
        )
      }

      Spacer(modifier = Modifier.height(2.dp))

      Text(
        text = subtext,
        style = MaterialTheme.typography.bodySmall,
        fontSize = 11.sp,
        color = DorkTheme.colors.textTertiary,
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
  DorkCard(
    contentPadding = 14.dp,
    shape = DorkShapes.large,
    onClick = onClick ?: {}
  ) {
    Row(
      modifier = Modifier.fillMaxWidth(),
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
            .background(DorkTheme.colors.surfaceSecondary),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(18.dp)
          )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column {
          Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }

      if (badgeText != null) {
        DorkTag(text = badgeText, tone = DorkTagTone.Neutral)
      } else if (onClick != null) {
        Icon(
          imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
          contentDescription = null,
          tint = DorkTheme.colors.textTertiary
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
