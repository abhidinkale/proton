package health.dork.app.ui.medications

import android.app.TimePickerDialog
import android.media.MediaPlayer
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import health.dork.app.core.designsystem.DorkGradients
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkButton
import health.dork.app.core.designsystem.components.DorkButtonVariant
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkTextField
import health.dork.app.core.reminder.ReminderTone
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** The formatter the reminder planner parses, so a time saved here always fires. */
private val TIME_FORMAT = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

private val DURATION_CHOICES = listOf(7 to "7 days", 14 to "14 days", 30 to "30 days", 0 to "Ongoing")

/**
 * Add a medicine the patient takes but nobody prescribed in the app.
 *
 * The point of this sheet is the times: a medication with one hard-coded 9am
 * reminder is not a medication regimen. Each dose gets its own time, and each
 * plan gets its own tone, because "take at night" and "take with breakfast" are
 * heard in different places.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun MedicationEditorSheet(
  onDismiss: () -> Unit,
  onSave: (name: String, dosage: String, instructions: String, durationDays: Int?, times: List<String>, tone: ReminderTone) -> Unit
) {
  val context = LocalContext.current
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

  var name by remember { mutableStateOf("") }
  var dosage by remember { mutableStateOf("") }
  var instructions by remember { mutableStateOf("") }
  var durationDays by remember { mutableStateOf(30) }
  var times by remember { mutableStateOf(listOf(defaultTime(9, 0))) }
  var tone by remember { mutableStateOf(ReminderTone.CHIME) }
  var showErrors by remember { mutableStateOf(false) }

  val nameMissing = name.isBlank()
  val dosageMissing = dosage.isBlank()

  fun addTime() {
    val last = times.lastOrNull()?.let { LocalTime.parse(it, TIME_FORMAT) } ?: LocalTime.of(9, 0)
    val picker = TimePickerDialog(
      context,
      { _, hour, minute ->
        val formatted = LocalTime.of(hour, minute).format(TIME_FORMAT)
        if (!times.contains(formatted)) times = (times + formatted).sortedBy {
          runCatching { LocalTime.parse(it, TIME_FORMAT) }.getOrDefault(LocalTime.MIDNIGHT)
        }
      },
      last.hour,
      last.minute,
      false
    )
    picker.show()
  }

  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = sheetState,
    containerColor = DorkTheme.colors.canvas,
    dragHandle = null
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = DorkSpacing.screenHorizontalPadding)
        .padding(top = DorkSpacing.m, bottom = DorkSpacing.xl)
        .imePadding()
        .navigationBarsPadding()
    ) {
      // A gradient rule instead of a drag handle: it tells the eye this is a
      // different surface from the list behind it.
      Box(
        modifier = Modifier
          .width(44.dp)
          .height(4.dp)
          .clip(CircleShape)
          .background(Brush.horizontalGradient(DorkGradients.Tide))
      )

      Spacer(modifier = Modifier.height(DorkSpacing.m))

      Text(
        text = "Add a medicine",
        style = MaterialTheme.typography.displaySmall,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Text(
        text = "Set the exact times you take it. Each time becomes its own reminder.",
        style = MaterialTheme.typography.bodyMedium,
        color = DorkTheme.colors.textSecondary
      )

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      DorkTextField(
        value = name,
        onValueChange = { name = it; showErrors = false },
        label = "Medicine",
        placeholder = "e.g. Metformin",
        isError = showErrors && nameMissing
      )

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      DorkTextField(
        value = dosage,
        onValueChange = { dosage = it; showErrors = false },
        label = "Dose",
        placeholder = "e.g. 500 mg · 1 tablet",
        isError = showErrors && dosageMissing
      )

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      DorkTextField(
        value = instructions,
        onValueChange = { instructions = it },
        label = "Instructions (optional)",
        placeholder = "e.g. After food, with water",
        singleLine = false,
        maxLines = 2
      )

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      SectionLabel("Times")
      Spacer(modifier = Modifier.height(DorkSpacing.s))

      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s),
        verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)
      ) {
        times.forEach { time ->
          TimeChip(
            label = time,
            onRemove = if (times.size > 1) {
              { times = times - time }
            } else {
              null
            }
          )
        }
        DorkChip(label = "+ Add time", selected = false, onClick = { addTime() })
      }

      AnimatedVisibility(
        visible = times.size > 1,
        enter = fadeIn() + expandVertically(),
        exit = fadeOut() + shrinkVertically()
      ) {
        Text(
          text = "${times.size} reminders a day · ${times.joinToString(", ")}",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textTertiary,
          modifier = Modifier.padding(top = DorkSpacing.s)
        )
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      SectionLabel("For how long")
      Spacer(modifier = Modifier.height(DorkSpacing.s))
      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(DorkSpacing.s),
        verticalArrangement = Arrangement.spacedBy(DorkSpacing.s)
      ) {
        DURATION_CHOICES.forEach { (days, label) ->
          DorkChip(
            label = label,
            selected = durationDays == days,
            onClick = { durationDays = days }
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      SectionLabel("Reminder sound")
      Spacer(modifier = Modifier.height(DorkSpacing.xs))
      Text(
        text = "Tap to hear it. The reminder will use the channel for this tone.",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary
      )
      Spacer(modifier = Modifier.height(DorkSpacing.s))

      Column(verticalArrangement = Arrangement.spacedBy(DorkSpacing.xs)) {
        ReminderTone.entries.forEach { option ->
          ToneRow(
            tone = option,
            selected = tone == option,
            onSelect = { tone = option },
            onPreview = { playTonePreview(context, option) }
          )
        }
      }

      Spacer(modifier = Modifier.height(DorkSpacing.l))

      if (showErrors && (nameMissing || dosageMissing)) {
        Text(
          text = "A medicine and a dose are both needed.",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.critical
        )
        Spacer(modifier = Modifier.height(DorkSpacing.s))
      }

      DorkButton(
        text = "Save & schedule reminders",
        onClick = {
          if (nameMissing || dosageMissing) {
            showErrors = true
            return@DorkButton
          }
          onSave(
            name.trim(),
            dosage.trim(),
            instructions.trim(),
            durationDays.takeIf { it > 0 },
            times,
            tone
          )
        }
      )

      Spacer(modifier = Modifier.height(DorkSpacing.s))

      DorkButton(
        text = "Cancel",
        onClick = onDismiss,
        variant = DorkButtonVariant.Secondary
      )
    }
  }
}

@Composable
private fun SectionLabel(text: String) {
  Text(
    text = text.uppercase(Locale.US),
    style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.2.sp),
    color = DorkTheme.colors.textTertiary
  )
}

@Composable
private fun TimeChip(label: String, onRemove: (() -> Unit)?) {
  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = Modifier
      .clip(CircleShape)
      .background(DorkTheme.colors.card)
      .border(1.dp, DorkTheme.colors.surfaceBorder, CircleShape)
      .padding(start = 14.dp, end = if (onRemove == null) 14.dp else 8.dp, top = 8.dp, bottom = 8.dp)
  ) {
    Text(
      text = label,
      style = MaterialTheme.typography.labelLarge,
      color = DorkTheme.colors.textPrimary
    )
    if (onRemove != null) {
      Spacer(modifier = Modifier.width(4.dp))
      Box(
        modifier = Modifier
          .size(20.dp)
          .clip(CircleShape)
          .clickable(onClick = onRemove),
        contentAlignment = Alignment.Center
      ) {
        Icon(
          imageVector = Icons.Rounded.Close,
          contentDescription = "Remove $label",
          tint = DorkTheme.colors.textTertiary,
          modifier = Modifier.size(13.dp)
        )
      }
    }
  }
}

@Composable
private fun ToneRow(
  tone: ReminderTone,
  selected: Boolean,
  onSelect: () -> Unit,
  onPreview: () -> Unit
) {
  val borderAlpha by animateFloatAsState(
    targetValue = if (selected) 1f else 0f,
    animationSpec = tween(180),
    label = "tone-border"
  )

  Row(
    verticalAlignment = Alignment.CenterVertically,
    modifier = Modifier
      .fillMaxWidth()
      .clip(MaterialTheme.shapes.medium)
      .background(DorkTheme.colors.card)
      .border(
        width = 1.dp,
        color = DorkTheme.colors.surfaceBorder.copy(alpha = 0.4f + 0.6f * borderAlpha),
        shape = MaterialTheme.shapes.medium
      )
      .clickable(onClick = onSelect)
      .padding(horizontal = DorkSpacing.m, vertical = DorkSpacing.s)
  ) {
    Box(
      modifier = Modifier
        .size(34.dp)
        .clip(CircleShape)
        .background(
          if (selected) Brush.linearGradient(DorkGradients.Tide)
          else Brush.linearGradient(listOf(DorkTheme.colors.surfaceSecondary, DorkTheme.colors.surfaceSecondary))
        ),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = Icons.Rounded.NotificationsActive,
        contentDescription = null,
        tint = if (selected) androidx.compose.ui.graphics.Color.White else DorkTheme.colors.textSecondary,
        modifier = Modifier.size(17.dp)
      )
    }

    Spacer(modifier = Modifier.width(DorkSpacing.s))

    Column(modifier = Modifier.weight(1f)) {
      Text(
        text = tone.label,
        style = MaterialTheme.typography.titleSmall,
        color = DorkTheme.colors.textPrimary
      )
      Text(
        text = tone.blurb,
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textTertiary
      )
    }

    if (tone.soundRes != null) {
      Box(
        modifier = Modifier
          .size(34.dp)
          .clip(CircleShape)
          .clickable(onClick = onPreview),
        contentAlignment = Alignment.Center
      ) {
        Icon(
          imageVector = Icons.Rounded.GraphicEq,
          contentDescription = "Preview ${tone.label}",
          tint = DorkTheme.colors.textSecondary,
          modifier = Modifier.size(17.dp)
        )
      }
    }

    Spacer(modifier = Modifier.width(4.dp))

    Box(
      modifier = Modifier
        .size(18.dp)
        .clip(CircleShape)
        .border(
          1.5.dp,
          if (selected) DorkTheme.colors.textPrimary else DorkTheme.colors.surfaceBorder,
          CircleShape
        ),
      contentAlignment = Alignment.Center
    ) {
      // The outer row already fades its border on selection; the dot just
      // appears, which avoids a second animation competing with it.
      if (selected) {
        Box(
          modifier = Modifier
            .size(10.dp)
            .clip(CircleShape)
            .background(DorkTheme.colors.textPrimary)
        )
      }
    }
  }
}

/** Plays a bundled tone once. Silent has nothing to play. */
private fun playTonePreview(context: android.content.Context, tone: ReminderTone) {
  val res = tone.soundRes ?: return
  runCatching {
    val uri = Uri.parse("android.resource://${context.packageName}/$res")
    val player = MediaPlayer.create(context, uri) ?: return
    player.setOnCompletionListener { it.release() }
    player.start()
  }
}

private fun defaultTime(hour: Int, minute: Int): String =
  LocalTime.of(hour, minute).format(TIME_FORMAT)
