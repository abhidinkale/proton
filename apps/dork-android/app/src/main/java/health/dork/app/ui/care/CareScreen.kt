package health.dork.app.ui.care

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.SearchOff
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkDoctorCard
import health.dork.app.core.designsystem.components.DorkEmptyState
import health.dork.app.core.designsystem.components.DorkSearchBar

@Composable
fun CareScreen(
  viewModel: CareViewModel,
  onDoctorClick: (Doctor) -> Unit,
  onBookClick: (Doctor) -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()
  val specialtyScrollState = rememberScrollState()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    // Header
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l)
    ) {
      Text(
        text = "Find healthcare",
        style = MaterialTheme.typography.displayMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Text(
        text = "Book consultations with verified clinicians and specialists",
        style = MaterialTheme.typography.bodyMedium,
        color = DorkTheme.colors.textSecondary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.m))

      // Search Bar
      DorkSearchBar(
        query = uiState.searchQuery,
        onQueryChange = viewModel::onSearchQueryChange,
        placeholder = "Doctor, specialty or condition"
      )
    }

    // Specialty category chips
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .horizontalScroll(specialtyScrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.xs),
      horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
    ) {
      viewModel.specialties.forEach { specialty ->
        DorkChip(
          label = specialty,
          selected = uiState.selectedSpecialty == specialty,
          onClick = { viewModel.onSpecialtySelected(specialty) }
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.s))

    // Doctor List
    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.s),
      verticalArrangement = Arrangement.spacedBy(DorkSpacing.m)
    ) {
      if (uiState.filteredDoctors.isEmpty()) {
        DorkEmptyState(
          title = "No doctors found",
          description = "Try searching for a different condition, specialty, or physician name.",
          icon = Icons.Rounded.SearchOff,
          actionText = "Show all doctors",
          onActionClick = {
            viewModel.onSearchQueryChange("")
            viewModel.onSpecialtySelected("All Specialties")
          }
        )
      } else {
        uiState.filteredDoctors.forEach { doc ->
          DorkDoctorCard(
            name = doc.name,
            specialty = doc.specialty,
            qualifications = doc.qualifications,
            clinicName = doc.clinicName,
            distance = doc.distanceKm,
            availabilityText = "Available today",
            rating = doc.rating,
            reviewCount = doc.reviewCount,
            onProfileClick = {
              viewModel.onDoctorSelected(doc)
              onDoctorClick(doc)
            },
            onBookClick = {
              viewModel.onDoctorSelected(doc)
              onBookClick(doc)
            }
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}
