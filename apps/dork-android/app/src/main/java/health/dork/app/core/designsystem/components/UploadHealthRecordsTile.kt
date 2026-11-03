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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Editorial Health Records Upload Tile.
 *
 * Directly mirrors the reference design:
 * - Generous rounded card container (32dp squircle) with subtle ambient shadow
 * - Top row: "Upload Health Records" title + elevated circular (+) action button
 * - Center: realistic fanned document sheets ("INVOICE" / clinical records preview)
 * - Bottom: pill-shaped capsule displaying "Existing Records" and dynamic file count
 */
@Composable
fun UploadHealthRecordsTile(
  existingFilesCount: Int,
  onAddFileClick: () -> Unit,
  onViewRecordsClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  val cardBg = Color.White
  val borderColor = Color(0xFFEDF2F7)
  val textPrimary = Color(0xFF0F172A)
  val textSecondary = Color(0xFF94A3B8)
  val addBtnBg = Color(0xFFF8FAFC)
  val addBtnBorder = Color(0xFFE2E8F0)

  Box(
    modifier = modifier
      .shadow(
        elevation = 10.dp,
        shape = RoundedCornerShape(32.dp),
        spotColor = Color(0x180F172A),
        ambientColor = Color(0x0A0F172A)
      )
      .clip(RoundedCornerShape(32.dp))
      .background(cardBg)
      .border(BorderStroke(1.dp, borderColor), RoundedCornerShape(32.dp))
      .clickable { onViewRecordsClick() }
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(top = 22.dp, start = 22.dp, end = 22.dp, bottom = 14.dp)
    ) {
      // ── Top Row: Header & Add Button ──────────────────────────────
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
      ) {
        Column {
          Text(
            text = "Upload\nHealth Records",
            style = MaterialTheme.typography.titleMedium.copy(
              fontWeight = FontWeight.Bold,
              fontSize = 19.sp,
              lineHeight = 23.sp,
              letterSpacing = (-0.4).sp
            ),
            color = textPrimary
          )
        }

        // Circular Add Button where user adds their file
        Box(
          modifier = Modifier
            .size(38.dp)
            .shadow(
              elevation = 3.dp,
              shape = CircleShape,
              spotColor = Color(0x150F172A)
            )
            .clip(CircleShape)
            .background(addBtnBg)
            .border(BorderStroke(1.dp, addBtnBorder), CircleShape)
            .clickable(onClick = onAddFileClick),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = Icons.Rounded.Add,
            contentDescription = "Add file",
            tint = textPrimary,
            modifier = Modifier.size(20.dp)
          )
        }
      }

      Spacer(modifier = Modifier.height(14.dp))

      // ── Center: Document Stack Illustration ───────────────────────
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(118.dp),
        contentAlignment = Alignment.Center
      ) {
        // Back Sheet (tilted left)
        Box(
          modifier = Modifier
            .size(width = 118.dp, height = 98.dp)
            .offset(x = (-14).dp, y = 6.dp)
            .rotate(-8f)
            .shadow(
              elevation = 5.dp,
              shape = RoundedCornerShape(8.dp),
              spotColor = Color(0x120F172A)
            )
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFFAFAFA))
            .border(BorderStroke(1.dp, Color(0xFFE2E8F0)), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 7.dp)
        ) {
          Column {
            Text(
              text = "INV",
              style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 7.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
              ),
              color = Color(0xFF94A3B8)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Box(
              modifier = Modifier
                .width(42.dp)
                .height(3.dp)
                .background(Color(0xFFE2E8F0), RoundedCornerShape(2.dp))
            )
            Spacer(modifier = Modifier.height(4.dp))
            Box(
              modifier = Modifier
                .fillMaxWidth(0.75f)
                .height(3.dp)
                .background(Color(0xFFE2E8F0), RoundedCornerShape(2.dp))
            )
            Spacer(modifier = Modifier.height(4.dp))
            Box(
              modifier = Modifier
                .fillMaxWidth(0.5f)
                .height(3.dp)
                .background(Color(0xFFCBD5E1), RoundedCornerShape(2.dp))
            )
          }
        }

        // Front Sheet (tilted right, showing INVOICE / Record header)
        Box(
          modifier = Modifier
            .size(width = 132.dp, height = 108.dp)
            .offset(x = 10.dp, y = (-2).dp)
            .rotate(3.5f)
            .shadow(
              elevation = 9.dp,
              shape = RoundedCornerShape(9.dp),
              spotColor = Color(0x1F0F172A)
            )
            .clip(RoundedCornerShape(9.dp))
            .background(Color.White)
            .border(BorderStroke(1.dp, Color(0xFFE2E8F0)), RoundedCornerShape(9.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp)
        ) {
          Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
          ) {
            Text(
              text = "INVOICE",
              style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 8.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.2.sp
              ),
              color = Color(0xFF64748B)
            )

            Spacer(modifier = Modifier.height(5.dp))
            Box(
              modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(Color(0xFFE2E8F0))
            )
            Spacer(modifier = Modifier.height(6.dp))

            // Simulated document table rows
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween
            ) {
              Box(
                modifier = Modifier
                  .width(36.dp)
                  .height(3.dp)
                  .background(Color(0xFF94A3B8), RoundedCornerShape(2.dp))
              )
              Box(
                modifier = Modifier
                  .width(18.dp)
                  .height(3.dp)
                  .background(Color(0xFFCBD5E1), RoundedCornerShape(2.dp))
              )
            }

            Spacer(modifier = Modifier.height(4.dp))
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween
            ) {
              Box(
                modifier = Modifier
                  .width(48.dp)
                  .height(3.dp)
                  .background(Color(0xFFCBD5E1), RoundedCornerShape(2.dp))
              )
              Box(
                modifier = Modifier
                  .width(14.dp)
                  .height(3.dp)
                  .background(Color(0xFFE2E8F0), RoundedCornerShape(2.dp))
              )
            }

            Spacer(modifier = Modifier.height(4.dp))
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.SpaceBetween
            ) {
              Box(
                modifier = Modifier
                  .width(30.dp)
                  .height(3.dp)
                  .background(Color(0xFFE2E8F0), RoundedCornerShape(2.dp))
              )
              Box(
                modifier = Modifier
                  .width(16.dp)
                  .height(3.dp)
                  .background(Color(0xFFE2E8F0), RoundedCornerShape(2.dp))
              )
            }

            Spacer(modifier = Modifier.height(8.dp))
            // Small simulated barcode / footer lines
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.Center
            ) {
              repeat(8) { idx ->
                Box(
                  modifier = Modifier
                    .padding(horizontal = 1.dp)
                    .width(if (idx % 2 == 0) 2.dp else 1.dp)
                    .height(6.dp)
                    .background(Color(0xFFCBD5E1))
                )
              }
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(10.dp))

      // ── Bottom Pill Container: Existing Records & Count ───────────
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .shadow(
            elevation = 4.dp,
            shape = RoundedCornerShape(22.dp),
            spotColor = Color(0x120F172A)
          )
          .clip(RoundedCornerShape(22.dp))
          .background(Color.White)
          .border(BorderStroke(1.dp, Color(0xFFF1F5F9)), RoundedCornerShape(22.dp))
          .clickable(onClick = onViewRecordsClick)
          .padding(vertical = 11.dp, horizontal = 16.dp),
        contentAlignment = Alignment.Center
      ) {
        Column(
          horizontalAlignment = Alignment.CenterHorizontally,
          modifier = Modifier.fillMaxWidth()
        ) {
          Text(
            text = "Existing Records",
            style = MaterialTheme.typography.titleSmall.copy(
              fontWeight = FontWeight.SemiBold,
              fontSize = 15.sp,
              letterSpacing = (-0.2).sp
            ),
            color = textPrimary
          )
          Spacer(modifier = Modifier.height(2.dp))
          Text(
            text = "$existingFilesCount ${if (existingFilesCount == 1) "file" else "files"}",
            style = MaterialTheme.typography.bodySmall.copy(
              fontSize = 13.sp,
              fontWeight = FontWeight.Normal
            ),
            color = textSecondary
          )
        }
      }
    }
  }
}
