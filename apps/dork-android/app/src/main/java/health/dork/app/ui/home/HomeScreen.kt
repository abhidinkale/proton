package health.dork.app.ui.home

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.MedicalServices
import androidx.compose.material.icons.rounded.Medication
import androidx.compose.material.icons.rounded.MonitorHeart
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.Scale
import androidx.compose.material.icons.rounded.Upload
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.designsystem.DorkColors
import health.dork.app.core.designsystem.DorkShapes
import health.dork.app.core.designsystem.DorkSpacing
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.DorkType
import health.dork.app.core.designsystem.components.DorkCard
import health.dork.app.core.designsystem.components.DorkChip
import health.dork.app.core.designsystem.components.DorkLoadingScreen
import health.dork.app.core.designsystem.components.DorkTag
import health.dork.app.core.designsystem.components.DorkTagTone
import health.dork.app.core.designsystem.components.DotNumber
import health.dork.app.core.designsystem.components.DotSparkline
import kotlin.math.roundToInt

/**
 * Patient home, rebuilt around the editorial instrument language:
 * warm canvas, borderless white cards, dot-matrix metrics, gradient score cards
 * and a floating pill tab bar.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HomeScreen(
  viewModel: HomeViewModel,
  onNavigateToCare: () -> Unit,
  onNavigateToRecords: () -> Unit,
  onNavigateToAi: () -> Unit,
  onNavigateToMedications: () -> Unit,
  onAppointmentClick: (String) -> Unit,
  modifier: Modifier = Modifier
) {
  val uiState by viewModel.uiState.collectAsState()

  if (uiState.isLoading) {
    DorkLoadingScreen(modifier = modifier)
    return
  }

  HomeContent(
    uiState = uiState,
    onCheckIn = viewModel::onCheckInClick,
    onDoseTaken = viewModel::markNextDoseTaken,
    onDoseSkipped = viewModel::skipNextDose,
    onNavigateToCare = onNavigateToCare,
    onNavigateToRecords = onNavigateToRecords,
    onNavigateToAi = onNavigateToAi,
    onNavigateToMedications = onNavigateToMedications,
    onAppointmentClick = onAppointmentClick,
    modifier = modifier
  )
}

/** Stateless home surface, also used by screenshot tests and previews. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HomeContent(
  uiState: HomeUiState,
  onCheckIn: (String) -> Unit,
  onDoseTaken: (String) -> Unit,
  onDoseSkipped: (String) -> Unit,
  onNavigateToCare: () -> Unit,
  onNavigateToRecords: () -> Unit,
  onNavigateToAi: () -> Unit,
  onNavigateToMedications: () -> Unit,
  onAppointmentClick: (String) -> Unit,
  modifier: Modifier = Modifier
) {
  val scrollState = rememberScrollState()

  val patientName = uiState.patient?.fullName?.split(" ")?.firstOrNull() ?: "there"
  val nextAppointment = uiState.nextAppointment
  val nextDose = uiState.nextDose

  val adherence = if (uiState.todayDoseCount > 0) {
    (uiState.takenDoseCount * 100) / uiState.todayDoseCount
  } else {
    100
  }

  Column(
    modifier = modifier
      .fillMaxSize()
      .background(DorkTheme.colors.canvas)
      .verticalScroll(scrollState)
      .padding(horizontal = DorkSpacing.screenHorizontalPadding)
      .padding(top = 4.dp, bottom = 20.dp)
  ) {
    // ── Brand row ───────────────────────────────────────────────────────
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically
    ) {
      Row(verticalAlignment = Alignment.Bottom) {
        Text(
          text = "dork",
          style = MaterialTheme.typography.headlineMedium,
          fontWeight = FontWeight.SemiBold,
          color = DorkTheme.colors.textPrimary
        )
        Box(
          modifier = Modifier
            .padding(start = 3.dp, bottom = 4.dp)
            .size(5.dp)
            .clip(CircleShape)
            .background(DorkTheme.colors.lime)
        )
      }

      Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
      ) {
        CircleIconButton(
          icon = Icons.Rounded.NotificationsNone,
          contentDescription = "Notifications"
        )
        Box(
          modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(DorkTheme.colors.textPrimary),
          contentAlignment = Alignment.Center
        ) {
          Text(
            text = patientName.take(1).uppercase(),
            style = MaterialTheme.typography.labelLarge,
            color = Color.White
          )
        }
      }
    }

    Spacer(modifier = Modifier.height(26.dp))

    // ── Greeting ────────────────────────────────────────────────────────
    Text(
      text = "GOOD MORNING",
      style = DorkType.eyebrow,
      color = DorkTheme.colors.textTertiary
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
      text = patientName,
      style = MaterialTheme.typography.displayMedium,
      color = DorkTheme.colors.textPrimary
    )
    Spacer(modifier = Modifier.height(8.dp))
    Text(
      text = buildString {
        append(uiState.todayAppointmentCount.coerceAtLeast(1))
        append(if (uiState.todayAppointmentCount == 1) " visit" else " visits")
        append(" today · ")
        append(uiState.todayDoseCount)
        append(if (uiState.todayDoseCount == 1) " dose" else " doses")
        append(" scheduled. Everything in one calm place.")
      },
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textSecondary
    )

    Spacer(modifier = Modifier.height(24.dp))

    // ── Metric grid ─────────────────────────────────────────────────────
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
      MetricCell(
        value = uiState.todayAppointmentCount.coerceAtLeast(1).toString(),
        tag = "Visits",
        caption = nextAppointment?.dateTimeString ?: "Nothing booked",
        modifier = Modifier.weight(1f)
      )
      MetricCell(
        value = uiState.todayDoseCount.toString(),
        tag = "Doses",
        caption = nextDose?.scheduledTime ?: "All clear",
        modifier = Modifier.weight(1f)
      )
    }
    Spacer(modifier = Modifier.height(18.dp))
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
      MetricCell(
        value = uiState.recentRecords.size.toString(),
        tag = "Records",
        caption = "Latest results",
        modifier = Modifier.weight(1f)
      )
      MetricCell(
        value = uiState.restingHeartRateBpm.toString(),
        tag = "Bpm",
        caption = "Resting, normal",
        modifier = Modifier.weight(1f)
      )
    }

    Spacer(modifier = Modifier.height(22.dp))

    // ── Gradient score cards ────────────────────────────────────────────
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      ScoreCard(
        title = "Balance",
        value = "${uiState.takenDoseCount}/${uiState.todayDoseCount.coerceAtLeast(1)}",
        caption = if (adherence >= 80) "On track" else "Needs a nudge",
        series = listOf(0.22f, 0.3f, 0.28f, 0.42f, 0.5f, 0.46f, 0.62f, 0.7f, 0.66f, 0.78f),
        gradient = listOf(
          DorkColors.GradientGreenStart,
          DorkColors.GradientGreenMid,
          DorkColors.GradientGreenAccent,
          DorkColors.GradientGreenEnd
        ),
        badge = "Today",
        modifier = Modifier.weight(1f)
      )

      ScoreCard(
        title = "Adherence",
        value = adherence.toString(),
        suffix = "%",
        caption = "Last 7 days",
        series = listOf(0.55f, 0.62f, 0.58f, 0.7f, 0.74f, 0.7f, 0.82f, 0.86f, 0.84f, 0.92f),
        gradient = listOf(
          DorkColors.GradientEmberStart,
          DorkColors.GradientEmberMid,
          DorkColors.GradientEmberAccent,
          DorkColors.GradientEmberEnd
        ),
        badge = "Stable",
        modifier = Modifier.weight(1f)
      )
    }

    Spacer(modifier = Modifier.height(22.dp))

    // ── Day timeline ────────────────────────────────────────────────────
    DorkCard(
      shape = DorkShapes.extraLarge,
      contentPadding = 18.dp
    ) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = "Today",
            style = MaterialTheme.typography.titleMedium,
            color = DorkTheme.colors.textPrimary
          )
          DorkTag(
            text = "${uiState.todayAppointmentCount + uiState.todayDoseCount} events",
            tone = DorkTagTone.Neutral
          )
        }

        Spacer(modifier = Modifier.height(16.dp))

        DayTimeline(modifier = Modifier.fillMaxWidth())

        Spacer(modifier = Modifier.height(8.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween
        ) {
          Text(text = "08:00", style = DorkType.mono, color = DorkTheme.colors.textTertiary)
          Text(text = "13:00", style = DorkType.mono, color = DorkTheme.colors.textTertiary)
          Text(text = "20:00", style = DorkType.mono, color = DorkTheme.colors.textTertiary)
        }
      }
    }

    Spacer(modifier = Modifier.height(22.dp))

    // ── Next appointment ────────────────────────────────────────────────
    SectionHeader(
      title = "Next appointment",
      action = "See all",
      onAction = onNavigateToCare
    )
    Spacer(modifier = Modifier.height(10.dp))

    if (nextAppointment != null) {
      DorkCard(
        shape = DorkShapes.hero,
        contentPadding = 18.dp,
        onClick = { onAppointmentClick(nextAppointment.id) }
      ) {
        Column(modifier = Modifier.fillMaxWidth()) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
              DorkTag(text = "Next up", tone = DorkTagTone.Lime)
              DorkTag(
                text = if (nextAppointment.consultationType == ConsultationType.VIDEO) "Video" else "In clinic",
                tone = DorkTagTone.Sky
              )
            }
            ChevronCircle()
          }

          Spacer(modifier = Modifier.height(14.dp))

          Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
              modifier = Modifier
                .size(46.dp)
                .clip(CircleShape)
                .background(DorkTheme.colors.surfaceSecondary),
              contentAlignment = Alignment.Center
            ) {
              Icon(
                imageVector = if (nextAppointment.consultationType == ConsultationType.VIDEO) {
                  Icons.Rounded.Videocam
                } else {
                  Icons.Rounded.MedicalServices
                },
                contentDescription = null,
                tint = DorkTheme.colors.textPrimary,
                modifier = Modifier.size(20.dp)
              )
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
              Text(
                text = nextAppointment.doctorName,
                style = MaterialTheme.typography.titleLarge,
                color = DorkTheme.colors.textPrimary
              )
              Text(
                text = nextAppointment.specialty,
                style = MaterialTheme.typography.bodySmall,
                color = DorkTheme.colors.textSecondary
              )
            }
          }

          Spacer(modifier = Modifier.height(14.dp))

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
          ) {
            MetaLine(
              icon = Icons.Rounded.CalendarToday,
              text = nextAppointment.dateTimeString,
              modifier = Modifier.weight(1f)
            )
            MetaLine(
              icon = if (nextAppointment.consultationType == ConsultationType.VIDEO) {
                Icons.Rounded.Videocam
              } else {
                Icons.Rounded.LocationOn
              },
              text = nextAppointment.clinicLocation,
              modifier = Modifier.weight(1f)
            )
          }

          Spacer(modifier = Modifier.height(14.dp))

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Text(
              text = nextAppointment.reasonForVisit,
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
              modifier = Modifier.weight(1f)
            )
            Spacer(modifier = Modifier.width(12.dp))
            SmallPillButton(
              text = "Details",
              filled = true,
              onClick = { onAppointmentClick(nextAppointment.id) }
            )
          }
        }
      }
    } else {
      DorkCard(shape = DorkShapes.hero, contentPadding = 18.dp, onClick = onNavigateToCare) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Box(
            modifier = Modifier
              .size(46.dp)
              .clip(CircleShape)
              .background(DorkTheme.colors.surfaceSecondary),
            contentAlignment = Alignment.Center
          ) {
            Icon(
              imageVector = Icons.Rounded.CalendarToday,
              contentDescription = null,
              tint = DorkTheme.colors.textSecondary,
              modifier = Modifier.size(20.dp)
            )
          }
          Spacer(modifier = Modifier.width(12.dp))
          Column(modifier = Modifier.weight(1f)) {
            Text(
              text = "No appointment booked",
              style = MaterialTheme.typography.titleMedium,
              color = DorkTheme.colors.textPrimary
            )
            Text(
              text = "Find a clinician who fits your week.",
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
          SmallPillButton(text = "Book", filled = true, onClick = onNavigateToCare)
        }
      }
    }

    Spacer(modifier = Modifier.height(22.dp))

    // ── Next dose ───────────────────────────────────────────────────────
    if (nextDose != null) {
      SectionHeader(
        title = "Next dose",
        action = "Schedule",
        onAction = onNavigateToMedications
      )
      Spacer(modifier = Modifier.height(10.dp))

      DorkCard(shape = DorkShapes.hero, contentPadding = 18.dp) {
        Column(modifier = Modifier.fillMaxWidth()) {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
          ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Box(
                modifier = Modifier
                  .size(40.dp)
                  .clip(CircleShape)
                  .background(DorkTheme.colors.sage),
                contentAlignment = Alignment.Center
              ) {
                Icon(
                  imageVector = Icons.Rounded.Medication,
                  contentDescription = null,
                  tint = DorkTheme.colors.sageInk,
                  modifier = Modifier.size(19.dp)
                )
              }
              Spacer(modifier = Modifier.width(11.dp))
              Column {
                Text(
                  text = nextDose.name,
                  style = MaterialTheme.typography.titleMedium,
                  color = DorkTheme.colors.textPrimary
                )
                Text(
                  text = nextDose.dosage,
                  style = MaterialTheme.typography.bodySmall,
                  color = DorkTheme.colors.textSecondary
                )
              }
            }
            DorkTag(text = nextDose.scheduledTime, tone = DorkTagTone.Peach)
          }

          if (nextDose.instructions != null) {
            Spacer(modifier = Modifier.height(10.dp))
            Text(
              text = nextDose.instructions,
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textTertiary
            )
          }

          Spacer(modifier = Modifier.height(14.dp))

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            SmallPillButton(
              text = "Taken",
              icon = Icons.Rounded.Check,
              filled = true,
              onClick = { onDoseTaken(nextDose.id) },
              modifier = Modifier.weight(1f)
            )
            SmallPillButton(
              text = "Skip",
              icon = Icons.Rounded.Close,
              filled = false,
              onClick = { onDoseSkipped(nextDose.id) },
              modifier = Modifier.weight(1f)
            )
          }
        }
      }

      Spacer(modifier = Modifier.height(22.dp))
    }

    // ── Check-in ────────────────────────────────────────────────────────
    DorkCard(shape = DorkShapes.extraLarge, contentPadding = 16.dp) {
      Column(modifier = Modifier.fillMaxWidth()) {
        Text(
          text = "How are you feeling today?",
          style = MaterialTheme.typography.titleSmall,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.height(10.dp))
        FlowRow(
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          listOf("Feeling good", "A bit tired", "Need advice").forEach { mood ->
            DorkChip(
              label = mood,
              selected = uiState.checkInStatus == mood,
              onClick = { onCheckIn(mood) }
            )
          }
        }
      }
    }

    Spacer(modifier = Modifier.height(22.dp))

    // ── Quick actions ───────────────────────────────────────────────────
    Text(
      text = "Quick actions",
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textPrimary
    )
    Spacer(modifier = Modifier.height(12.dp))

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween
    ) {
      ActionTile(
        label = "Book",
        icon = Icons.Rounded.MedicalServices,
        onClick = onNavigateToCare
      )
      ActionTile(
        label = "Upload",
        icon = Icons.Rounded.Upload,
        onClick = onNavigateToRecords
      )
      ActionTile(
        label = "Ask Dork",
        icon = Icons.Rounded.AutoAwesome,
        onClick = onNavigateToAi
      )
      ActionTile(
        label = "Meds",
        icon = Icons.Rounded.Medication,
        onClick = onNavigateToMedications
      )
    }

    Spacer(modifier = Modifier.height(24.dp))

    // ── Health snapshot ─────────────────────────────────────────────────
    SectionHeader(title = "Health snapshot", action = "Profile")
    Spacer(modifier = Modifier.height(10.dp))

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      SnapshotCard(
        label = "Weight",
        icon = Icons.Rounded.Scale,
        value = formatWeight(uiState.patient?.weightKg ?: 68.5),
        unit = "kg",
        caption = "BMI ${uiState.patient?.bmi?.let { formatWeight(it) } ?: "23.2"} · ${uiState.patient?.bmiCategory ?: "Healthy"}",
        modifier = Modifier.weight(1f)
      )
      SnapshotCard(
        label = "Resting",
        icon = Icons.Rounded.MonitorHeart,
        value = uiState.restingHeartRateBpm.toString(),
        unit = "bpm",
        caption = "Normal resting range",
        modifier = Modifier.weight(1f)
      )
    }

    Spacer(modifier = Modifier.height(24.dp))

    // ── Recent records ──────────────────────────────────────────────────
    SectionHeader(
      title = "Recent records",
      action = "All records",
      onAction = onNavigateToRecords
    )
    Spacer(modifier = Modifier.height(10.dp))

    if (uiState.recentRecords.isEmpty()) {
      DorkCard(shape = DorkShapes.extraLarge, contentPadding = 16.dp, onClick = onNavigateToRecords) {
        Text(
          text = "No records yet · upload your first report",
          style = MaterialTheme.typography.bodySmall,
          color = DorkTheme.colors.textSecondary
        )
      }
    } else {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        uiState.recentRecords.forEach { record ->
          RecordRow(record = record, onClick = onNavigateToRecords)
        }
      }
    }

    Spacer(modifier = Modifier.height(20.dp))

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.Center,
      verticalAlignment = Alignment.CenterVertically
    ) {
      DorkTag(text = "Synthetic", tone = DorkTagTone.Lime)
      Spacer(modifier = Modifier.width(8.dp))
      Text(
        text = "Your clinician signs every clinical write.",
        style = MaterialTheme.typography.labelSmall,
        color = DorkTheme.colors.textTertiary
      )
    }

    Spacer(modifier = Modifier.height(8.dp))
  }
}

@Composable
private fun MetricCell(
  value: String,
  tag: String,
  caption: String,
  modifier: Modifier = Modifier
) {
  Column(modifier = modifier) {
    Row(verticalAlignment = Alignment.Bottom) {
      DotNumber(
        value = value,
        pitch = 4.4.dp,
        dotRadius = 1.2.dp,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.width(8.dp))
      DorkTag(
        text = tag,
        tone = DorkTagTone.Neutral,
        modifier = Modifier.padding(bottom = 4.dp)
      )
    }
    Spacer(modifier = Modifier.height(8.dp))
    Text(
      text = caption,
      style = MaterialTheme.typography.bodySmall,
      color = DorkTheme.colors.textTertiary,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis
    )
  }
}

@Composable
private fun ScoreCard(
  title: String,
  value: String,
  gradient: List<Color>,
  series: List<Float>,
  modifier: Modifier = Modifier,
  suffix: String? = null,
  caption: String,
  badge: String
) {
  Column(
    modifier = modifier
      .height(172.dp)
      .clip(DorkShapes.extraLarge)
      .background(Brush.linearGradient(colors = gradient))
      .padding(16.dp),
    verticalArrangement = Arrangement.SpaceBetween
  ) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      verticalAlignment = Alignment.Top
    ) {
      Text(
        text = title,
        style = DorkType.editorial,
        color = Color.White,
        maxLines = 1,
        modifier = Modifier.weight(1f)
      )
      Spacer(modifier = Modifier.width(4.dp))
      Surface(shape = DorkShapes.pill, color = Color.White.copy(alpha = 0.22f)) {
        Text(
          text = badge.uppercase(),
          style = MaterialTheme.typography.labelSmall,
          color = Color.White,
          maxLines = 1,
          softWrap = false,
          modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp)
        )
      }
    }

    Column {
      Row(verticalAlignment = Alignment.Bottom) {
        DotNumber(
          value = value,
          pitch = 4.2.dp,
          dotRadius = 1.0.dp,
          color = Color.White
        )
        if (suffix != null) {
          Text(
            text = suffix,
            style = DorkType.editorialSmall,
            color = Color.White.copy(alpha = 0.9f),
            modifier = Modifier.padding(start = 3.dp, bottom = 2.dp)
          )
        }
      }
      Spacer(modifier = Modifier.height(4.dp))
      Text(
        text = caption,
        style = DorkType.editorialSmall,
        color = Color.White.copy(alpha = 0.9f)
      )
    }

    DotSparkline(
      values = series,
      color = Color.White,
      dotRadius = 2.1.dp,
      modifier = Modifier
        .fillMaxWidth()
        .height(26.dp)
    )
  }
}

@Composable
private fun DayTimeline(modifier: Modifier = Modifier) {
  Canvas(modifier = modifier.height(34.dp)) {
    val centerY = size.height / 2f
    val dotRadius = 3.4.dp.toPx()

    drawLine(
      color = Color(0xFFE4E2DE),
      start = Offset(0f, centerY),
      end = Offset(size.width, centerY),
      strokeWidth = 1.dp.toPx()
    )

    val events = listOf(
      0.10f to DorkColors.SageInk,
      0.28f to DorkColors.PeachInk,
      0.46f to DorkColors.AccentInk,
      0.64f to DorkColors.PinkInk,
      0.84f to DorkColors.SageInk
    )

    events.forEach { (fraction, color) ->
      val center = Offset(fraction * size.width, centerY)
      drawCircle(color = Color.White, radius = dotRadius + 2.2.dp.toPx(), center = center)
      drawCircle(color = color, radius = dotRadius, center = center)
    }

    drawCircle(
      color = DorkColors.Lime,
      radius = dotRadius + 1.2.dp.toPx(),
      center = Offset(0.55f * size.width, centerY)
    )
  }
}

@Composable
private fun SectionHeader(
  title: String,
  action: String? = null,
  onAction: (() -> Unit)? = null
) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically
  ) {
    Text(
      text = title,
      style = MaterialTheme.typography.titleMedium,
      color = DorkTheme.colors.textPrimary
    )
    if (action != null) {
      Text(
        text = action,
        style = MaterialTheme.typography.labelMedium,
        color = DorkTheme.colors.textSecondary,
        modifier = Modifier
          .clip(DorkShapes.pill)
          .clickable(enabled = onAction != null) { onAction?.invoke() }
          .background(DorkTheme.colors.card)
          .padding(horizontal = 10.dp, vertical = 5.dp)
      )
    }
  }
}

@Composable
private fun CircleIconButton(
  icon: ImageVector,
  contentDescription: String
) {
  Surface(
    shape = CircleShape,
    color = DorkTheme.colors.card,
    modifier = Modifier
      .size(38.dp)
      .clickable { }
  ) {
    Box(contentAlignment = Alignment.Center) {
      Icon(
        imageVector = icon,
        contentDescription = contentDescription,
        tint = DorkTheme.colors.textSecondary,
        modifier = Modifier.size(17.dp)
      )
    }
  }
}

@Composable
private fun ChevronCircle() {
  Box(
    modifier = Modifier
      .size(28.dp)
      .clip(CircleShape)
      .background(DorkTheme.colors.surfaceSecondary),
    contentAlignment = Alignment.Center
  ) {
    Icon(
      imageVector = Icons.Rounded.ChevronRight,
      contentDescription = null,
      tint = DorkTheme.colors.textTertiary,
      modifier = Modifier.size(14.dp)
    )
  }
}

@Composable
private fun MetaLine(
  icon: ImageVector,
  text: String,
  modifier: Modifier = Modifier
) {
  Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
    Icon(
      imageVector = icon,
      contentDescription = null,
      tint = DorkTheme.colors.textTertiary,
      modifier = Modifier.size(13.dp)
    )
    Spacer(modifier = Modifier.width(5.dp))
    Text(
      text = text,
      style = MaterialTheme.typography.labelMedium,
      color = DorkTheme.colors.textSecondary,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis
    )
  }
}

@Composable
private fun SmallPillButton(
  text: String,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  filled: Boolean = false,
  icon: ImageVector? = null
) {
  Row(
    modifier = modifier
      .clip(DorkShapes.pill)
      .clickable(onClick = onClick)
      .background(if (filled) DorkTheme.colors.textPrimary else DorkTheme.colors.surfaceSecondary)
      .padding(horizontal = 14.dp, vertical = 9.dp),
    horizontalArrangement = Arrangement.Center,
    verticalAlignment = Alignment.CenterVertically
  ) {
    if (icon != null) {
      Icon(
        imageVector = icon,
        contentDescription = null,
        tint = if (filled) Color.White else DorkTheme.colors.textSecondary,
        modifier = Modifier.size(13.dp)
      )
      Spacer(modifier = Modifier.width(5.dp))
    }
    Text(
      text = text,
      style = MaterialTheme.typography.labelMedium,
      color = if (filled) Color.White else DorkTheme.colors.textSecondary
    )
  }
}

@Composable
private fun ActionTile(
  label: String,
  icon: ImageVector,
  onClick: () -> Unit
) {
  Column(
    horizontalAlignment = Alignment.CenterHorizontally,
    modifier = Modifier
      .clip(DorkShapes.large)
      .clickable(onClick = onClick)
      .padding(horizontal = 4.dp, vertical = 2.dp)
  ) {
    Surface(
      shape = CircleShape,
      color = DorkTheme.colors.card,
      modifier = Modifier.size(56.dp)
    ) {
      Box(contentAlignment = Alignment.Center) {
        Icon(
          imageVector = icon,
          contentDescription = label,
          tint = DorkTheme.colors.textPrimary,
          modifier = Modifier.size(20.dp)
        )
      }
    }
    Spacer(modifier = Modifier.height(8.dp))
    Text(
      text = label,
      style = MaterialTheme.typography.labelSmall,
      color = DorkTheme.colors.textSecondary
    )
  }
}

@Composable
private fun SnapshotCard(
  label: String,
  icon: ImageVector,
  value: String,
  unit: String,
  caption: String,
  modifier: Modifier = Modifier
) {
  DorkCard(
    modifier = modifier,
    shape = DorkShapes.extraLarge,
    contentPadding = 16.dp
  ) {
    Column {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
          imageVector = icon,
          contentDescription = null,
          tint = DorkTheme.colors.textTertiary,
          modifier = Modifier.size(13.dp)
        )
        Spacer(modifier = Modifier.width(5.dp))
        Text(
          text = label,
          style = DorkType.eyebrow,
          color = DorkTheme.colors.textTertiary
        )
      }

      Spacer(modifier = Modifier.height(12.dp))

      Row(verticalAlignment = Alignment.Bottom) {
        DotNumber(
          value = value,
          pitch = 3.2.dp,
          dotRadius = 0.95.dp,
          color = DorkTheme.colors.textPrimary
        )
        Spacer(modifier = Modifier.width(5.dp))
        Text(
          text = unit,
          style = DorkType.mono,
          color = DorkTheme.colors.textTertiary,
          modifier = Modifier.padding(bottom = 2.dp)
        )
      }

      Spacer(modifier = Modifier.height(6.dp))
      Text(
        text = caption,
        style = MaterialTheme.typography.labelSmall,
        color = DorkTheme.colors.textTertiary,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
      )
    }
  }
}

@Composable
private fun RecordRow(
  record: HealthRecordItem,
  onClick: () -> Unit
) {
  DorkCard(
    shape = DorkShapes.large,
    contentPadding = 14.dp,
    onClick = onClick
  ) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      Box(
        modifier = Modifier
          .size(38.dp)
          .clip(CircleShape)
          .background(DorkTheme.colors.surfaceSecondary),
        contentAlignment = Alignment.Center
      ) {
        Icon(
          imageVector = Icons.Rounded.Description,
          contentDescription = null,
          tint = DorkTheme.colors.textSecondary,
          modifier = Modifier.size(17.dp)
        )
      }
      Spacer(modifier = Modifier.width(11.dp))
      Column(modifier = Modifier.weight(1f)) {
        Text(
          text = record.title,
          style = MaterialTheme.typography.titleSmall,
          color = DorkTheme.colors.textPrimary,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
        Text(
          text = "${record.doctorOrLab} · ${record.displayDate}",
          style = MaterialTheme.typography.labelSmall,
          color = DorkTheme.colors.textTertiary,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis
        )
      }
      DorkTag(text = recordTypeLabel(record), tone = DorkTagTone.Neutral)
    }
  }
}

private fun recordTypeLabel(record: HealthRecordItem): String = when (record.type.name) {
  "CONSULTATION" -> "Visit"
  "LAB_RESULT" -> "Lab"
  "PRESCRIPTION" -> "Rx"
  "DIAGNOSTIC_REPORT" -> "Report"
  "DOCUMENT" -> "Doc"
  "OBSERVATION" -> "Obs"
  else -> "Record"
}

private fun formatWeight(value: Double): String {
  val rounded = (value * 10).roundToInt() / 10.0
  return if (rounded % 1.0 == 0.0) rounded.toInt().toString() else rounded.toString()
}
