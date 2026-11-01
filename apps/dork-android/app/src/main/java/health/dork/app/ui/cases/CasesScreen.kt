package health.dork.app.ui.cases

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.LocalPharmacy
import androidx.compose.material.icons.rounded.MedicalInformation
import androidx.compose.material.icons.rounded.MonitorHeart
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.data.model.CaseBannerTheme
import health.dork.app.core.data.model.CaseStatus
import health.dork.app.core.data.model.ClinicalCase
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.PrescriptionMedicineItem
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkTextField

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CasesScreen(
  viewModel: CasesViewModel,
  darkTheme: Boolean = isSystemInDarkTheme(),
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  var showNewCaseSheet by remember { mutableStateOf(false) }

  DorkTheme(darkTheme = darkTheme) {
    // Theme-adaptive color tokens matching the rest of the Dork app
    val textPrimary = DorkTheme.colors.textPrimary
    val textSecondary = DorkTheme.colors.textSecondary
    val textTertiary = DorkTheme.colors.textTertiary
    val searchBg = DorkTheme.colors.card
    val searchBorder = DorkTheme.colors.surfaceBorder
    val addBtnBg = DorkTheme.colors.textPrimary
    val addBtnTint = DorkTheme.colors.canvas

    Box(
      modifier = modifier
        .fillMaxSize()
        .background(DorkTheme.colors.canvas)
    ) {

      Column(
        modifier = Modifier
          .fillMaxSize()
          .statusBarsPadding()
      ) {
        // ── Top App Bar ──────────────────────────────────────────────
        Row(
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 22.dp, vertical = 14.dp),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Column {
            Text(
              text = "Cases",
              style = MaterialTheme.typography.headlineLarge.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 32.sp,
                letterSpacing = (-0.6).sp
              ),
              color = textPrimary
            )
            Text(
              text = "Visits, diagnoses, reports & treatment timeline",
              style = MaterialTheme.typography.bodySmall,
              color = textSecondary
            )
          }

          // New Case / Log Visit Action Button
          Box(
            modifier = Modifier
              .size(44.dp)
              .clip(CircleShape)
              .background(addBtnBg)
              .clickable { showNewCaseSheet = true },
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = Icons.Rounded.Add,
              contentDescription = "Log New Case",
              tint = addBtnTint,
              modifier = Modifier.size(24.dp)
            )
          }
        }

        // ── Search & Filter Controls ─────────────────────────────────
        OutlinedTextField(
          value = uiState.searchQuery,
          onValueChange = viewModel::onSearchQueryChange,
          placeholder = {
            Text(
              text = "Search diagnosis, doctor, or medication...",
              style = MaterialTheme.typography.bodyMedium,
              color = textTertiary
            )
          },
          leadingIcon = {
            Icon(
              imageVector = Icons.Rounded.Search,
              contentDescription = null,
              tint = textSecondary,
              modifier = Modifier.size(20.dp)
            )
          },
          trailingIcon = {
            if (uiState.searchQuery.isNotEmpty()) {
              Icon(
                imageVector = Icons.Rounded.Close,
                contentDescription = "Clear",
                tint = textSecondary,
                modifier = Modifier
                  .size(18.dp)
                  .clickable { viewModel.onSearchQueryChange("") }
              )
            }
          },
          singleLine = true,
          shape = RoundedCornerShape(16.dp),
          colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = searchBg,
            unfocusedContainerColor = searchBg,
            focusedTextColor = textPrimary,
            unfocusedTextColor = textPrimary,
            focusedBorderColor = textPrimary,
            unfocusedBorderColor = searchBorder
          ),
          modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 22.dp, vertical = 6.dp)
        )

        // Filter Pills Row
        LazyRow(
          contentPadding = PaddingValues(horizontal = 22.dp, vertical = 10.dp),
          horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          items(viewModel.filters) { filter ->
            val selected = filter == uiState.selectedFilter
            val chipBg = if (selected) DorkTheme.colors.textPrimary else DorkTheme.colors.card
            val chipBorder = if (selected) null else BorderStroke(1.dp, DorkTheme.colors.surfaceBorder)
            val chipText = if (selected) DorkTheme.colors.canvas else DorkTheme.colors.textSecondary

            Surface(
              shape = RoundedCornerShape(percent = 50),
              color = chipBg,
              border = chipBorder,
              modifier = Modifier.clickable { viewModel.onFilterSelect(filter) }
            ) {
              Text(
                text = filter,
                style = MaterialTheme.typography.labelMedium.copy(
                  fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
                ),
                color = chipText,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
              )
            }
          }
        }

        // ── Chronological Case Folder Timeline Feed ───────────────────
        LazyColumn(
          modifier = Modifier.fillMaxSize(),
          contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 96.dp),
          verticalArrangement = Arrangement.spacedBy(22.dp)
        ) {
          if (uiState.cases.isEmpty()) {
            item {
              Box(
                modifier = Modifier
                  .fillMaxWidth()
                  .padding(top = 40.dp),
                contentAlignment = Alignment.Center
              ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                  Icon(
                    imageVector = Icons.Rounded.MedicalInformation,
                    contentDescription = null,
                    tint = textTertiary,
                    modifier = Modifier.size(48.dp)
                  )
                  Spacer(modifier = Modifier.height(12.dp))
                  Text(
                    text = "No cases matching this criteria",
                    style = MaterialTheme.typography.bodyLarge,
                    color = textSecondary
                  )
                }
              }
            }
          } else {
            items(uiState.cases, key = { it.id }) { clinicalCase ->
              CaseFolderCard(
                clinicalCase = clinicalCase,
                darkTheme = darkTheme,
                onClick = { viewModel.selectCase(clinicalCase) }
              )
            }
          }
        }
      }

      // ── Full Case Detail Bottom Sheet ──────────────────────────────
      uiState.selectedCase?.let { selected ->
        CaseDetailBottomSheet(
          clinicalCase = selected,
          darkTheme = darkTheme,
          onDismiss = { viewModel.selectCase(null) },
          onToggleResolved = { viewModel.toggleCaseResolved(selected.id) }
        )
      }

      // ── Log New Case Sheet ─────────────────────────────────────────
      if (showNewCaseSheet) {
        LogNewCaseBottomSheet(
          darkTheme = darkTheme,
          onDismiss = { showNewCaseSheet = false },
          onSave = { diag, doc, clinic, treat, medName, medDose ->
            viewModel.logEncounter(diag, doc, clinic, treat, medName, medDose)
            showNewCaseSheet = false
          }
        )
      }
    }
  }
}

/**
 * Custom Folder Tab Shape matching reference image 1000199546.jpg.
 *
 * It forms a physical file folder pocket:
 * - The left tab rises higher (covering ~55% of the card width)
 * - Rounds smoothly across the top-left and top-right of the tab
 * - Curves smoothly with an S-fillet down into the horizontal shelf on the right
 * - Rounds into the bottom squircle
 */
class FolderPocketShape(
  private val tabWidthFraction: Float = 0.54f,
  private val shelfOffsetPx: Float = 64f,
  private val cornerRadiusPx: Float = 42f,
  private val filletRadiusPx: Float = 36f
) : Shape {
  override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
    val path = Path().apply {
      val w = size.width
      val h = size.height
      val tabW = w * tabWidthFraction
      val shelfY = shelfOffsetPx
      val r = cornerRadiusPx
      val f = filletRadiusPx

      // Start at top-left of the raised tab
      moveTo(0f, r)
      quadraticTo(0f, 0f, r, 0f)
      lineTo(tabW - r, 0f)

      // Top-right shoulder of the raised tab
      quadraticTo(tabW, 0f, tabW, r)

      // Smooth concave fillet down to the lower horizontal shelf
      quadraticTo(tabW, shelfY, tabW + f, shelfY)

      // Across the lower shelf to the right edge
      lineTo(w - r, shelfY)
      quadraticTo(w, shelfY, w, shelfY + r)

      // Down the right edge
      lineTo(w, h - r)
      quadraticTo(w, h, w - r, h)

      // Across the bottom
      lineTo(r, h)
      quadraticTo(0f, h, 0f, h - r)

      close()
    }
    return Outline.Generic(path)
  }
}

/**
 * Case Folder Card.
 *
 * Pixel-accurate implementation of the reference card:
 * 1. Outer heavy-rounded squircle card (radius ~30dp)
 * 2. Glowing artwork banner at the top (ambient flare)
 *    with category/clinic text in the top-right
 * 3. Folder pocket tab overlay:
 *    - Left elevated tab with Title (diagnosis) & Subtitle (doctor/specialty)
 *    - Folder body with clinical summary, ICD-10 tag, and vitals
 *    - Bottom row: Big bold Date (05 Doc / 17 Oct) on left, Meta note count on right
 * Fully adapts between Dark Mode and Light Mode with high-contrast luxury styling.
 */
@Composable
fun CaseFolderCard(
  clinicalCase: ClinicalCase,
  darkTheme: Boolean = isSystemInDarkTheme(),
  onClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  // Theme palette for card using Dork design tokens
  val cardBg = DorkTheme.colors.card
  val cardBorder = DorkTheme.colors.surfaceBorder
  val spotColor = DorkTheme.colors.cardShadow

  val pocketBg = if (darkTheme) Color(0xFF1B212C) else DorkTheme.colors.surfaceSecondary
  val pocketBorder = DorkTheme.colors.surfaceBorderSubtle

  val titleColor = DorkTheme.colors.textPrimary
  val subtitleColor = DorkTheme.colors.textSecondary
  val summaryColor = DorkTheme.colors.textPrimary.copy(alpha = 0.85f)

  val icdBg = if (darkTheme) Color.White.copy(alpha = 0.08f) else DorkTheme.colors.sky
  val icdBorder = if (darkTheme) Color.White.copy(alpha = 0.18f) else DorkTheme.colors.surfaceBorder
  val icdText = if (darkTheme) Color.White.copy(alpha = 0.85f) else DorkTheme.colors.skyInk

  val vitalsBg = if (darkTheme) Color.White.copy(alpha = 0.08f) else DorkTheme.colors.card
  val vitalsText = DorkTheme.colors.textSecondary

  val dayColor = DorkTheme.colors.textPrimary
  val monthColor = DorkTheme.colors.textSecondary
  val metaCountColor = DorkTheme.colors.textPrimary

  // Outer squircle container
  Surface(
    modifier = modifier
      .fillMaxWidth()
      .height(300.dp)
      .shadow(elevation = 14.dp, shape = RoundedCornerShape(32.dp), spotColor = spotColor)
      .clip(RoundedCornerShape(32.dp))
      .clickable(
        interactionSource = remember { MutableInteractionSource() },
        indication = null,
        onClick = onClick
      ),
    color = cardBg,
    border = BorderStroke(1.dp, cardBorder)
  ) {
    Box(modifier = Modifier.fillMaxSize()) {
      // 1. Top Artwork Banner (ambient blooming glow)
      Canvas(
        modifier = Modifier
          .fillMaxWidth()
          .height(140.dp)
      ) {
        val w = size.width
        val h = size.height

        val (coreColor, midColor, outerColor) = when (clinicalCase.bannerTheme) {
          CaseBannerTheme.EMBER_GLOW -> Triple(
            Color(0xFFFFB74D),
            Color(0xFFF4511E),
            if (darkTheme) Color(0xFF8B1200) else Color(0xFFFFCC80)
          )
          CaseBannerTheme.CYAN_PULSE -> Triple(
            Color(0xFF80DEEA),
            Color(0xFF00ACC1),
            if (darkTheme) Color(0xFF004D40) else Color(0xFFB2EBF2)
          )
          CaseBannerTheme.VIOLET_MYSTIC -> Triple(
            Color(0xFFCE93D8),
            Color(0xFF8E24AA),
            if (darkTheme) Color(0xFF311B92) else Color(0xFFE1BEE7)
          )
          CaseBannerTheme.EMERALD_VITAL -> Triple(
            Color(0xFFA5D6A7),
            Color(0xFF43A047),
            if (darkTheme) Color(0xFF1B5E20) else Color(0xFFC8E6C9)
          )
        }

        // Draw background base of the banner
        drawRect(color = cardBg)

        // Primary flare focus on center-right (exposed above the lower shelf)
        val endColor = cardBg
        drawRect(
          brush = Brush.radialGradient(
            colorStops = arrayOf(
              0.00f to coreColor.copy(alpha = if (darkTheme) 0.95f else 0.85f),
              0.25f to midColor.copy(alpha = if (darkTheme) 0.85f else 0.70f),
              0.55f to outerColor.copy(alpha = if (darkTheme) 0.60f else 0.40f),
              0.85f to endColor.copy(alpha = 0.90f),
              1.00f to endColor
            ),
            center = Offset(w * 0.75f, h * 0.45f),
            radius = h * 1.4f
          )
        )

        // Soft secondary warm glow on the left
        drawCircle(
          brush = Brush.radialGradient(
            colors = listOf(midColor.copy(alpha = if (darkTheme) 0.40f else 0.30f), Color.Transparent),
            center = Offset(w * 0.20f, h * 0.30f),
            radius = h * 0.8f
          ),
          radius = h * 0.8f,
          center = Offset(w * 0.20f, h * 0.30f)
        )
      }

      // Top-right banner text (matching "Taskello App Card Design" in reference image)
      Column(
        modifier = Modifier
          .align(Alignment.TopEnd)
          .padding(top = 18.dp, end = 24.dp),
        horizontalAlignment = Alignment.End
      ) {
        Surface(
          shape = RoundedCornerShape(percent = 50),
          color = if (darkTheme) Color.White.copy(alpha = 0.15f) else Color.White.copy(alpha = 0.85f),
          border = if (darkTheme) null else BorderStroke(1.dp, Color(0xFFCCE0F5))
        ) {
          Text(
            text = clinicalCase.status.label,
            style = MaterialTheme.typography.labelSmall.copy(
              fontWeight = FontWeight.Bold,
              fontSize = 11.sp,
              letterSpacing = 0.5.sp
            ),
            color = if (darkTheme) Color.White else Color(0xFF0F172A),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
          )
        }
        Spacer(modifier = Modifier.height(3.dp))
        Text(
          text = clinicalCase.clinicName.take(20),
          style = MaterialTheme.typography.bodySmall.copy(
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium
          ),
          color = if (darkTheme) Color.White.copy(alpha = 0.75f) else Color(0xFF334155)
        )
      }

      // 2. Folder Pocket Tab Overlay
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(230.dp)
          .align(Alignment.BottomCenter)
          .clip(FolderPocketShape(tabWidthFraction = 0.54f, shelfOffsetPx = 48f))
          .background(pocketBg)
          .border(
            width = 1.dp,
            color = pocketBorder,
            shape = FolderPocketShape(tabWidthFraction = 0.54f, shelfOffsetPx = 48f)
          )
          .padding(start = 22.dp, end = 22.dp, top = 14.dp, bottom = 18.dp)
      ) {
        Column(
          modifier = Modifier.fillMaxSize(),
          verticalArrangement = Arrangement.SpaceBetween
        ) {
          // Top Left Folder Tab Content (Title & Subtitle)
          Column(modifier = Modifier.fillMaxWidth(0.52f)) {
            Text(
              text = clinicalCase.diagnosisTitle,
              style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                letterSpacing = (-0.3).sp,
                lineHeight = 22.sp
              ),
              color = titleColor,
              maxLines = 1
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
              text = clinicalCase.subtitle,
              style = MaterialTheme.typography.bodySmall.copy(
                fontSize = 12.sp,
                lineHeight = 16.sp
              ),
              color = subtitleColor,
              maxLines = 1
            )
          }

          // Middle content: Clinical indicators & treatment summary
          Column(
            modifier = Modifier
              .fillMaxWidth()
              .padding(top = 10.dp)
          ) {
            Row(
              horizontalArrangement = Arrangement.spacedBy(6.dp),
              verticalAlignment = Alignment.CenterVertically
            ) {
              // ICD code pill
              Surface(
                shape = RoundedCornerShape(percent = 50),
                color = icdBg,
                border = BorderStroke(1.dp, icdBorder)
              ) {
                Text(
                  text = clinicalCase.icdCode,
                  style = MaterialTheme.typography.labelSmall.copy(
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold
                  ),
                  color = icdText,
                  modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                )
              }

              // Vitals quick tag
              clinicalCase.vitals?.bloodPressure?.let { bp ->
                Surface(
                  shape = RoundedCornerShape(percent = 50),
                  color = vitalsBg
                ) {
                  Text(
                    text = "BP $bp",
                    style = MaterialTheme.typography.labelSmall.copy(
                      fontSize = 10.sp,
                      fontWeight = FontWeight.Medium
                    ),
                    color = vitalsText,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                  )
                }
              }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Clinical treatment summary
            Text(
              text = clinicalCase.treatment.protocolSummary,
              style = MaterialTheme.typography.bodySmall.copy(
                fontSize = 12.sp,
                lineHeight = 17.sp
              ),
              color = summaryColor,
              maxLines = 2
            )
          }

          // Bottom Row: [05 Doc (Date)] on Left, [1270 Notes (Meta)] on Right
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
          ) {
            // Left: Big bold day number + Month
            Row(
              verticalAlignment = Alignment.Bottom,
              horizontalArrangement = Arrangement.Start
            ) {
              Text(
                text = clinicalCase.dayDisplay,
                style = MaterialTheme.typography.headlineLarge.copy(
                  fontWeight = FontWeight.Bold,
                  fontSize = 28.sp,
                  lineHeight = 28.sp,
                  letterSpacing = (-0.5).sp
                ),
                color = dayColor
              )
              Spacer(modifier = Modifier.width(6.dp))
              Text(
                text = clinicalCase.monthDisplay,
                style = MaterialTheme.typography.titleMedium.copy(
                  fontWeight = FontWeight.Medium,
                  fontSize = 14.sp
                ),
                color = monthColor,
                modifier = Modifier.padding(bottom = 3.dp)
              )
            }

            // Right: Meta count label (matching "1270 Notes")
            Text(
              text = clinicalCase.metaNoteCount,
              style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.5.sp,
                letterSpacing = 0.2.sp
              ),
              color = metaCountColor,
              modifier = Modifier.padding(bottom = 3.dp)
            )
          }
        }
      }
    }
  }
}

/**
 * Full Clinical Case Detail View.
 *
 * Consolidates all information:
 * - Diagnosis, ICD-10, Physician, Clinic
 * - Full treatment plan & precautions
 * - Prescribed medications
 * - Diagnostic reports & labs
 * - Recorded encounter vitals
 * - Follow-up milestones
 * Fully adaptive to Dark and Light modes.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CaseDetailBottomSheet(
  clinicalCase: ClinicalCase,
  darkTheme: Boolean = isSystemInDarkTheme(),
  onDismiss: () -> Unit,
  onToggleResolved: () -> Unit
) {
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

  val sheetContainerBg = if (darkTheme) Color(0xFF14171E) else Color.White
  val textPrimary = if (darkTheme) Color.White else Color(0xFF0F172A)
  val textSecondary = if (darkTheme) Color.White.copy(alpha = 0.65f) else Color(0xFF475569)
  val closeBtnBg = if (darkTheme) Color.White.copy(alpha = 0.10f) else Color(0xFFEFF3F8)
  val closeBtnTint = if (darkTheme) Color.White else Color(0xFF475569)

  val btnContainer = if (clinicalCase.status == CaseStatus.ACTIVE) {
    if (darkTheme) Color.White else Color(0xFF10151E)
  } else {
    if (darkTheme) Color(0xFF263238) else Color(0xFFF1F5F9)
  }
  val btnContent = if (clinicalCase.status == CaseStatus.ACTIVE) {
    if (darkTheme) Color(0xFF10151E) else Color.White
  } else {
    if (darkTheme) Color.White else Color(0xFF10151E)
  }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = sheetContainerBg,
    tonalElevation = 8.dp,
    shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .padding(horizontal = 24.dp, vertical = 12.dp)
    ) {
      // Sheet Header & Actions
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          val badgeColor = if (clinicalCase.status == CaseStatus.ACTIVE) Color(0xFFFFA063) else Color(0xFF4CAF50)
          Surface(
            shape = RoundedCornerShape(percent = 50),
            color = badgeColor.copy(alpha = if (darkTheme) 0.20f else 0.15f),
            border = BorderStroke(1.dp, badgeColor)
          ) {
            Text(
              text = clinicalCase.status.label,
              style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
              color = badgeColor,
              modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
            )
          }

          Spacer(modifier = Modifier.width(8.dp))

          Text(
            text = "${clinicalCase.dayDisplay} ${clinicalCase.monthDisplay} ${clinicalCase.yearDisplay}",
            style = MaterialTheme.typography.bodySmall,
            color = textSecondary
          )
        }

        Box(
          modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(closeBtnBg)
            .clickable(onClick = onDismiss),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = Icons.Rounded.Close,
            contentDescription = "Close",
            tint = closeBtnTint,
            modifier = Modifier.size(18.dp)
          )
        }
      }

      Spacer(modifier = Modifier.height(14.dp))

      // Diagnosis Headline
      Text(
        text = clinicalCase.diagnosisTitle,
        style = MaterialTheme.typography.headlineMedium.copy(
          fontWeight = FontWeight.Bold,
          fontSize = 26.sp,
          letterSpacing = (-0.5).sp
        ),
        color = textPrimary
      )

      Text(
        text = "${clinicalCase.doctorName} • ${clinicalCase.clinicName}",
        style = MaterialTheme.typography.bodyMedium,
        color = textSecondary
      )

      Spacer(modifier = Modifier.height(18.dp))

      LazyColumn(
        modifier = Modifier.weight(1f, fill = false),
        verticalArrangement = Arrangement.spacedBy(16.dp)
      ) {
        // Section 1: Clinical Assessment
        item {
          DetailCard(
            title = "Clinical Assessment",
            icon = Icons.Rounded.MedicalInformation,
            darkTheme = darkTheme
          ) {
            Text(
              text = clinicalCase.clinicalSummary,
              style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
              color = textPrimary
            )

            clinicalCase.vitals?.let { vitals ->
              Spacer(modifier = Modifier.height(12.dp))
              Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
              ) {
                vitals.bloodPressure?.let { VitalsPill("BP", it, darkTheme) }
                vitals.heartRate?.let { VitalsPill("HR", it, darkTheme) }
                vitals.spo2?.let { VitalsPill("SpO2", it, darkTheme) }
                vitals.temperature?.let { VitalsPill("Temp", it, darkTheme) }
              }
            }
          }
        }

        // Section 2: Treatment Protocol
        item {
          DetailCard(
            title = "Treatment Protocol",
            icon = Icons.Rounded.MonitorHeart,
            darkTheme = darkTheme
          ) {
            Text(
              text = clinicalCase.treatment.protocolSummary,
              style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = FontWeight.SemiBold,
                lineHeight = 20.sp
              ),
              color = textPrimary
            )

            clinicalCase.treatment.lifestyleGuidance?.let { guidance ->
              Spacer(modifier = Modifier.height(8.dp))
              Text(
                text = "Guidance: $guidance",
                style = MaterialTheme.typography.bodySmall,
                color = textSecondary
              )
            }

            clinicalCase.treatment.precautions?.let { precautions ->
              Spacer(modifier = Modifier.height(6.dp))
              Text(
                text = "Precautions: $precautions",
                style = MaterialTheme.typography.bodySmall,
                color = if (darkTheme) Color(0xFFFFB74D) else Color(0xFFC2410C)
              )
            }
          }
        }

        // Section 3: Prescribed Medications
        if (clinicalCase.medications.isNotEmpty()) {
          item {
            DetailCard(
              title = "Prescribed Medications (${clinicalCase.medications.size})",
              icon = Icons.Rounded.LocalPharmacy,
              darkTheme = darkTheme
            ) {
              Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                clinicalCase.medications.forEach { med ->
                  val medCardBg = if (darkTheme) Color.White.copy(alpha = 0.05f) else Color.White
                  val medCardBorder = if (darkTheme) Color.White.copy(alpha = 0.08f) else Color(0xFFE2ECF7)

                  Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = medCardBg,
                    border = BorderStroke(1.dp, medCardBorder),
                    modifier = Modifier.fillMaxWidth()
                  ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                      Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                      ) {
                        Text(
                          text = med.name,
                          style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                          color = textPrimary
                        )
                        Text(
                          text = med.dose,
                          style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                          color = if (darkTheme) Color(0xFF80DEEA) else Color(0xFF0284C7)
                        )
                      }
                      Spacer(modifier = Modifier.height(4.dp))
                      Text(
                        text = "${med.frequency} • ${med.duration}",
                        style = MaterialTheme.typography.bodySmall,
                        color = textSecondary
                      )
                      Spacer(modifier = Modifier.height(2.dp))
                      Text(
                        text = med.instructions,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (darkTheme) Color.White.copy(alpha = 0.50f) else Color(0xFF64748B)
                      )
                    }
                  }
                }
              }
            }
          }
        }

        // Section 4: Reports & Diagnostic Labs
        if (clinicalCase.reports.isNotEmpty()) {
          item {
            DetailCard(
              title = "Reports & Diagnostic Labs (${clinicalCase.reports.size})",
              icon = Icons.Rounded.Description,
              darkTheme = darkTheme
            ) {
              Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                clinicalCase.reports.forEach { report ->
                  val repCardBg = if (darkTheme) Color.White.copy(alpha = 0.05f) else Color.White
                  val repCardBorder = if (darkTheme) Color.White.copy(alpha = 0.08f) else Color(0xFFE2ECF7)

                  Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = repCardBg,
                    border = BorderStroke(1.dp, repCardBorder),
                    modifier = Modifier.fillMaxWidth()
                  ) {
                    Row(
                      modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                      verticalAlignment = Alignment.CenterVertically
                    ) {
                      Icon(
                        imageVector = Icons.Rounded.Description,
                        contentDescription = null,
                        tint = if (darkTheme) Color(0xFFFFA063) else Color(0xFFE65100),
                        modifier = Modifier.size(24.dp)
                      )
                      Spacer(modifier = Modifier.width(12.dp))
                      Column(modifier = Modifier.weight(1f)) {
                        Text(
                          text = report.title,
                          style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                          color = textPrimary
                        )
                        Text(
                          text = report.subtitle,
                          style = MaterialTheme.typography.bodySmall,
                          color = textSecondary
                        )
                        Text(
                          text = report.summary,
                          style = MaterialTheme.typography.labelSmall,
                          color = if (darkTheme) Color.White.copy(alpha = 0.50f) else Color(0xFF64748B),
                          maxLines = 2
                        )
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Section 5: Follow-up Milestone
        clinicalCase.followUpRecommendation?.let { followUp ->
          item {
            val fuCardBg = if (darkTheme) Color(0xFF1E2633) else Color(0xFFF0FDF4)
            val fuBorder = if (darkTheme) Color(0xFF2E3E56) else Color(0xFFBBF7D0)
            val fuIconTint = if (darkTheme) Color(0xFF80DEEA) else Color(0xFF16A34A)

            Surface(
              shape = RoundedCornerShape(16.dp),
              color = fuCardBg,
              border = BorderStroke(1.dp, fuBorder),
              modifier = Modifier.fillMaxWidth()
            ) {
              Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
              ) {
                Icon(
                  imageVector = Icons.Rounded.CheckCircle,
                  contentDescription = null,
                  tint = fuIconTint,
                  modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                  Text(
                    text = "Follow-up Recommendation",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    color = textPrimary
                  )
                  Text(
                    text = followUp,
                    style = MaterialTheme.typography.bodySmall,
                    color = textSecondary
                  )
                }
              }
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(18.dp))

      // Action Button
      Button(
        onClick = onToggleResolved,
        shape = RoundedCornerShape(percent = 50),
        colors = ButtonDefaults.buttonColors(
          containerColor = btnContainer,
          contentColor = btnContent
        ),
        modifier = Modifier
          .fillMaxWidth()
          .height(50.dp)
      ) {
        Text(
          text = if (clinicalCase.status == CaseStatus.ACTIVE) "Mark Case as Resolved" else "Re-open Case as Active",
          style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
        )
      }
    }
  }
}

@Composable
private fun DetailCard(
  title: String,
  icon: ImageVector,
  darkTheme: Boolean,
  content: @Composable () -> Unit
) {
  val cardBg = if (darkTheme) Color.White.copy(alpha = 0.04f) else Color(0xFFF8FAFD)
  val cardBorder = if (darkTheme) Color.White.copy(alpha = 0.08f) else Color(0xFFE2ECF7)
  val iconTint = if (darkTheme) Color(0xFF80DEEA) else Color(0xFF0284C7)
  val titleColor = if (darkTheme) Color.White.copy(alpha = 0.90f) else Color(0xFF0F172A)

  Surface(
    shape = RoundedCornerShape(20.dp),
    color = cardBg,
    border = BorderStroke(1.dp, cardBorder),
    modifier = Modifier.fillMaxWidth()
  ) {
    Column(modifier = Modifier.padding(16.dp)) {
      Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(bottom = 10.dp)
      ) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = iconTint,
          modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
          text = title,
          style = MaterialTheme.typography.labelMedium.copy(
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp,
            letterSpacing = 0.5.sp
          ),
          color = titleColor
        )
      }
      content()
    }
  }
}

@Composable
private fun VitalsPill(label: String, value: String, darkTheme: Boolean) {
  val pillBg = if (darkTheme) Color.White.copy(alpha = 0.06f) else Color.White
  val pillBorder = if (darkTheme) null else BorderStroke(1.dp, Color(0xFFE2E8F0))
  val labelColor = if (darkTheme) Color.White.copy(alpha = 0.50f) else Color(0xFF64748B)
  val valColor = if (darkTheme) Color.White else Color(0xFF0F172A)

  Surface(
    shape = RoundedCornerShape(8.dp),
    color = pillBg,
    border = pillBorder
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
      verticalAlignment = Alignment.CenterVertically
    ) {
      Text(
        text = "$label: ",
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
        color = labelColor
      )
      Text(
        text = value,
        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
        color = valColor
      )
    }
  }
}

/**
 * Bottom Sheet for creating a new Case encounter.
 * Adapts seamlessly between Dark and Light mode.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogNewCaseBottomSheet(
  darkTheme: Boolean = isSystemInDarkTheme(),
  onDismiss: () -> Unit,
  onSave: (diagnosis: String, doctor: String, clinic: String, treatment: String, medName: String?, medDose: String?) -> Unit
) {
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

  var diagnosis by remember { mutableStateOf("") }
  var doctor by remember { mutableStateOf("") }
  var clinic by remember { mutableStateOf("") }
  var treatment by remember { mutableStateOf("") }
  var medicationName by remember { mutableStateOf("") }
  var medicationDose by remember { mutableStateOf("") }

  val sheetBg = if (darkTheme) Color(0xFF14171E) else Color.White
  val titleColor = if (darkTheme) Color.White else Color(0xFF0F172A)
  val closeBg = if (darkTheme) Color.White.copy(alpha = 0.10f) else Color(0xFFEFF3F8)
  val closeTint = if (darkTheme) Color.White else Color(0xFF475569)
  val btnBg = if (darkTheme) Color.White else Color(0xFF10151E)
  val btnContent = if (darkTheme) Color(0xFF10151E) else Color.White

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = sheetBg,
    shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .navigationBarsPadding()
        .padding(horizontal = 24.dp, vertical = 12.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = "Log Clinical Case",
          style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
          color = titleColor
        )
        Box(
          modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(closeBg)
            .clickable(onClick = onDismiss),
          contentAlignment = Alignment.Center
        ) {
          Icon(
            imageVector = Icons.Rounded.Close,
            contentDescription = "Close",
            tint = closeTint,
            modifier = Modifier.size(18.dp)
          )
        }
      }

      Spacer(modifier = Modifier.height(18.dp))

      LazyColumn(
        modifier = Modifier.weight(1f, fill = false),
        verticalArrangement = Arrangement.spacedBy(12.dp)
      ) {
        item {
          DorkTextField(
            value = diagnosis,
            onValueChange = { diagnosis = it },
            label = "Diagnosis / Reason for Visit *",
            placeholder = "e.g. Acute Pharyngitis"
          )
        }

        item {
          DorkTextField(
            value = doctor,
            onValueChange = { doctor = it },
            label = "Attending Physician",
            placeholder = "e.g. Dr. Sarah Chen"
          )
        }

        item {
          DorkTextField(
            value = clinic,
            onValueChange = { clinic = it },
            label = "Clinic / Facility Name",
            placeholder = "e.g. Beacon Hill Medical"
          )
        }

        item {
          DorkTextField(
            value = treatment,
            onValueChange = { treatment = it },
            label = "Treatment Protocol / Plan",
            placeholder = "e.g. Oral antibiotic, hydration, and 5-day vocal rest"
          )
        }

        item {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
          ) {
            Box(modifier = Modifier.weight(1.4f)) {
              DorkTextField(
                value = medicationName,
                onValueChange = { medicationName = it },
                label = "Prescribed Medicine",
                placeholder = "e.g. Amoxicillin"
              )
            }
            Box(modifier = Modifier.weight(1f)) {
              DorkTextField(
                value = medicationDose,
                onValueChange = { medicationDose = it },
                label = "Dose",
                placeholder = "e.g. 500mg TID"
              )
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(18.dp))

      Button(
        onClick = {
          if (diagnosis.isNotBlank()) {
            onSave(
              diagnosis,
              doctor.ifBlank { "Dr. Sarah Chen" },
              clinic.ifBlank { "Beacon Hill Family Health" },
              treatment,
              medicationName.takeIf { it.isNotBlank() },
              medicationDose.takeIf { it.isNotBlank() }
            )
          }
        },
        enabled = diagnosis.isNotBlank(),
        shape = RoundedCornerShape(percent = 50),
        colors = ButtonDefaults.buttonColors(
          containerColor = btnBg,
          contentColor = btnContent,
          disabledContainerColor = btnBg.copy(alpha = 0.35f),
          disabledContentColor = btnContent.copy(alpha = 0.5f)
        ),
        modifier = Modifier
          .fillMaxWidth()
          .height(50.dp)
      ) {
        Text(
          text = "Save & Add to Timeline",
          style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
        )
      }
    }
  }
}
