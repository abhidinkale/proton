package health.dork.app.ui.records

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
import androidx.compose.material.icons.rounded.Biotech
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.model.LabStatus
import health.dork.app.core.data.model.LabTestItem
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType
import health.dork.app.core.designsystem.components.DorkTopBar

@Composable
fun RecordDetailScreen(
  record: HealthRecordItem,
  viewModel: RecordsViewModel,
  onBackClick: () -> Unit,
  onViewPrescriptionClick: (() -> Unit)? = null,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = record.title,
      subtitle = record.displayDate,
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      // Header Summary Card
      DorkCard(contentPadding = DorkSpacing.l) {
        Column(modifier = Modifier.fillMaxWidth()) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = record.doctorOrLab,
              style = MaterialTheme.typography.titleMedium,
              color = DorkTheme.colors.textPrimary
            )
            DorkStatusBadge(text = record.type.name, type = DorkStatusType.Info)
          }

          Spacer(modifier = Modifier.height(DorkSpacing.s))

          Text(
            text = record.summary,
            style = MaterialTheme.typography.bodyLarge,
            color = DorkTheme.colors.textPrimary
          )

          Spacer(modifier = Modifier.height(DorkSpacing.m))

          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.Rounded.CalendarToday,
              contentDescription = null,
              tint = DorkTheme.colors.textTertiary,
              modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
              text = "Recorded on ${record.displayDate}",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // If Lab Result, render detailed tests breakdown
      if (record.type == HealthRecordType.LAB_RESULT) {
        Text(
          text = "Laboratory Test Results",
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))

        uiState.labResults.forEach { lab ->
          LabItemCard(lab = lab)
          Spacer(modifier = Modifier.height(DorkSpacing.s))
        }
      }

      // If Prescription, provide quick navigation to prescription detail
      if (record.type == HealthRecordType.PRESCRIPTION && onViewPrescriptionClick != null) {
        DorkButton(
          text = "View full prescription & schedule",
          onClick = onViewPrescriptionClick
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.giant))
    }
  }
}

@Composable
private fun LabItemCard(lab: LabTestItem) {
  val badgeType = when (lab.status) {
    LabStatus.WITHIN_RANGE -> DorkStatusType.Success
    LabStatus.ABOVE_RANGE, LabStatus.BELOW_RANGE -> DorkStatusType.Warning
  }

  DorkCard(contentPadding = DorkSpacing.m) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = lab.testName,
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        DorkStatusBadge(text = lab.status.label, type = badgeType)
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xs))

      // Value & Unit with strong typographic hierarchy
      Row(verticalAlignment = Alignment.Bottom) {
        Text(
          text = lab.value,
          style = MaterialTheme.typography.displayMedium,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
          text = lab.unit,
          style = MaterialTheme.typography.titleSmall,
          color = DorkTheme.colors.textSecondary,
          modifier = Modifier.padding(bottom = 4.dp)
        )
      }

      Spacer(modifier = Modifier.height(4.dp))

      Text(
        text = "Reference range: ${lab.referenceRangeLow} – ${lab.referenceRangeHigh} ${lab.unit}",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary
      )

      if (lab.notes != null) {
        Spacer(modifier = Modifier.height(4.dp))
        Text(
          text = lab.notes,
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    }
  }
}
