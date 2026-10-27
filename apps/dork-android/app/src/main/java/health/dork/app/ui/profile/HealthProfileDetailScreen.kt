package health.dork.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar

@Composable
fun HealthProfileDetailScreen(
  viewModel: ProfileViewModel,
  onBackClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val profile = uiState.profile ?: return
  val scrollState = rememberScrollState()

  var editingMetrics by remember { mutableStateOf(false) }
  var heightInput by remember(profile.heightCm) {
    mutableStateOf(if (profile.heightCm > 0) profile.heightCm.toString() else "")
  }
  var weightInput by remember(profile.weightKg) {
    mutableStateOf(if (profile.weightKg > 0) profile.weightKg.toString() else "")
  }

  var editingContact by remember { mutableStateOf(false) }
  var contactName by remember(profile.emergencyContact?.name) {
    mutableStateOf(profile.emergencyContact?.name.orEmpty())
  }
  var contactRelation by remember(profile.emergencyContact?.relationship) {
    mutableStateOf(profile.emergencyContact?.relationship.orEmpty())
  }
  var contactPhone by remember(profile.emergencyContact?.phoneNumber) {
    mutableStateOf(profile.emergencyContact?.phoneNumber.orEmpty())
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "My Health Profile",
      subtitle = "${profile.completionPercentage}% Complete",
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      // 1. PERSONAL DEMOGRAPHICS
      ProfileSectionHeader("PERSONAL DEMOGRAPHICS")
      DorkCard(contentPadding = DorkSpacing.m) {
        Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
          ProfileKeyValue("Legal name", profile.fullName)
          ProfileKeyValue("Authoritative DOB", "${profile.formattedBirthDate} (${profile.calculatedAge} years)")
          ProfileKeyValue("Biological sex", profile.sex.displayName)
          ProfileKeyValue("Blood group", profile.bloodGroup.display)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // 2. BODY METRICS
      ProfileSectionHeader("BODY METRICS")
      DorkCard(contentPadding = DorkSpacing.m) {
        Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
          if (editingMetrics) {
            DorkTextField(
              value = heightInput,
              onValueChange = { heightInput = it },
              label = "Height (cm)",
              placeholder = "e.g. 172"
            )
            DorkTextField(
              value = weightInput,
              onValueChange = { weightInput = it },
              label = "Weight (kg)",
              placeholder = "e.g. 68.5"
            )
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
            ) {
              DorkButton(
                text = "Save",
                onClick = {
                  val height = heightInput.toDoubleOrNull()
                  val weight = weightInput.toDoubleOrNull()
                  if (height != null && weight != null && height > 0 && weight > 0) {
                    viewModel.updateBodyMetrics(height, weight)
                    editingMetrics = false
                  }
                },
                variant = DorkButtonVariant.Primary,
                fullWidth = false
              )
              DorkButton(
                text = "Cancel",
                onClick = { editingMetrics = false },
                variant = DorkButtonVariant.Ghost,
                fullWidth = false
              )
            }
          } else {
            ProfileKeyValue("Height", if (profile.heightCm > 0) "${profile.heightCm} cm" else "Not recorded")
            ProfileKeyValue("Weight", if (profile.weightKg > 0) "${profile.weightKg} kg" else "Not recorded")
            ProfileKeyValue("Body Mass Index (BMI)", "${profile.bmi ?: "--"} (${profile.bmiCategory})")
            DorkButton(
              text = "Edit body metrics",
              onClick = { editingMetrics = true },
              variant = DorkButtonVariant.Secondary
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // 3. CLINICAL CONDITIONS & ALLERGIES
      ProfileSectionHeader("CONDITIONS & ALLERGIES")
      DorkCard(contentPadding = DorkSpacing.m) {
        Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
          ProfileKeyValue("Diagnosed conditions", profile.conditions.joinToString(", ").ifEmpty { "None recorded" })
          ProfileKeyValue("Known allergies", profile.allergies.joinToString(", ").ifEmpty { "None recorded" })
          ProfileKeyValue("Surgical history", profile.surgeries.joinToString(", ").ifEmpty { "None" })
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // 4. LIFESTYLE & HABITS
      ProfileSectionHeader("LIFESTYLE & ACTIVITY")
      DorkCard(contentPadding = DorkSpacing.m) {
        Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
          ProfileKeyValue("Physical activity", profile.lifestyleActivity)
          ProfileKeyValue("Smoking status", profile.lifestyleSmoking)
          ProfileKeyValue("Alcohol intake", profile.lifestyleAlcohol)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // 5. EMERGENCY CONTACT
      ProfileSectionHeader("EMERGENCY CONTACT")
      DorkCard(contentPadding = DorkSpacing.m) {
        Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
          if (editingContact) {
            DorkTextField(
              value = contactName,
              onValueChange = { contactName = it },
              label = "Contact name",
              placeholder = "Full name"
            )
            DorkTextField(
              value = contactRelation,
              onValueChange = { contactRelation = it },
              label = "Relationship",
              placeholder = "e.g. Spouse"
            )
            DorkTextField(
              value = contactPhone,
              onValueChange = { contactPhone = it },
              label = "Phone number",
              placeholder = "+1 555 000 0000"
            )
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
            ) {
              DorkButton(
                text = "Save",
                onClick = {
                  if (contactName.isNotBlank() && contactPhone.isNotBlank()) {
                    viewModel.updateEmergencyContact(
                      name = contactName,
                      relationship = contactRelation,
                      phone = contactPhone
                    )
                    editingContact = false
                  }
                },
                variant = DorkButtonVariant.Primary,
                fullWidth = false
              )
              DorkButton(
                text = "Cancel",
                onClick = { editingContact = false },
                variant = DorkButtonVariant.Ghost,
                fullWidth = false
              )
            }
          } else {
            ProfileKeyValue("Contact name", profile.emergencyContact?.name ?: "Not specified")
            ProfileKeyValue("Relationship", profile.emergencyContact?.relationship ?: "Not specified")
            ProfileKeyValue("Emergency phone", profile.emergencyContact?.phoneNumber ?: "Not specified")
            DorkButton(
              text = "Edit emergency contact",
              onClick = { editingContact = true },
              variant = DorkButtonVariant.Secondary
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.giant))
    }
  }
}

@Composable
private fun ProfileSectionHeader(text: String) {
  Text(
    text = text,
    style = MaterialTheme.typography.labelMedium,
    color = DorkTheme.colors.textSecondary,
    modifier = Modifier.padding(bottom = DorkSpacing.xs, start = 4.dp)
  )
}

@Composable
private fun ProfileKeyValue(key: String, value: String) {
  Row(
    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
    horizontalArrangement = Arrangement.SpaceBetween
  ) {
    Text(text = key, style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textSecondary)
    Text(text = value, style = MaterialTheme.typography.bodyMedium, color = DorkTheme.colors.textPrimary)
  }
}
