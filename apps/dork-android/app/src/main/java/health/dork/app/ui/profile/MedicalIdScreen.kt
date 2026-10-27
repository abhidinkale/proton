package health.dork.app.ui.profile

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.Emergency
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType
import health.dork.app.core.designsystem.components.DorkTopBar
import health.dork.app.core.data.model.EmergencyMedicalId
import health.dork.app.core.data.util.DateCalculators

@Composable
fun MedicalIdScreen(
  viewModel: ProfileViewModel,
  onBackClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val medId = uiState.medicalId ?: return
  val context = LocalContext.current
  val scrollState = rememberScrollState()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Medical ID",
      subtitle = "Emergency First Responder Access",
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      // High-contrast Emergency Badge Card (Section 36)
      DorkCard(
        contentPadding = DorkSpacing.l,
        backgroundColor = DorkTheme.colors.criticalContainer,
        borderColor = DorkTheme.colors.critical
      ) {
        Column(modifier = Modifier.fillMaxWidth()) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
          ) {
            Box(
              modifier = Modifier
                .size(54.dp)
                .clip(CircleShape)
                .background(DorkTheme.colors.critical),
              contentAlignment = Alignment.Center
            ) {
              Icon(
                imageVector = Icons.Rounded.Emergency,
                contentDescription = null,
                tint = androidx.compose.ui.graphics.Color.White,
                modifier = Modifier.size(32.dp)
              )
            }

            Spacer(modifier = Modifier.width(DorkSpacing.m))

            Column {
              Text(
                text = medId.patientName,
                style = MaterialTheme.typography.headlineMedium,
                color = DorkTheme.colors.critical
              )
              Text(
                text = "DOB: ${DateCalculators.formatDisplayDate(medId.birthDate)} (${medId.calculatedAge} yrs) · Blood: ${medId.bloodGroup}",
                style = MaterialTheme.typography.titleSmall,
                color = DorkTheme.colors.textPrimary
              )
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // Critical Conditions
      MedicalIdSection("CRITICAL CONDITIONS") {
        medId.criticalConditions.forEach { condition ->
          Text(text = "• $condition", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textPrimary)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      // Severe Allergies
      MedicalIdSection("SEVERE ALLERGIES & REACTIONS") {
        medId.severeAllergies.forEach { allergy ->
          Text(text = "• $allergy", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.critical)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      // Active Medications
      MedicalIdSection("ACTIVE MEDICATIONS") {
        medId.activeMedications.forEach { med ->
          Text(text = "• $med", style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textPrimary)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      // Emergency Contact
      DorkCard(contentPadding = DorkSpacing.m) {
        Column(modifier = Modifier.fillMaxWidth()) {
          Text(
            text = "EMERGENCY CONTACT",
            style = MaterialTheme.typography.labelSmall,
            color = DorkTheme.colors.textSecondary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          Text(
            text = "${medId.emergencyContactName} (${medId.emergencyContactRelation})",
            style = MaterialTheme.typography.titleMedium,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = medId.emergencyContactPhone,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.primary
          )

          Spacer(modifier = Modifier.height(DorkSpacing.m))

          DorkButton(
            text = "Call Emergency Contact",
            onClick = {
              val intent = Intent(Intent.ACTION_DIAL).apply {
                data = Uri.parse("tel:${medId.emergencyContactPhone}")
              }
              context.startActivity(intent)
            },
            variant = DorkButtonVariant.Primary,
            leadingIcon = {
              Icon(imageVector = Icons.Rounded.Call, contentDescription = null, modifier = Modifier.size(16.dp))
            }
          )

          Spacer(modifier = Modifier.height(DorkSpacing.s))

          DorkButton(
            text = "Share Medical ID",
            onClick = {
              val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, "Medical ID — ${medId.patientName}")
                putExtra(Intent.EXTRA_TEXT, buildMedicalIdText(medId))
              }
              context.startActivity(Intent.createChooser(shareIntent, "Share Medical ID"))
            },
            variant = DorkButtonVariant.Secondary,
            leadingIcon = {
              Icon(imageVector = Icons.Rounded.Share, contentDescription = null, modifier = Modifier.size(16.dp))
            }
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      DorkCard(contentPadding = DorkSpacing.m) {
        Column(modifier = Modifier.fillMaxWidth()) {
          Text(
            text = "EMERGENCY PREFERENCES",
            style = MaterialTheme.typography.labelSmall,
            color = DorkTheme.colors.textSecondary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          Text(
            text = "Organ donor: ${medId.organDonorStatus}",
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = "Preferred hospital: ${medId.hospitalPreference}",
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textPrimary
          )
          Spacer(modifier = Modifier.height(DorkSpacing.xs))
          Text(
            text = "Maintained by the patient on this device. Not a clinician-verified record.",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textTertiary
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.giant))
    }
  }
}

@Composable
private fun MedicalIdSection(title: String, content: @Composable () -> Unit) {
  DorkCard(contentPadding = DorkSpacing.m) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Text(
        text = title,
        style = MaterialTheme.typography.labelSmall,
        color = DorkTheme.colors.textSecondary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      content()
    }
  }
}

private fun buildMedicalIdText(medId: EmergencyMedicalId): String = buildString {
  appendLine("EMERGENCY MEDICAL ID")
  appendLine("Name: ${medId.patientName}")
  appendLine("Date of birth: ${DateCalculators.formatDisplayDate(medId.birthDate)} (${medId.calculatedAge} years)")
  appendLine("Blood group: ${medId.bloodGroup}")
  appendLine()
  appendLine("Critical conditions:")
  appendLine(medId.criticalConditions.joinToString("\n") { "• $it" })
  appendLine()
  appendLine("Severe allergies:")
  appendLine(medId.severeAllergies.joinToString("\n") { "• $it" })
  appendLine()
  appendLine("Active medications:")
  appendLine(medId.activeMedications.joinToString("\n") { "• $it" })
  appendLine()
  appendLine("Emergency contact: ${medId.emergencyContactName} (${medId.emergencyContactRelation})")
  appendLine(medId.emergencyContactPhone)
  appendLine("Organ donor: ${medId.organDonorStatus}")
  appendLine("Preferred hospital: ${medId.hospitalPreference}")
  appendLine()
  appendLine("Patient-maintained on a personal device. Not a clinician-verified record.")
}
