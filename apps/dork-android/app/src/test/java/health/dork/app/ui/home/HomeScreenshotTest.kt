package health.dork.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import health.dork.app.core.data.model.AppointmentItem
import health.dork.app.core.data.model.BiologicalSex
import health.dork.app.core.data.model.BloodGroup
import health.dork.app.core.data.model.ConsultationType
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.HealthRecordType
import health.dork.app.core.data.model.LoopStage
import health.dork.app.core.data.model.MedicationDose
import health.dork.app.core.data.model.NextAction
import health.dork.app.core.data.model.NextActionKind
import health.dork.app.core.data.model.NextActionUrgency
import health.dork.app.core.data.model.PatientProfile
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.loop.CareLoopState
import health.dork.app.core.designsystem.components.AppointmentStatus
import health.dork.app.core.designsystem.components.MedicationDoseState
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.time.LocalDate

/**
 * Renders the home surface off-device so the editorial layout can be inspected
 * without an emulator.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xhdpi")
class HomeScreenshotTest {

  @get:Rule
  val composeRule = createComposeRule()

  @Test
  fun homeSurface() {
    composeRule.setContent {
      DorkTheme(darkTheme = false) {
        HomeContent(
          uiState = sampleState(),
          onCheckIn = {},
          onDoseTaken = {},
          onDoseSkipped = {},
          onNavigateToCare = {},
          onNavigateToRecords = {},
          onNavigateToAi = {},
          onNavigateToMedications = {},
          onAppointmentClick = {},
          onProfileClick = {}
        )
      }
    }

    composeRule.onRoot().captureRoboImage("build/outputs/roborazzi/home.png")
  }

  @Test
  fun homeWithTabBar() {
    composeRule.setContent {
      DorkTheme(darkTheme = false) {
        androidx.compose.material3.Scaffold(
          containerColor = health.dork.app.core.designsystem.DorkColors.LightBackground,
          bottomBar = {
            health.dork.app.core.designsystem.components.DorkBottomNavigation(
              currentDestination = health.dork.app.core.designsystem.components.DorkNavDestination.Home,
              onNavigate = {}
            )
          }
        ) { paddingValues ->
          HomeContent(
            uiState = sampleState(),
            onCheckIn = {},
            onDoseTaken = {},
            onDoseSkipped = {},
            onNavigateToCare = {},
            onNavigateToRecords = {},
            onNavigateToAi = {},
            onNavigateToMedications = {},
            onAppointmentClick = {},
            onProfileClick = {},
            modifier = androidx.compose.ui.Modifier.padding(paddingValues)
          )
        }
      }
    }

    composeRule.onRoot().captureRoboImage("build/outputs/roborazzi/home-tabbar.png")
  }

  @Test
  fun tabBarOnly() {
    composeRule.setContent {
      DorkTheme(darkTheme = false) {
        androidx.compose.foundation.layout.Box(
          modifier = androidx.compose.ui.Modifier
            .fillMaxSize()
            .background(health.dork.app.core.designsystem.DorkColors.LightBackground),
          contentAlignment = androidx.compose.ui.Alignment.BottomCenter
        ) {
          health.dork.app.core.designsystem.components.DorkBottomNavigation(
            currentDestination = health.dork.app.core.designsystem.components.DorkNavDestination.Home,
            onNavigate = {}
          )
        }
      }
    }
    composeRule.onRoot().captureRoboImage("build/outputs/roborazzi/tabbar.png")
  }

  private fun sampleState(): HomeUiState {
    val today = LocalDate.now()

    val patient = PatientProfile(
      id = "patient-primary",
      fullName = "Amara Okafor",
      email = "amara@example.com",
      phone = "+1 415 555 0134",
      birthDate = "1988-04-12",
      sex = BiologicalSex.FEMALE,
      bloodGroup = BloodGroup.O_POS,
      heightCm = 168.0,
      weightKg = 64.5,
      conditions = listOf("Hypertension"),
      allergies = listOf("Penicillin")
    )

    val appointment = AppointmentItem(
      id = "appt-1",
      doctorId = "dr-chen",
      doctorName = "Dr. Sarah Chen",
      specialty = "Cardiology",
      dateTimeString = "Today · 4:30 PM",
      dateIso = today.atTime(16, 30).toString(),
      clinicLocation = "Sunrise Clinic · Suite 4",
      consultationType = ConsultationType.IN_PERSON,
      status = AppointmentStatus.Confirmed,
      reasonForVisit = "Blood pressure review and medication check"
    )

    val dose = MedicationDose(
      id = "dose-1",
      medicationId = "med-1",
      name = "Lisinopril",
      dosage = "10 mg",
      scheduledTime = "8:00 PM",
      dateIso = today.toString(),
      state = MedicationDoseState.Due,
      instructions = "Take with water, after dinner",
      prescribingDoctor = "Dr. Sarah Chen"
    )

    val doses = listOf(
      dose.copy(id = "dose-0a", scheduledTime = "8:00 AM", state = MedicationDoseState.Taken, takenAtTimestamp = 1L),
      dose.copy(id = "dose-0b", scheduledTime = "2:00 PM", state = MedicationDoseState.Taken, takenAtTimestamp = 2L),
      dose
    )

    val records = listOf(
      HealthRecordItem(
        id = "rec-1",
        type = HealthRecordType.LAB_RESULT,
        title = "Lipid panel",
        subtitle = "All values within range",
        dateIso = "2026-10-20",
        displayDate = "20 Oct",
        doctorOrLab = "Sunrise Labs",
        summary = "LDL 96 mg/dL"
      ),
      HealthRecordItem(
        id = "rec-2",
        type = HealthRecordType.CONSULTATION,
        title = "Cardiology follow-up",
        subtitle = "Stable, continue current plan",
        dateIso = "2026-10-12",
        displayDate = "12 Oct",
        doctorOrLab = "Dr. Sarah Chen",
        summary = "BP 124/78"
      ),
      HealthRecordItem(
        id = "rec-3",
        type = HealthRecordType.PRESCRIPTION,
        title = "Lisinopril refill",
        subtitle = "90 day supply",
        dateIso = "2026-10-02",
        displayDate = "2 Oct",
        doctorOrLab = "Dr. Sarah Chen",
        summary = "10 mg daily"
      )
    )

    return HomeUiState(
      patient = patient,
      nextAppointment = appointment,
      nextDose = dose,
      todayAppointments = listOf(appointment),
      todayDoses = doses,
      recentRecords = records,
      checkInStatus = "Feeling good",
      todayAppointmentCount = 1,
      todayDoseCount = 3,
      takenDoseCount = 2,
      skippedDoseCount = 0,
      isDemoMode = true,
      loop = CareLoopState(
        stage = LoopStage.PREPARE,
        nextAction = NextAction(
          kind = NextActionKind.COMPLETE_INTAKE,
          headline = "Prepare for Dr. Sarah Chen",
          supporting = "Today · 4:30 PM. Two minutes now saves ten at the desk.",
          ctaLabel = "Start check-in",
          urgency = NextActionUrgency.TODAY,
          reason = "Pre-visit intake is incomplete",
          appointmentId = appointment.id
        ),
        upcomingAppointment = appointment,
        daysToAppointment = 0,
        openFollowUp = null,
        intakeForUpcoming = null
      ),
      isLoading = false
    )
  }
}
