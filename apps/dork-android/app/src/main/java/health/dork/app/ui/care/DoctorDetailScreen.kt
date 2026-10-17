package health.dork.app.ui.care

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
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Work
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTopBar

@Composable
fun DoctorDetailScreen(
  doctor: Doctor,
  onBackClick: () -> Unit,
  onBookClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val scrollState = rememberScrollState()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = doctor.name,
      subtitle = doctor.specialty,
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      // Profile Avatar and Identity
      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        val initials = doctor.name.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString("")
        Box(
          modifier = Modifier
            .size(72.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer),
          contentAlignment = Alignment.Center
        ) {
          Text(
            text = initials,
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.primary
          )
        }

        Spacer(modifier = Modifier.width(DorkSpacing.m))

        Column {
          Text(
            text = doctor.name,
            style = MaterialTheme.typography.headlineMedium,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = doctor.specialty,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
          )
          Text(
            text = doctor.qualifications,
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // Experience & Rating stats row
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
      ) {
        StatBox(
          label = "Experience",
          value = "${doctor.experienceYears}+ years",
          icon = Icons.Rounded.Work,
          modifier = Modifier.weight(1f)
        )
        StatBox(
          label = "Rating",
          value = "${doctor.rating} ★",
          icon = Icons.Rounded.Star,
          modifier = Modifier.weight(1f)
        )
        StatBox(
          label = "Distance",
          value = doctor.distanceKm,
          icon = Icons.Rounded.LocationOn,
          modifier = Modifier.weight(1f)
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // About Section
      Text(
        text = "About",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Text(
        text = doctor.aboutBio,
        style = MaterialTheme.typography.bodyMedium,
        color = DorkTheme.colors.textSecondary
      )

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // Clinic and Location
      Text(
        text = "Practice Location",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      DorkCard(contentPadding = DorkSpacing.m) {
        Column {
          Text(
            text = doctor.clinicName,
            style = MaterialTheme.typography.titleSmall,
            color = DorkTheme.colors.textPrimary
          )
          Text(
            text = doctor.clinicAddress,
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
          Text(
            text = "Languages: ${doctor.languages.joinToString()}",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textTertiary,
            modifier = Modifier.padding(top = 4.dp)
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // Available slots preview
      Text(
        text = "Next available slots",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Row(
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
      ) {
        doctor.availableSlots.take(2).forEach { slot ->
          DorkChip(label = slot, selected = false, onClick = onBookClick)
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      DorkButton(
        text = "Book appointment",
        onClick = onBookClick,
        variant = DorkButtonVariant.Primary
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

@Composable
private fun StatBox(
  label: String,
  value: String,
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  modifier: Modifier = Modifier
) {
  DorkCard(
    modifier = modifier,
    contentPadding = DorkSpacing.s
  ) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
      Icon(imageVector = icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
      Spacer(modifier = Modifier.height(4.dp))
      Text(text = value, style = MaterialTheme.typography.titleSmall, color = DorkTheme.colors.textPrimary)
      Text(text = label, style = MaterialTheme.typography.labelSmall, color = DorkTheme.colors.textTertiary)
    }
  }
}
