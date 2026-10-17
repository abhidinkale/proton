package health.dork.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Emergency
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Group
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Logout
import androidx.compose.material.icons.rounded.Medication
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Watch
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType

@Composable
fun ProfileScreen(
  viewModel: ProfileViewModel,
  onNavigateToHealthProfile: () -> Unit,
  onNavigateToMedicalId: () -> Unit,
  onNavigateToMedications: () -> Unit,
  onNavigateToDocuments: () -> Unit,
  onLogout: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val profile = uiState.profile ?: return
  val scrollState = rememberScrollState()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
      .verticalScroll(scrollState)
      .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l)
  ) {
    Text(
      text = "Profile & Settings",
      style = MaterialTheme.typography.displayMedium,
      color = DorkTheme.colors.textPrimary
    )

    Spacer(modifier = Modifier.height(DorkSpacing.m))

    // Profile Summary & Completion Card (Section 13)
    DorkCard(
      contentPadding = DorkSpacing.m,
      onClick = onNavigateToHealthProfile
    ) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Box(
            modifier = Modifier
              .size(56.dp)
              .clip(CircleShape)
              .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
          ) {
            Text(
              text = profile.fullName.take(1),
              style = MaterialTheme.typography.headlineMedium,
              color = MaterialTheme.colorScheme.primary
            )
          }

          Spacer(modifier = Modifier.width(DorkSpacing.m))

          Column(modifier = Modifier.weight(1f)) {
            Text(
              text = profile.fullName,
              style = MaterialTheme.typography.titleLarge,
              color = DorkTheme.colors.textPrimary
            )
            Text(
              text = "DOB: ${profile.formattedBirthDate} (${profile.calculatedAge} yrs) · Blood: ${profile.bloodGroup.display}",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }

          Icon(
            imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
            contentDescription = null,
            tint = DorkTheme.colors.textTertiary
          )
        }

        Spacer(modifier = Modifier.height(DorkSpacing.m))

        // Profile Completion Bar
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = "Health profile completion",
            style = MaterialTheme.typography.labelSmall,
            color = DorkTheme.colors.textSecondary
          )
          Text(
            text = "${profile.completionPercentage}%",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary
          )
        }

        Spacer(modifier = Modifier.height(4.dp))

        LinearProgressIndicator(
          progress = { profile.completionPercentage / 100f },
          modifier = Modifier.fillMaxWidth().height(4.dp),
          color = MaterialTheme.colorScheme.primary,
          trackColor = DorkTheme.colors.surfaceBorderSubtle
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    // Emergency Medical ID Banner (Section 36)
    DorkCard(
      contentPadding = DorkSpacing.m,
      backgroundColor = DorkTheme.colors.criticalContainer,
      borderColor = DorkTheme.colors.critical,
      onClick = onNavigateToMedicalId
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
          Icon(
            imageVector = Icons.Rounded.Emergency,
            contentDescription = null,
            tint = DorkTheme.colors.critical,
            modifier = Modifier.size(28.dp)
          )
          Spacer(modifier = Modifier.width(DorkSpacing.s))
          Column {
            Text(
              text = "Emergency Medical ID",
              style = MaterialTheme.typography.titleMedium,
              color = DorkTheme.colors.critical
            )
            Text(
              text = "Quick access for first responders & emergency contacts",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textPrimary
            )
          }
        }

        Icon(
          imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
          contentDescription = null,
          tint = DorkTheme.colors.critical
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    // HEALTH & RECORDS SECTION
    Text(
      text = "Health & Records",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.s))

    Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
      SettingsRow(title = "My Health Profile", subtitle = "Vitals, conditions, allergies & history", icon = Icons.Rounded.Person, onClick = onNavigateToHealthProfile)
      SettingsRow(title = "My Medications", subtitle = "Current schedules & reminders", icon = Icons.Rounded.Medication, onClick = onNavigateToMedications)
      SettingsRow(title = "My Documents", subtitle = "Uploaded lab reports & discharge notes", icon = Icons.Rounded.Description, onClick = onNavigateToDocuments)
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    // ECOSYSTEM PREVIEW (Section 38 & 39)
    Text(
      text = "Ecosystem Integration",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.s))

    Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
      SettingsRow(
        title = "Family & Dependents",
        subtitle = "Architecture ready with isolated clinical boundaries",
        icon = Icons.Rounded.Group,
        badgeText = "Preview"
      )
      SettingsRow(
        title = "Android Health Connect",
        subtitle = "Wearables, steps, sleep, and heart biometrics",
        icon = Icons.Rounded.Watch,
        badgeText = "Connected"
      )
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    // PREFERENCES & SECURITY
    Text(
      text = "Preferences & Security",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textSecondary
    )
    Spacer(modifier = Modifier.height(DorkSpacing.s))

    DorkCard(contentPadding = DorkSpacing.m) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column {
            Text(text = "Medication reminders", style = MaterialTheme.typography.titleSmall, color = DorkTheme.colors.textPrimary)
            Text(text = "Push alerts when a dose is due", style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.textSecondary)
          }
          Switch(
            checked = uiState.notificationRemindersEnabled,
            onCheckedChange = viewModel::toggleNotificationReminders,
            colors = SwitchDefaults.colors(checkedThumbColor = MaterialTheme.colorScheme.onPrimary, checkedTrackColor = MaterialTheme.colorScheme.primary)
          )
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = DorkSpacing.s), color = DorkTheme.colors.surfaceBorderSubtle)

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column {
            Text(text = "Synthetic Demo Mode", style = MaterialTheme.typography.titleSmall, color = DorkTheme.colors.textPrimary)
            Text(text = "Use synthetic patient data (Alex Morgan)", style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.textSecondary)
          }
          Switch(
            checked = uiState.isDemoMode,
            onCheckedChange = viewModel::toggleDemoMode,
            colors = SwitchDefaults.colors(checkedThumbColor = MaterialTheme.colorScheme.onPrimary, checkedTrackColor = MaterialTheme.colorScheme.primary)
          )
        }
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkButton(
      text = "Sign out",
      onClick = {
        viewModel.logout()
        onLogout()
      },
      variant = DorkButtonVariant.Secondary,
      leadingIcon = {
        Icon(imageVector = Icons.AutoMirrored.Rounded.Logout, contentDescription = null, modifier = Modifier.size(16.dp))
      }
    )

    Spacer(modifier = Modifier.height(DorkSpacing.xxl))
  }
}

@Composable
private fun SettingsRow(
  title: String,
  subtitle: String,
  icon: ImageVector,
  modifier: Modifier = Modifier,
  badgeText: String? = null,
  onClick: (() -> Unit)? = null
) {
  DorkCard(
    modifier = modifier,
    contentPadding = DorkSpacing.m,
    onClick = onClick
  ) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Icon(imageVector = icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
      Spacer(modifier = Modifier.width(DorkSpacing.m))
      Column(modifier = Modifier.weight(1f)) {
        Text(text = title, style = MaterialTheme.typography.titleSmall, color = DorkTheme.colors.textPrimary)
        Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.textSecondary)
      }
      if (badgeText != null) {
        DorkStatusBadge(text = badgeText, type = DorkStatusType.Neutral)
      } else {
        Icon(imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight, contentDescription = null, tint = DorkTheme.colors.textTertiary)
      }
    }
  }
}
