package health.dork.app.core.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.LocalHospital
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.sync.EhrProvider

@Composable
fun EhrProviderPickerDialog(
  providers: List<EhrProvider>,
  onSelectProvider: (String) -> Unit,
  onDismiss: () -> Unit
) {
  Dialog(onDismissRequest = onDismiss) {
    Surface(
      shape = RoundedCornerShape(28.dp),
      color = Color.White,
      modifier = Modifier
        .fillMaxWidth()
        .padding(vertical = 16.dp)
    ) {
      Column(
        modifier = Modifier
          .padding(24.dp)
          .verticalScroll(rememberScrollState())
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column {
            Text(
              text = "Select Health Network",
              style = MaterialTheme.typography.titleLarge.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                letterSpacing = (-0.3).sp
              ),
              color = Color(0xFF0F172A)
            )
            Text(
              text = "SMART on FHIR Patient Access",
              style = MaterialTheme.typography.labelSmall.copy(
                color = Color(0xFF64748B),
                fontSize = 12.sp
              )
            )
          }

          IconButton(onClick = onDismiss) {
            Icon(
              imageVector = Icons.Rounded.Close,
              contentDescription = "Close",
              tint = Color(0xFF64748B)
            )
          }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
          text = "Connect directly with your patient portal credentials. Federal law protects your right to export your medical records into Proton for free.",
          style = MaterialTheme.typography.bodySmall.copy(
            color = Color(0xFF475569),
            lineHeight = 18.sp
          )
        )

        Spacer(modifier = Modifier.height(20.dp))

        providers.forEach { provider ->
          Box(
            modifier = Modifier
              .fillMaxWidth()
              .clip(RoundedCornerShape(16.dp))
              .background(Color(0xFFF8FAFC))
              .border(BorderStroke(1.dp, Color(0xFFE2E8F0)), RoundedCornerShape(16.dp))
              .clickable { onSelectProvider(provider.id) }
              .padding(14.dp)
          ) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
              Box(
                modifier = Modifier
                  .size(40.dp)
                  .clip(CircleShape)
                  .background(if (provider.isSandbox) Color(0xFF0D9488) else Color(0xFF0284C7)),
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  imageVector = Icons.Rounded.LocalHospital,
                  contentDescription = null,
                  tint = Color.White,
                  modifier = Modifier.size(22.dp)
                )
              }

              Column(modifier = Modifier.weight(1f)) {
                Row(
                  verticalAlignment = Alignment.CenterVertically,
                  horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                  Text(
                    text = provider.name,
                    style = MaterialTheme.typography.titleMedium.copy(
                      fontWeight = FontWeight.SemiBold,
                      fontSize = 15.sp
                    ),
                    color = Color(0xFF0F172A)
                  )
                }
                Text(
                  text = "${provider.vendor} · ${provider.portalName}",
                  style = MaterialTheme.typography.labelSmall.copy(
                    color = Color(0xFF0D9488),
                    fontWeight = FontWeight.Medium,
                    fontSize = 12.sp
                  )
                )
                if (provider.description.isNotBlank()) {
                  Spacer(modifier = Modifier.height(2.dp))
                  Text(
                    text = provider.description,
                    style = MaterialTheme.typography.bodySmall.copy(
                      color = Color(0xFF64748B),
                      fontSize = 11.5.sp
                    )
                  )
                }
              }
            }
          }

          Spacer(modifier = Modifier.height(10.dp))
        }
      }
    }
  }
}
