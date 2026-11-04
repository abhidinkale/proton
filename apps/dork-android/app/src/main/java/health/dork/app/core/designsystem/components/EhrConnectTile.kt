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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudSync
import androidx.compose.material.icons.rounded.LocalHospital
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme

/**
 * High-grade clinical tile for SMART on FHIR EHR integration.
 * Enables 1-touch connection to Epic MyChart, Oracle Cerner, Athena, and VA.
 */
@Composable
fun EhrConnectTile(
  isSyncing: Boolean,
  lastStatus: String?,
  onConnectClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val cardBg = Color.White
  val borderColor = Color(0xFFEDF2F7)
  val deepSlate = Color(0xFF0F172A)
  val tealAccent = Color(0xFF0D9488)

  Box(
    modifier = modifier
      .shadow(
        elevation = 8.dp,
        shape = RoundedCornerShape(24.dp),
        spotColor = Color(0x120F172A),
        ambientColor = Color(0x060F172A)
      )
      .clip(RoundedCornerShape(24.dp))
      .background(cardBg)
      .border(BorderStroke(1.dp, borderColor), RoundedCornerShape(24.dp))
      .clickable(enabled = !isSyncing) { onConnectClick() }
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(18.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
          Box(
            modifier = Modifier
              .size(36.dp)
              .clip(CircleShape)
              .background(Brush.linearGradient(listOf(Color(0xFF0D9488), Color(0xFF065F46)))),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = Icons.Rounded.LocalHospital,
              contentDescription = null,
              tint = Color.White,
              modifier = Modifier.size(20.dp)
            )
          }

          Column {
            Text(
              text = "Sync Hospital Records",
              style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                letterSpacing = (-0.2).sp
              ),
              color = deepSlate
            )
            Text(
              text = "Epic MyChart · Cerner · Athena · VA",
              style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 12.sp,
                color = Color(0xFF64748B)
              )
            )
          }
        }

        if (isSyncing) {
          CircularProgressIndicator(
            modifier = Modifier.size(22.dp),
            color = tealAccent,
            strokeWidth = 2.5.dp
          )
        } else {
          Box(
            modifier = Modifier
              .clip(RoundedCornerShape(12.dp))
              .background(Color(0xFFF1F5F9))
              .padding(horizontal = 10.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center
          ) {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
              Icon(
                imageVector = Icons.Rounded.CloudSync,
                contentDescription = null,
                tint = tealAccent,
                modifier = Modifier.size(14.dp)
              )
              Text(
                text = "Connect",
                style = MaterialTheme.typography.labelMedium.copy(
                  fontWeight = FontWeight.Medium,
                  color = deepSlate,
                  fontSize = 12.sp
                )
              )
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      Text(
        text = if (lastStatus != null) {
          lastStatus
        } else {
          "Import verified lab panels, active medications, and chronic conditions directly from your health system via SMART on FHIR."
        },
        style = MaterialTheme.typography.bodySmall.copy(
          fontSize = 12.5.sp,
          lineHeight = 17.sp,
          color = if (lastStatus != null) tealAccent else Color(0xFF64748B)
        )
      )

      Spacer(modifier = Modifier.height(10.dp))

      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
      ) {
        Icon(
          imageVector = Icons.Rounded.Lock,
          contentDescription = null,
          tint = Color(0xFF94A3B8),
          modifier = Modifier.size(11.dp)
        )
        Text(
          text = "21st Century Cures Act compliant · Patient-directed OAuth",
          style = MaterialTheme.typography.labelSmall.copy(
            fontSize = 11.sp,
            color = Color(0xFF94A3B8)
          )
        )
      }
    }
  }
}
