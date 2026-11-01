package health.dork.app.ui.home

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.CalendarToday
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.MedicalServices
import androidx.compose.material.icons.rounded.Medication
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.Scale
import androidx.compose.material.icons.rounded.Upload
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.LoopStage
import health.dork.app.core.data.model.NextAction
import health.dork.app.core.data.model.NextActionKind
import health.dork.app.core.data.model.NextActionUrgency
import health.dork.app.core.data.util.DateCalculators
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
import health.dork.app.core.designsystem.components.MedicationDoseState
import kotlin.math.roundToInt
import java.time.LocalDateTime
import java.time.LocalTime

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
  onProfileClick: () -> Unit,
  onNextAction: (NextAction) -> Unit = {},
  onNavigateToChat: () -> Unit = {},
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
    onDoseTaken = viewModel::markDoseTaken,
    onDoseSkipped = viewModel::skipDose,
    onNavigateToCare = onNavigateToCare,
    onNavigateToRecords = onNavigateToRecords,
    onNavigateToAi = onNavigateToAi,
    onNavigateToMedications = onNavigateToMedications,
    onAppointmentClick = onAppointmentClick,
    onProfileClick = onProfileClick,
    onNextAction = { action ->
      if (!viewModel.performInPlace(action)) onNextAction(action)
    },
    onNavigateToChat = onNavigateToChat,
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
  onProfileClick: () -> Unit,
  onNextAction: (NextAction) -> Unit = {},
  onNavigateToChat: () -> Unit = {},
  modifier: Modifier = Modifier
) {
  val scrollState = rememberScrollState()
  var showReminders by remember { mutableStateOf(false) }

  val patientName = uiState.patient?.fullName?.split(" ")?.firstOrNull() ?: "there"
  val nextAppointment = uiState.nextAppointment
  val nextDose = uiState.nextDose

  val adherence = if (uiState.todayDoseCount > 0) {
    (uiState.takenDoseCount * 100) / uiState.todayDoseCount
  } else {
    0
  }

  val greeting = when (LocalTime.now().hour) {
    in 5..11 -> "GOOD MORNING"
    in 12..17 -> "GOOD AFTERNOON"
    else -> "GOOD EVENING"
  }

  val timelineEvents = buildList {
    uiState.todayDoses.forEach { dose ->
      DateCalculators.parseClinicTime(dose.scheduledTime)?.let { time ->
        add(
          TimelineEvent(
            fraction = time.toSecondOfDay() / 86_400f,
            color = when (dose.state) {
              MedicationDoseState.Taken, MedicationDoseState.Completed -> DorkColors.SageInk
              MedicationDoseState.Skipped -> DorkColors.TextTertiaryLight
              MedicationDoseState.Due -> DorkColors.PeachInk
              MedicationDoseState.Upcoming -> DorkColors.AccentInk
            }
          )
        )
      }
    }
    uiState.todayAppointments.forEach { appointment ->
      runCatching { LocalDateTime.parse(appointment.dateIso).toLocalTime() }.getOrNull()?.let { time ->
        add(TimelineEvent(time.toSecondOfDay() / 86_400f, DorkColors.PinkInk))
      }
    }
  }.sortedBy { it.fraction }

  val doseSeries = doseSeries(uiState.todayDoses)
  val adherenceSeries = adherenceSeries(uiState.todayDoses)

  val dayTimes = buildList {
    uiState.todayDoses.forEach { dose ->
      DateCalculators.parseClinicTime(dose.scheduledTime)?.let(::add)
    }
    uiState.todayAppointments.forEach { appointment ->
      runCatching { LocalDateTime.parse(appointment.dateIso).toLocalTime() }
        .getOrNull()?.let(::add)
    }
  }.sorted()

  val axisTimes = if (dayTimes.isEmpty()) {
    listOf(LocalTime.of(8, 0), LocalTime.of(13, 0), LocalTime.of(20, 0))
  } else {
    listOf(
      dayTimes.first(),
      dayTimes[dayTimes.size / 2],
      dayTimes.last()
    ).distinct()
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
          contentDescription = "Reminders",
          showIndicator = uiState.todayDoseCount > uiState.takenDoseCount || uiState.todayAppointments.isNotEmpty(),
          onClick = { showReminders = true }
        )
        Box(
          modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(DorkTheme.colors.textPrimary)
            .clickable(onClick = onProfileClick),
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
      text = greeting,
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
        if (uiState.todayAppointmentCount == 0) {
          append("No visits today")
        } else {
          append(uiState.todayAppointmentCount)
          append(if (uiState.todayAppointmentCount == 1) " visit" else " visits")
          append(" today")
        }
        append(" · ")
        append(uiState.todayDoseCount)
        append(if (uiState.todayDoseCount == 1) " dose" else " doses")
        append(" scheduled.")
      },
      style = MaterialTheme.typography.bodyMedium,
      color = DorkTheme.colors.textSecondary
    )

    Spacer(modifier = Modifier.height(24.dp))

    // ── Next step (the loop's single decision) ──────────────────────────
    uiState.nextAction?.let { action ->
      NextStepCard(
        action = action,
        onAction = { onNextAction(action) }
      )
      Spacer(modifier = Modifier.height(14.dp))
      uiState.loop?.let { loop ->
        LoopStrip(stage = loop.stage)
      }
      Spacer(modifier = Modifier.height(22.dp))
    }

    // ── Metric grid ─────────────────────────────────────────────────────
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
      MetricCell(
        value = uiState.todayAppointmentCount.toString(),
        tag = "Visits",
        caption = nextAppointment?.displayDateTime ?: "Nothing booked",
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
        value = uiState.takenDoseCount.toString(),
        tag = "Taken",
        caption = if (uiState.todayDoseCount == 0) "No doses due" else "$adherence% of today",
        modifier = Modifier.weight(1f)
      )
      MetricCell(
        value = "Dr. Chen",
        tag = "Care Team",
        caption = "Active Clinic",
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
        title = "Doses",
        value = "${uiState.takenDoseCount}/${uiState.todayDoseCount}",
        caption = when {
          uiState.todayDoseCount == 0 -> "Nothing scheduled"
          uiState.takenDoseCount >= uiState.todayDoseCount -> "All taken"
          else -> "${uiState.todayDoseCount - uiState.takenDoseCount} left today"
        },
        series = doseSeries,
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
        caption = "Taken today",
        series = adherenceSeries,
        gradient = listOf(
          DorkColors.GradientEmberStart,
          DorkColors.GradientEmberMid,
          DorkColors.GradientEmberAccent,
          DorkColors.GradientEmberEnd
        ),
        badge = "Today",
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

        DayTimeline(
          events = timelineEvents,
          nowFraction = LocalTime.now().toSecondOfDay() / 86_400f,
          modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(8.dp))

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.SpaceBetween
        ) {
          axisTimes.forEach { time ->
            Text(
              text = DateCalculators.formatTimeOfDay(time),
              style = DorkType.mono,
              color = DorkTheme.colors.textTertiary
            )
          }
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
              text = nextAppointment.displayDateTime,
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
    if (nextDose != null && uiState.medicationRemindersEnabled) {
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
        label = "Chat",
        icon = Icons.Rounded.Forum,
        onClick = onNavigateToChat
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

    // ── Health snapshot ──────────────────────────────────────────────────
    SectionHeader(title = "Health snapshot", action = "Profile")
    Spacer(modifier = Modifier.height(10.dp))

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
      SnapshotCard(
        label = "Weight",
        icon = Icons.Rounded.Scale,
        value = uiState.patient?.let { formatWeight(it.weightKg) } ?: "—",
        unit = if (uiState.patient != null) "kg" else "",
        caption = uiState.patient?.let { patient ->
          patient.bmi?.let { bmi -> "BMI ${formatWeight(bmi)} · ${patient.bmiCategory}" }
        } ?: "Not recorded",
        modifier = Modifier.weight(1f)
      )
      SnapshotCard(
        label = "Adherence",
        icon = Icons.Rounded.Check,
        value = adherence.toString(),
        unit = "%",
        caption = "${uiState.takenDoseCount} of ${uiState.todayDoseCount} taken today",
        modifier = Modifier.weight(1f)
      )
    }

    Spacer(modifier = Modifier.height(24.dp))

    // ── Clinic Messenger ──────────────────────────────────────────────────
    SectionHeader(
      title = "Care team messenger",
      action = "Open chat",
      onAction = onNavigateToChat
    )
    Spacer(modifier = Modifier.height(10.dp))

    ClinicMessengerCard(
      doctorName = uiState.clinicDoctorName,
      specialty = uiState.clinicSpecialty,
      latestMessage = uiState.latestClinicMessage,
      timestamp = uiState.latestClinicMessageTime,
      unreadCount = uiState.clinicMessageUnreadCount,
      onClick = onNavigateToChat
    )

    Spacer(modifier = Modifier.height(20.dp))

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.Center,
      verticalAlignment = Alignment.CenterVertically
    ) {
      DorkTag(
        text = if (uiState.isDemoMode) "Synthetic" else "On-device",
        tone = DorkTagTone.Lime
      )
      Spacer(modifier = Modifier.width(8.dp))
      Text(
        text = if (uiState.isDemoMode) {
          "Fictional record for evaluation."
        } else {
          "Your data stays on this device."
        },
        style = MaterialTheme.typography.labelSmall,
        color = DorkTheme.colors.textTertiary
      )
    }

    Spacer(modifier = Modifier.height(8.dp))
  }

  if (showReminders) {
    RemindersSheet(
      uiState = uiState,
      onDismiss = { showReminders = false },
      onNavigateToCare = {
        showReminders = false
        onNavigateToCare()
      },
      onNavigateToMedications = {
        showReminders = false
        onNavigateToMedications()
      }
    )
  }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun RemindersSheet(
  uiState: HomeUiState,
  onDismiss: () -> Unit,
  onNavigateToCare: () -> Unit,
  onNavigateToMedications: () -> Unit
) {
  val dueDoses = uiState.todayDoses.filter {
    it.state == MedicationDoseState.Due || it.state == MedicationDoseState.Upcoming
  }
  val hasAnything = uiState.todayAppointments.isNotEmpty() ||
    dueDoses.isNotEmpty() ||
    uiState.recentRecords.isNotEmpty()

  ModalBottomSheet(onDismissRequest = onDismiss) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = DorkSpacing.screenHorizontalPadding)
        .padding(bottom = 28.dp)
    ) {
      Text(
        text = "Today",
        style = MaterialTheme.typography.headlineMedium,
        color = DorkTheme.colors.textPrimary
      )
      Spacer(modifier = Modifier.height(4.dp))
      Text(
        text = "In-app reminders only. This build does not post system notifications.",
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textSecondary
      )

      Spacer(modifier = Modifier.height(16.dp))

      if (!hasAnything) {
        Text(
          text = "Nothing is scheduled today.",
          style = MaterialTheme.typography.bodyMedium,
          color = DorkTheme.colors.textSecondary
        )
      }

      uiState.todayAppointments.forEach { appointment ->
        ReminderRow(
          icon = Icons.Rounded.CalendarToday,
          title = appointment.doctorName,
          subtitle = "${appointment.displayDateTime} · ${appointment.clinicLocation}"
        )
      }

      dueDoses.forEach { dose ->
        ReminderRow(
          icon = Icons.Rounded.Medication,
          title = "${dose.name} · ${dose.dosage}",
          subtitle = "${dose.scheduledTime} · ${dose.state.name.lowercase()}"
        )
      }

      if (uiState.todayAppointments.isNotEmpty()) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
          text = "Open care",
          style = MaterialTheme.typography.labelLarge,
          color = MaterialTheme.colorScheme.primary,
          modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onNavigateToCare)
            .padding(vertical = 10.dp)
        )
      }

      if (dueDoses.isNotEmpty()) {
        Text(
          text = "Open medication schedule",
          style = MaterialTheme.typography.labelLarge,
          color = MaterialTheme.colorScheme.primary,
          modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onNavigateToMedications)
            .padding(vertical = 10.dp)
        )
      }
    }
  }
}

@Composable
private fun ReminderRow(
  icon: ImageVector,
  title: String,
  subtitle: String
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(vertical = 8.dp),
    verticalAlignment = Alignment.CenterVertically
  ) {
    Box(
      modifier = Modifier
        .size(34.dp)
        .clip(CircleShape)
        .background(DorkTheme.colors.surfaceSecondary),
      contentAlignment = Alignment.Center
    ) {
      Icon(
        imageVector = icon,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.size(17.dp)
      )
    }
    Spacer(modifier = Modifier.width(12.dp))
    Column(modifier = Modifier.weight(1f)) {
      Text(
        text = title,
        style = MaterialTheme.typography.titleSmall,
        color = DorkTheme.colors.textPrimary
      )
      Text(
        text = subtitle,
        style = MaterialTheme.typography.bodySmall,
        color = DorkTheme.colors.textSecondary
      )
    }
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

private data class TimelineEvent(
  val fraction: Float,
  val color: Color
)

@Composable
private fun DayTimeline(
  events: List<TimelineEvent>,
  nowFraction: Float,
  modifier: Modifier = Modifier
) {
  Canvas(modifier = modifier.height(34.dp)) {
    val centerY = size.height / 2f
    val dotRadius = 3.4.dp.toPx()

    drawLine(
      color = Color(0xFFE4E2DE),
      start = Offset(0f, centerY),
      end = Offset(size.width, centerY),
      strokeWidth = 1.dp.toPx()
    )

    events.forEach { event ->
      val center = Offset(event.fraction.coerceIn(0.02f, 0.98f) * size.width, centerY)
      drawCircle(color = Color.White, radius = dotRadius + 2.2.dp.toPx(), center = center)
      drawCircle(color = event.color, radius = dotRadius, center = center)
    }

    // The now marker is always shown so the day reads as a live instrument.
    drawCircle(
      color = DorkColors.Lime,
      radius = dotRadius + 1.2.dp.toPx(),
      center = Offset(nowFraction.coerceIn(0.02f, 0.98f) * size.width, centerY)
    )
  }
}

private fun isDoseTaken(dose: MedicationDose): Boolean =
  dose.state == MedicationDoseState.Taken || dose.state == MedicationDoseState.Completed

private fun doseSeries(doses: List<MedicationDose>): List<Float> {
  if (doses.isEmpty()) return listOf(0.12f, 0.12f)
  val values = doses.map { dose ->
    when (dose.state) {
      MedicationDoseState.Taken, MedicationDoseState.Completed -> 0.92f
      MedicationDoseState.Skipped -> 0.25f
      MedicationDoseState.Due -> 0.55f
      MedicationDoseState.Upcoming -> 0.35f
    }
  }
  return if (values.size >= 2) values else values + values
}

private fun adherenceSeries(doses: List<MedicationDose>): List<Float> {
  if (doses.isEmpty()) return listOf(0.12f, 0.12f)
  var taken = 0
  val running = doses.mapIndexed { index, dose ->
    if (isDoseTaken(dose)) taken++
    taken.toFloat() / (index + 1).toFloat()
  }
  return if (running.size >= 2) running else running + running
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
  contentDescription: String,
  onClick: () -> Unit,
  showIndicator: Boolean = false
) {
  Box {
    Surface(
      shape = CircleShape,
      color = DorkTheme.colors.card,
      modifier = Modifier
        .size(38.dp)
        .clickable(onClick = onClick)
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
    if (showIndicator) {
      Box(
        modifier = Modifier
          .align(Alignment.TopEnd)
          .size(9.dp)
          .clip(CircleShape)
          .background(DorkTheme.colors.lime)
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
private fun ClinicMessengerCard(
  doctorName: String,
  specialty: String,
  latestMessage: String,
  timestamp: String,
  unreadCount: Int,
  onClick: () -> Unit
) {
  DorkCard(
    shape = DorkShapes.extraLarge,
    contentPadding = 18.dp,
    onClick = onClick,
    modifier = Modifier.fillMaxWidth()
  ) {
    Column(modifier = Modifier.fillMaxWidth()) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
          Box(contentAlignment = Alignment.BottomEnd) {
            Box(
              modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(DorkTheme.colors.surfaceSecondary),
              contentAlignment = Alignment.Center
            ) {
              Text(
                text = "SC",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
              )
            }
            Box(
              modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(Color(0xFF22C55E))
                .border(2.dp, MaterialTheme.colorScheme.surface, CircleShape)
            )
          }

          Column {
            Row(
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
              Text(
                text = doctorName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = DorkTheme.colors.textPrimary
              )
              DorkTag(text = "Clinic", tone = DorkTagTone.Sage)
            }
            Text(
              text = specialty,
              style = MaterialTheme.typography.bodySmall,
              color = DorkTheme.colors.textSecondary
            )
          }
        }

        if (unreadCount > 0) {
          Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(22.dp)
          ) {
            Box(contentAlignment = Alignment.Center) {
              Text(
                text = unreadCount.toString(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimary,
                fontWeight = FontWeight.Bold
              )
            }
          }
        }
      }

      Spacer(modifier = Modifier.height(14.dp))

      Surface(
        shape = RoundedCornerShape(14.dp),
        color = DorkTheme.colors.surfaceSecondary,
        modifier = Modifier.fillMaxWidth()
      ) {
        Column(modifier = Modifier.padding(12.dp)) {
          Text(
            text = latestMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = DorkTheme.colors.textPrimary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
          )
        }
      }

      Spacer(modifier = Modifier.height(12.dp))

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
      ) {
        Text(
          text = "Received today · $timestamp",
          style = MaterialTheme.typography.labelSmall,
          color = DorkTheme.colors.textTertiary
        )

        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
          Text(
            text = "Reply to clinic",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary
          )
          Icon(
            imageVector = Icons.Rounded.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(16.dp)
          )
        }
      }
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

// ---------------------------------------------------------------------------
// The loop: one decision, and where it sits on the path
// ---------------------------------------------------------------------------

/**
 * The hero of the home screen.
 *
 * Deliberately a single action with a single button. The app's value is not how
 * much it shows, it is that the patient never has to work out what matters next.
 * Rendered in ink with a lime action so it reads as the loudest object on a page
 * of quiet cards.
 */
@Composable
private fun NextStepCard(action: NextAction, onAction: () -> Unit) {
  val isClear = action.kind == NextActionKind.ALL_CLEAR
  val background = if (isClear) DorkTheme.colors.card else DorkTheme.colors.textPrimary
  val titleColor = if (isClear) DorkTheme.colors.textPrimary else Color.White
  val bodyColor = if (isClear) DorkTheme.colors.textSecondary else Color.White.copy(alpha = 0.72f)

  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = DorkShapes.hero,
    color = background
  ) {
    Column(modifier = Modifier.padding(22.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
          modifier = Modifier
            .size(6.dp)
            .clip(CircleShape)
            .background(urgencyColor(action.urgency, isClear))
        )
        Spacer(modifier = Modifier.width(7.dp))
        Text(
          text = "NEXT STEP",
          style = DorkType.eyebrow,
          color = if (isClear) DorkTheme.colors.textTertiary else Color.White.copy(alpha = 0.6f)
        )
      }

      Spacer(modifier = Modifier.height(10.dp))

      Text(
        text = action.headline,
        style = MaterialTheme.typography.headlineMedium,
        color = titleColor
      )

      Spacer(modifier = Modifier.height(6.dp))

      Text(
        text = action.supporting,
        style = MaterialTheme.typography.bodySmall,
        color = bodyColor
      )

      Spacer(modifier = Modifier.height(16.dp))

      Surface(
        onClick = onAction,
        shape = DorkShapes.pill,
        color = if (isClear) DorkTheme.colors.surfaceSecondary else DorkTheme.colors.lime
      ) {
        Row(
          modifier = Modifier.padding(horizontal = 18.dp, vertical = 11.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Text(
            text = action.ctaLabel,
            style = MaterialTheme.typography.labelLarge,
            color = if (isClear) DorkTheme.colors.textPrimary else DorkTheme.colors.limeInk
          )
          Spacer(modifier = Modifier.width(6.dp))
          Icon(
            imageVector = Icons.Rounded.ChevronRight,
            contentDescription = null,
            tint = if (isClear) DorkTheme.colors.textPrimary else DorkTheme.colors.limeInk,
            modifier = Modifier.size(16.dp)
          )
        }
      }
    }
  }
}

@Composable
private fun LoopStrip(stage: LoopStage) {
  val stages = LoopStage.entries
  val currentIndex = stages.indexOf(stage)
  val trackColor = DorkTheme.colors.surfaceBorder
  val progressColor = DorkTheme.colors.textTertiary

  Column(modifier = Modifier.fillMaxWidth()) {
    Box(modifier = Modifier.fillMaxWidth().height(18.dp)) {
      // The track is drawn behind the dots so the four stages read as one
      // continuous path instead of four labels with uneven gaps between them.
      Canvas(modifier = Modifier.fillMaxSize()) {
        val inset = size.width / (stages.size * 2f)
        val y = size.height / 2f
        drawLine(
          color = trackColor,
          start = Offset(inset, y),
          end = Offset(size.width - inset, y),
          strokeWidth = 1.dp.toPx()
        )
        if (currentIndex > 0) {
          val progress = inset + (size.width - inset * 2f) *
            (currentIndex / (stages.size - 1f))
          drawLine(
            color = progressColor,
            start = Offset(inset, y),
            end = Offset(progress, y),
            strokeWidth = 1.5.dp.toPx()
          )
        }
      }

      Row(
        modifier = Modifier.fillMaxSize(),
        verticalAlignment = Alignment.CenterVertically
      ) {
        stages.forEachIndexed { index, _ ->
          Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
            Box(
              modifier = Modifier
                .size(if (index == currentIndex) 9.dp else 6.dp)
                .clip(CircleShape)
                .background(
                  when {
                    index == currentIndex -> DorkTheme.colors.textPrimary
                    index < currentIndex -> DorkTheme.colors.textTertiary
                    else -> DorkTheme.colors.surfaceBorder
                  }
                )
            )
          }
        }
      }
    }

    Spacer(modifier = Modifier.height(6.dp))

    Row(modifier = Modifier.fillMaxWidth()) {
      stages.forEachIndexed { index, item ->
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.TopCenter) {
          Text(
            text = item.label,
            style = MaterialTheme.typography.labelSmall,
            color = when {
              index == currentIndex -> DorkTheme.colors.textPrimary
              index < currentIndex -> DorkTheme.colors.textTertiary
              else -> DorkTheme.colors.textTertiary.copy(alpha = 0.7f)
            },
            maxLines = 1,
            softWrap = false
          )
        }
      }
    }
  }
}

@Composable
private fun urgencyColor(urgency: NextActionUrgency, isClear: Boolean): Color = when {
  isClear -> DorkTheme.colors.success
  urgency == NextActionUrgency.NOW -> DorkColors.GradientPinkEnd
  urgency == NextActionUrgency.TODAY -> DorkColors.GradientEmberAccent
  else -> DorkTheme.colors.lime
}
