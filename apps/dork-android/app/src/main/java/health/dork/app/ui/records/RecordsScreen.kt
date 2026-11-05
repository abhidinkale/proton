package health.dork.app.ui.records

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Biotech
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.FolderShared
import androidx.compose.material.icons.rounded.Medication
import androidx.compose.material.icons.rounded.MedicalServices
import androidx.compose.material.icons.rounded.Upload
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkStatusType
import health.dork.app.core.designsystem.components.DorkTimelineItem
import health.dork.app.core.designsystem.components.EhrConnectTile
import health.dork.app.core.designsystem.components.EhrProviderPickerDialog
import health.dork.app.core.designsystem.components.UploadHealthRecordsTile
import health.dork.app.core.sync.EhrSyncClient
import health.dork.app.core.sync.SyncSettings

@Composable
fun RecordsScreen(
  viewModel: RecordsViewModel,
  onRecordClick: (HealthRecordItem) -> Unit,
  onUploadClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()
  val catScrollState = rememberScrollState()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    // Top Bar & Upload Action
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.l),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Column(modifier = Modifier.weight(1f)) {
        Text(
          text = "Records",
          style = MaterialTheme.typography.displayMedium,
          color = DorkTheme.colors.textPrimary
        )
        Text(
          text = "Your longitudinal health journey",
          style = MaterialTheme.typography.bodyMedium,
          color = DorkTheme.colors.textSecondary
        )
      }

      DorkButton(
        text = "Upload",
        onClick = onUploadClick,
        variant = DorkButtonVariant.Secondary,
        fullWidth = false,
        leadingIcon = {
          Icon(
            imageVector = Icons.Rounded.Upload,
            contentDescription = null,
            tint = DorkTheme.colors.textPrimary,
            modifier = Modifier.size(16.dp)
          )
        }
      )
    }

    // Category Filter Chips
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .horizontalScroll(catScrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.xs),
      horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
    ) {
      viewModel.categories.forEach { cat ->
        DorkChip(
          label = cat,
          selected = uiState.selectedCategory == cat,
          onClick = { viewModel.onCategorySelected(cat) }
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.s))

    // Timeline Scroll
    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(vertical = DorkSpacing.m)
    ) {
      EhrConnectTile(
        isSyncing = uiState.isEhrSyncing,
        lastStatus = uiState.ehrImportStatus,
        onConnectClick = { viewModel.openEhrPicker() },
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = DorkSpacing.screenHorizontalPadding)
      )

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      UploadHealthRecordsTile(
        existingFilesCount = uiState.documents.size,
        onAddFileClick = onUploadClick,
        onViewRecordsClick = onUploadClick,
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = DorkSpacing.screenHorizontalPadding)
      )

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      val records = uiState.filteredTimeline
      records.forEachIndexed { index, record ->
        val icon = getIconForRecordType(record.type)
        val badgeType = when (record.type) {
          HealthRecordType.PRESCRIPTION -> DorkStatusType.Info
          HealthRecordType.LAB_RESULT -> DorkStatusType.Success
          HealthRecordType.CONSULTATION -> DorkStatusType.Neutral
          else -> DorkStatusType.Neutral
        }

        DorkTimelineItem(
          dateString = record.displayDate,
          title = record.title,
          subtitle = "${record.doctorOrLab} · ${record.subtitle}",
          icon = icon,
          badgeText = record.type.name.replace("_", " "),
          badgeType = badgeType,
          isLast = index == records.lastIndex,
          onClick = {
            viewModel.onRecordSelected(record)
            onRecordClick(record)
          }
        )
      }

    if (records.isEmpty()) {
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.xl),
        contentAlignment = Alignment.Center
      ) {
        Text(
          text = "No records in this category yet.",
          style = MaterialTheme.typography.bodyMedium,
          color = DorkTheme.colors.textSecondary
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.giant))
    }
  }

  if (uiState.showEhrPicker) {
    EhrProviderPickerDialog(
      providers = EhrSyncClient(SyncSettings()).defaultProviders,
      onSelectProvider = { providerId ->
        viewModel.importFromEhr(providerId)
      },
      onDismiss = { viewModel.dismissEhrPicker() }
    )
  }
}

private fun getIconForRecordType(type: HealthRecordType): ImageVector {
  return when (type) {
    HealthRecordType.CONSULTATION -> Icons.Rounded.MedicalServices
    HealthRecordType.LAB_RESULT -> Icons.Rounded.Biotech
    HealthRecordType.PRESCRIPTION -> Icons.Rounded.Medication
    HealthRecordType.DOCUMENT -> Icons.Rounded.Description
    HealthRecordType.DIAGNOSTIC_REPORT -> Icons.Rounded.FolderShared
    HealthRecordType.OBSERVATION -> Icons.Rounded.Biotech
  }
}
