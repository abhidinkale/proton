package health.dork.app.ui.records

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.Info
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
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

private data class PickedFile(
  val uri: String,
  val displayName: String,
  val sizeText: String
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DocumentUploadScreen(
  viewModel: RecordsViewModel,
  onBackClick: () -> Unit,
  onUploadDone: () -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()
  val context = LocalContext.current
  val scrollState = rememberScrollState()

  var pickedFile by remember { mutableStateOf<PickedFile?>(null) }
  var docTitle by remember { mutableStateOf("") }
  var selectedCategory by remember { mutableStateOf(DocumentCategory.LAB_REPORT) }
  var errorMessage by remember { mutableStateOf<String?>(null) }
  var uploadedDoc by remember { mutableStateOf<HealthDocument?>(null) }

  val picker = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.OpenDocument()
  ) { uri: Uri? ->
    if (uri == null) return@rememberLauncherForActivityResult
    // Ask the system to keep the read grant across app restarts where the
    // provider supports it, so the stored reference does not rot silently.
    runCatching {
      context.contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION
      )
    }

    val (name, size) = readFileMetadata(context, uri)
    pickedFile = PickedFile(uri = uri.toString(), displayName = name, sizeText = size)
    if (docTitle.isBlank()) {
      docTitle = name.substringBeforeLast('.').replace('_', ' ').replace('-', ' ').trim()
    }
    errorMessage = null
  }

  if (uploadedDoc != null) {
    StoredDocumentView(doc = uploadedDoc!!, onDone = onUploadDone)
    return
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    DorkTopBar(
      title = "Add a document",
      subtitle = "The original file stays on this device",
      onBackClick = onBackClick
    )

    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(scrollState)
        .padding(horizontal = DorkSpacing.screenHorizontalPadding, vertical = DorkSpacing.m)
    ) {
      Text(
        text = "Choose a file",
        style = MaterialTheme.typography.titleMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Text(
        text = "Pick a PDF, image or scan from your device. Dork stores a reference to it and shows it in your timeline. Nothing is uploaded anywhere.",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textSecondary
      )

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      DorkCard(
        contentPadding = DorkSpacing.l,
        backgroundColor = if (pickedFile != null) MaterialTheme.colorScheme.primaryContainer else DorkTheme.colors.surfaceSecondary,
        borderColor = if (pickedFile != null) MaterialTheme.colorScheme.primary else DorkTheme.colors.surfaceBorderSubtle,
        onClick = {
          picker.launch(
            arrayOf(
              "application/pdf",
              "image/*"
            )
          )
        }
      ) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Box(
            modifier = Modifier
              .size(48.dp)
              .clip(CircleShape)
              .background(MaterialTheme.colorScheme.surface),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = if (pickedFile == null) Icons.Rounded.FolderOpen else Icons.Rounded.Description,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(24.dp)
            )
          }
          Spacer(modifier = Modifier.size(DorkSpacing.m))
          Column(modifier = Modifier.weight(1f)) {
            Text(
              text = pickedFile?.displayName ?: "Browse this device",
              style = MaterialTheme.typography.titleSmall,
              color = DorkTheme.colors.textPrimary
            )
            Text(
              text = pickedFile?.sizeText ?: "No file selected yet",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
          DorkStatusBadge(
            text = if (pickedFile == null) "Required" else "Selected",
            type = if (pickedFile == null) DorkStatusType.Warning else DorkStatusType.Success
          )
        }
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
        placeholder = "e.g. CBC Laboratory Report, Knee MRI"
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

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      DorkCard(
        contentPadding = DorkSpacing.m,
        backgroundColor = DorkTheme.colors.surfaceSecondary
      ) {
        Row(verticalAlignment = Alignment.Top) {
          Icon(
            imageVector = Icons.Rounded.Info,
            contentDescription = null,
            tint = DorkTheme.colors.textTertiary,
            modifier = Modifier.size(18.dp)
          )
          Spacer(modifier = Modifier.size(DorkSpacing.s))
          Text(
            text = "This build does not run OCR or extract clinical values from uploads. You are storing the original document, and any information in it is not added to your lab results automatically.",
            style = MaterialTheme.typography.bodySmall,
            color = DorkTheme.colors.textSecondary
          )
        }
      }

      if (errorMessage != null) {
        Spacer(modifier = Modifier.height(DorkSpacing.s))
        Text(
          text = errorMessage.orEmpty(),
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.critical
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.xl))

      DorkButton(
        text = "Store document",
        onClick = {
          val file = pickedFile
          if (file == null) {
            errorMessage = "Choose a file before storing it."
            return@DorkButton
          }
          viewModel.uploadDocument(
            title = docTitle.ifBlank { file.displayName.substringBeforeLast('.') },
            category = selectedCategory,
            uri = file.uri,
            fileSizeText = file.sizeText
          ) { result ->
            result.fold(
              onSuccess = { uploadedDoc = it },
              onFailure = { errorMessage = it.message ?: "Could not store that file." }
            )
          }
        },
        loading = uiState.isUploading,
        enabled = pickedFile != null && !uiState.isUploading
      )

      Spacer(modifier = Modifier.height(DorkSpacing.xxl))
    }
  }
}

@Composable
private fun StoredDocumentView(
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
      text = "Document stored",
      style = MaterialTheme.typography.headlineLarge,
      color = DorkTheme.colors.textPrimary
    )

    Spacer(modifier = Modifier.height(DorkSpacing.xs))

    DorkStatusBadge(text = "On this device only", type = DorkStatusType.Success)

    Spacer(modifier = Modifier.height(DorkSpacing.l))

    DorkCard(contentPadding = DorkSpacing.m) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = doc.title, style = MaterialTheme.typography.titleMedium, color = DorkTheme.colors.textPrimary)
        Text(
          text = "${doc.category.label} · ${doc.fileSizeText} · ${doc.uploadDate}",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )

        Spacer(modifier = Modifier.height(DorkSpacing.s))

        Text(
          text = "The original file has been added to your records timeline. Dork has not read, interpreted or classified its contents.",
          style = MaterialTheme.typography.bodyMedium,
          color = DorkTheme.colors.textPrimary
        )
      }
    }

    Spacer(modifier = Modifier.height(DorkSpacing.xl))

    DorkButton(
      text = "Done & add to timeline",
      onClick = onDone
    )
  }
}

private fun readFileMetadata(context: android.content.Context, uri: Uri): Pair<String, String> {
  var name = uri.lastPathSegment?.substringAfterLast('/') ?: "Medical document"
  var sizeBytes: Long? = null

  runCatching {
    context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (nameIndex >= 0) {
          name = cursor.getString(nameIndex) ?: name
        }
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
          sizeBytes = cursor.getLong(sizeIndex)
        }
      }
    }
  }

  val resolvedType = context.contentResolver.getType(uri)
  val extension = resolvedType?.substringAfterLast('/')?.uppercase()
    ?: name.substringAfterLast('.', "").uppercase().ifBlank { "FILE" }

  val sizeText = when (val bytes = sizeBytes) {
    null -> extension
    else -> when {
      bytes >= 1024 * 1024 -> String.format("%.1f MB %s", bytes / (1024.0 * 1024.0), extension)
      bytes >= 1024 -> String.format("%.0f KB %s", bytes / 1024.0, extension)
      else -> "$bytes bytes $extension"
    }
  }

  return name to sizeText
}
