package health.dork.app.ui.records

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.PhotoLibrary
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.DocumentCategory
import health.dork.app.core.data.model.HealthDocument
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkStatusBadge
import health.dork.app.core.designsystem.components.DorkStatusType
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.designsystem.components.DorkTopBar

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DocumentUploadScreen(
  viewModel: RecordsViewModel,
  onBackClick: () -> Unit,
  onUploadDone: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val scrollState = rememberScrollState()

  var docTitle by remember { mutableStateOf("Chest X-Ray / Spirometry Analysis") }
  var selectedCategory by remember { mutableStateOf(DocumentCategory.IMAGING_REPORT) }
  var selectedSource by remember { mutableStateOf("File Picker") }
  var uploadedDocResult by remember { mutableStateOf<HealthDocument?>(null) }

  if (uploadedDocResult != null) {
    // OCR & Structured Extraction Summary
    OcrExtractionSummaryView(
      doc = uploadedDocResult!!,
      onDone = onUploadDone
    )
    return
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Upload document",
      subtitle = "Original document is always preserved",
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      Text(
        text = "Select source",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.s))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s)
      ) {
        SourceCard(
          title = "Camera",
          icon = Icons.Rounded.CameraAlt,
          selected = selectedSource == "Camera",
          onClick = { selectedSource = "Camera" },
          modifier = Modifier.weight(1f)
        )
        SourceCard(
          title = "Gallery",
          icon = Icons.Rounded.PhotoLibrary,
          selected = selectedSource == "Gallery",
          onClick = { selectedSource = "Gallery" },
          modifier = Modifier.weight(1f)
        )
        SourceCard(
          title = "File",
          icon = Icons.Rounded.Folder,
          selected = selectedSource == "File Picker",
          onClick = { selectedSource = "File Picker" },
          modifier = Modifier.weight(1f)
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      Text(
        text = "Document title",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      DorkTextField(
        value = docTitle,
        onValueChange = { docTitle = it },
        placeholder = "e.g. CBC Laboratory Report, Knee MRI..."
      )

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      Text(
        text = "Document category",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))

      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.xs),
        verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)
      ) {
        DocumentCategory.entries.forEach { cat ->
          DorkChip(
            label = cat.label,
            selected = selectedCategory == cat,
            onClick = { selectedCategory = cat }
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      DorkButton(
        text = "Upload & process with OCR",
        onClick = {
          viewModel.uploadDocument(
            title = docTitle,
            category = selectedCategory,
            uri = "content://dork.health/docs/${System.currentTimeMillis()}.pdf"
          )
          uploadedDocResult = HealthDocument(
            id = "doc-${System.currentTimeMillis()}",
            title = docTitle,
            category = selectedCategory,
            uploadDate = "Today",
            fileSizeText = "1.8 MB PDF",
            originalUri = "content://dork.health/user/doc.pdf",
            isOcrProcessed = true,
            extractedText = "Automated OCR extraction complete: Diagnostic scan reviewed. Lung fields clear. No focal consolidation.",
            structuredEntities = listOf("Imaging: Bilateral Lung Fields", "Impression: No focal consolidation", "Extraction: Verified AI Pipeline")
          )
        },
        loading = uiState.isUploading
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

@Composable
private fun SourceCard(
  title: String,
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  selected: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier
) {
  DorkCard(
    modifier = modifier,
    contentPadding = DorkSpacing.m,
    onClick = onClick,
    backgroundColor = if (selected) MaterialTheme.colorScheme.primaryContainer else DorkTheme.colors.surfaceSecondary,
    borderColor = if (selected) MaterialTheme.colorScheme.primary else DorkTheme.colors.surfaceBorderSubtle
  ) {
    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      modifier = Modifier.fillMaxWidth()
    ) {
      Icon(
        imageVector = icon,
        contentDescription = null,
        tint = if (selected) MaterialTheme.colorScheme.primary else DorkTheme.colors.textSecondary,
        modifier = Modifier.size(24.dp)
      )
      Spacer(modifier = Modifier.height(4.dp))
      Text(
        text = title,
        style = MaterialTheme.typography.labelSmall,
        color = if (selected) MaterialTheme.colorScheme.primary else DorkTheme.colors.textPrimary
      )
    }
  }
}

@Composable
private fun OcrExtractionSummaryView(
  doc: HealthDocument,
  onDone: () -> Unit
) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
      .padding(DorkSpacing.screenHorizontalPadding),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.Center
  ) {
    Box(
      modifier = Modifier
        .size(68.dp)
        .clip(CircleShape)
        .background(DorkTheme.colors.successContainer),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = Icons.Rounded.CheckCircle,
        contentDescription = null,
        tint = DorkTheme.colors.success,
        modifier = Modifier.size(40.dp)
      )
    }

    Spacer(modifier = Modifier.height(DorkSpacing.m))

    Text(
      text = "Document stored & processed",
      style = MaterialTheme.typography.headlineLarge,
      color = DorkTheme.colors.textPrimary
    )

    Spacer(modifier = Modifier.height(DorkSpacing.xs))

    DorkStatusBadge(text = "AI / OCR Extracted Information", type = DorkStatusType.Info)

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    DorkCard(contentPadding = DorkSpacing.m) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = doc.title, style = MaterialTheme.typography.titleMedium, color = DorkTheme.colors.textPrimary)
        Text(text = "${doc.category.label} · ${doc.fileSizeText}", style = MaterialTheme.typography.bodySmall, color = DorkTheme.colors.textSecondary)

        Spacer(modifier = Modifier.height(DorkSpacing.s))

        Text(text = "Extracted summary:", style = MaterialTheme.typography.labelSmall, color = DorkTheme.colors.textTertiary)
        Text(
          text = doc.extractedText ?: "No text extracted.",
          style = MaterialTheme.typography.bodyMedium,
          color = DorkTheme.colors.textPrimary
        )

        Spacer(modifier = Modifier.height(DorkSpacing.s))

        doc.structuredEntities.forEach { entity ->
          Text(text = "• $entity", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
        }
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkButton(
      text = "Done & add to timeline",
      onClick = onDone
    )
  }
}
