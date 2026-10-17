package health.dork.app.ui.records

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.LocalPharmacy
import androidx.compose.material.icons.rounded.Medication
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.PrescriptionDetail
import health.dork.app.core.data.model.PrescriptionMedicineItem
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType
import health.dork.app.core.designsystem.components.DorkTopBar

@Composable
fun PrescriptionDetailScreen(
  viewModel: RecordsViewModel,
  onBackClick: () -> Unit,
  onNavigateToMedications: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val rx = uiState.activePrescription ?: return
  val scrollState = rememberScrollState()
  var isAddedToSchedule by remember { mutableStateOf(false) }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Prescription",
      subtitle = rx.doctorName,
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      // Clinical Issuer Card
      DorkCard(contentPadding = DorkSpacing.m) {
        Column(modifier = Modifier.fillMaxWidth()) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Column {
              Text(
                text = rx.doctorName,
                style = MaterialTheme.typography.titleMedium,
                color = DorkTheme.colors.textPrimary
              )
              Text(
                text = rx.clinicName,
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textSecondary
              )
            }
            DorkStatusBadge(text = "Active Rx", type = DorkStatusType.Success)
          }

          Spacer(modifier = Modifier.height(DorkSpacing.s))

          Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
              imageVector = Icons.Rounded.CalendarToday,
              contentDescription = null,
              tint = DorkTheme.colors.textTertiary,
              modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
              text = "Issued on ${rx.dateIssued}",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }

          Spacer(modifier = Modifier.height(DorkSpacing.xs))

          Text(
            text = "Diagnosis: ${rx.diagnosisReason}",
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textPrimary
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      // Prescribed Medicines
      Text(
        text = "Prescribed Medicines",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.s))

      rx.medications.forEach { med ->
        MedicineItemCard(med = med)
        Spacer(modifier = Modifier.height(DorkSpacing.s))
      }

      // Clinical Instructions
      rx.clinicalNotes?.let { notes ->
        Spacer(modifier = Modifier.height(DorkSpacing.m))
        DorkCard(contentPadding = DorkSpacing.m) {
          Column {
            Text(
              text = "Doctor's instructions",
              style = MaterialTheme.typography.titleSmall,
              color = DorkTheme.colors.textPrimary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
              text = notes,
              style = MaterialTheme.typography.bodyMedium,
              color = DorkTheme.colors.textSecondary
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      // Action: Add to medication schedule
      if (!isAddedToSchedule) {
        DorkButton(
          text = "Add to medication schedule",
          onClick = {
            viewModel.addPrescriptionToMedicationSchedule(rx) {
              isAddedToSchedule = true
            }
          },
          variant = DorkButtonVariant.Primary
        )
      } else {
        DorkCard(
          backgroundColor = DorkTheme.colors.successContainer,
          borderColor = DorkTheme.colors.success
        ) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
          ) {
            Icon(
              imageVector = Icons.Rounded.CheckCircle,
              contentDescription = null,
              tint = DorkTheme.colors.success,
              modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(DorkSpacing.s))
            Text(
              text = "Added to medication schedule",
              style = MaterialTheme.typography.titleSmall,
              color = DorkTheme.colors.success
            )
          }
        }
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        DorkButton(
          text = "Go to medication schedule",
          onClick = onNavigateToMedications,
          variant = DorkButtonVariant.Secondary
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.giant))
    }
  }
}

@Composable
private fun MedicineItemCard(med: PrescriptionMedicineItem) {
  DorkCard(contentPadding = DorkSpacing.m) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = med.name,
          style = MaterialTheme.typography.titleMedium,
          color = DorkTheme.colors.textPrimary
        )
        DorkStatusBadge(text = med.route, type = DorkStatusType.Neutral)
      }

      Spacer(modifier = Modifier.height(4.dp))

      Text(
        text = "${med.dose} · ${med.frequency}",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.primary
      )

      Text(
        text = "Duration: ${med.duration} · Refills: ${med.refillsAllowed}",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textSecondary
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xs))

      Text(
        text = med.instructions,
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary
      )
    }
  }
}
