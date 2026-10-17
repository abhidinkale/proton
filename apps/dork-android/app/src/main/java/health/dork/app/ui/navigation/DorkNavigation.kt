package health.dork.app.ui.navigation

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import health.dork.app.core.data.AppContainer
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.repository.AuthState
import health.dork.app.core.designsystem.components.DorkBottomNavigation
import health.dork.app.core.designsystem.components.DorkNavDestination
import health.dork.app.ui.ai.DorkAiScreen
import health.dork.app.ui.ai.DorkAiViewModel
import health.dork.app.ui.auth.AuthScreen
import health.dork.app.ui.auth.AuthViewModel
import health.dork.app.ui.care.AppointmentBookingScreen
import health.dork.app.ui.care.CareScreen
import health.dork.app.ui.care.CareViewModel
import health.dork.app.ui.care.DoctorDetailScreen
import health.dork.app.ui.care.PreConsultationScreen
import health.dork.app.ui.chat.ChatScreen
import health.dork.app.ui.chat.ChatViewModel
import health.dork.app.ui.home.HomeScreen
import health.dork.app.ui.home.HomeViewModel
import health.dork.app.ui.medications.MedicationsScreen
import health.dork.app.ui.medications.MedicationsViewModel
import health.dork.app.ui.onboarding.OnboardingScreen
import health.dork.app.ui.onboarding.OnboardingViewModel
import health.dork.app.ui.profile.HealthProfileDetailScreen
import health.dork.app.ui.profile.MedicalIdScreen
import health.dork.app.ui.profile.ProfileScreen
import health.dork.app.ui.profile.ProfileViewModel
import health.dork.app.ui.records.DocumentUploadScreen
import health.dork.app.ui.records.PrescriptionDetailScreen
import health.dork.app.ui.records.RecordDetailScreen
import health.dork.app.ui.records.RecordsScreen
import health.dork.app.ui.records.RecordsViewModel

sealed interface SubScreen {
  data class DoctorDetail(val doctor: Doctor) : SubScreen
  data class AppointmentBooking(val doctor: Doctor) : SubScreen
  data class PreConsultation(val appointmentId: String, val doctorName: String) : SubScreen
  data class RecordDetail(val record: HealthRecordItem) : SubScreen
  data object PrescriptionDetail : SubScreen
  data object DocumentUpload : SubScreen
  data object DoctorChat : SubScreen
  data object HealthProfileDetail : SubScreen
  data object MedicalId : SubScreen
  data object MedicationsView : SubScreen
}

@Composable
fun DorkAppNavigation(container: AppContainer) {
  val authViewModel = remember { AuthViewModel(container.authRepository) }
  val homeViewModel = remember {
    HomeViewModel(
      container.patientRepository,
      container.careRepository,
      container.medicationRepository,
      container.recordRepository
    )
  }
  val careViewModel = remember { CareViewModel(container.careRepository) }
  val recordsViewModel = remember { RecordsViewModel(container.recordRepository, container.medicationRepository) }
  val medicationsViewModel = remember { MedicationsViewModel(container.medicationRepository) }
  val chatViewModel = remember { ChatViewModel(container.chatRepository) }
  val aiViewModel = remember { DorkAiViewModel(container.aiRepository) }
  val profileViewModel = remember { ProfileViewModel(container.patientRepository, container.authRepository) }

  val authState by authViewModel.authState.collectAsState()

  when (val state = authState) {
    is AuthState.Unauthenticated -> {
      AuthScreen(viewModel = authViewModel)
    }
    is AuthState.Onboarding -> {
      val onboardingViewModel = remember {
        OnboardingViewModel(container.authRepository, container.patientRepository)
      }
      OnboardingScreen(viewModel = onboardingViewModel)
    }
    is AuthState.Authenticated, is AuthState.Splash -> {
      AuthenticatedMainShell(
        homeViewModel = homeViewModel,
        careViewModel = careViewModel,
        recordsViewModel = recordsViewModel,
        medicationsViewModel = medicationsViewModel,
        chatViewModel = chatViewModel,
        aiViewModel = aiViewModel,
        profileViewModel = profileViewModel
      )
    }
  }
}

@Composable
private fun AuthenticatedMainShell(
  homeViewModel: HomeViewModel,
  careViewModel: CareViewModel,
  recordsViewModel: RecordsViewModel,
  medicationsViewModel: MedicationsViewModel,
  chatViewModel: ChatViewModel,
  aiViewModel: DorkAiViewModel,
  profileViewModel: ProfileViewModel
) {
  var currentTab by remember { mutableStateOf(DorkNavDestination.Home) }
  var activeSubScreen by remember { mutableStateOf<SubScreen?>(null) }

  BackHandler(enabled = activeSubScreen != null) {
    activeSubScreen = null
  }

  Scaffold(
    bottomBar = {
      if (activeSubScreen == null) {
        DorkBottomNavigation(
          currentDestination = currentTab,
          onNavigate = { currentTab = it }
        )
      }
    }
  ) { paddingValues ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(paddingValues)
        .background(MaterialTheme.colorScheme.background)
    ) {
      AnimatedContent(
        targetState = activeSubScreen,
        transitionSpec = { fadeIn() togetherWith fadeOut() },
        label = "subscreen_transition"
      ) { subScreen ->
        if (subScreen != null) {
          when (subScreen) {
            is SubScreen.DoctorDetail -> {
              DoctorDetailScreen(
                doctor = subScreen.doctor,
                onBackClick = { activeSubScreen = null },
                onBookClick = { activeSubScreen = SubScreen.AppointmentBooking(subScreen.doctor) }
              )
            }
            is SubScreen.AppointmentBooking -> {
              AppointmentBookingScreen(
                viewModel = careViewModel,
                onBackClick = { activeSubScreen = null },
                onConfirmedDone = { activeSubScreen = null }
              )
            }
            is SubScreen.PreConsultation -> {
              PreConsultationScreen(
                appointmentId = subScreen.appointmentId,
                doctorName = subScreen.doctorName,
                onBackClick = { activeSubScreen = null },
                onSubmitDone = { activeSubScreen = null },
                viewModel = careViewModel
              )
            }
            is SubScreen.RecordDetail -> {
              RecordDetailScreen(
                record = subScreen.record,
                viewModel = recordsViewModel,
                onBackClick = { activeSubScreen = null },
                onViewPrescriptionClick = { activeSubScreen = SubScreen.PrescriptionDetail }
              )
            }
            is SubScreen.PrescriptionDetail -> {
              PrescriptionDetailScreen(
                viewModel = recordsViewModel,
                onBackClick = { activeSubScreen = null },
                onNavigateToMedications = {
                  activeSubScreen = null
                  currentTab = DorkNavDestination.Home
                }
              )
            }
            is SubScreen.DocumentUpload -> {
              DocumentUploadScreen(
                viewModel = recordsViewModel,
                onBackClick = { activeSubScreen = null },
                onUploadDone = { activeSubScreen = null }
              )
            }
            is SubScreen.DoctorChat -> {
              ChatScreen(
                viewModel = chatViewModel,
                onBackClick = { activeSubScreen = null }
              )
            }
            is SubScreen.HealthProfileDetail -> {
              HealthProfileDetailScreen(
                viewModel = profileViewModel,
                onBackClick = { activeSubScreen = null }
              )
            }
            is SubScreen.MedicalId -> {
              MedicalIdScreen(
                viewModel = profileViewModel,
                onBackClick = { activeSubScreen = null }
              )
            }
            is SubScreen.MedicationsView -> {
              MedicationsScreen(viewModel = medicationsViewModel)
            }
          }
        } else {
          // Bottom Tab Navigation screens
          when (currentTab) {
            DorkNavDestination.Home -> {
              HomeScreen(
                viewModel = homeViewModel,
                onNavigateToCare = { currentTab = DorkNavDestination.Care },
                onNavigateToRecords = { currentTab = DorkNavDestination.Records },
                onNavigateToAi = { currentTab = DorkNavDestination.Ai },
                onNavigateToMedications = { activeSubScreen = SubScreen.MedicationsView },
                onAppointmentClick = { apptId ->
                  activeSubScreen = SubScreen.PreConsultation(apptId, "Dr. Sarah Chen")
                }
              )
            }
            DorkNavDestination.Care -> {
              CareScreen(
                viewModel = careViewModel,
                onDoctorClick = { doc -> activeSubScreen = SubScreen.DoctorDetail(doc) },
                onBookClick = { doc -> activeSubScreen = SubScreen.AppointmentBooking(doc) }
              )
            }
            DorkNavDestination.Records -> {
              RecordsScreen(
                viewModel = recordsViewModel,
                onRecordClick = { record -> activeSubScreen = SubScreen.RecordDetail(record) },
                onUploadClick = { activeSubScreen = SubScreen.DocumentUpload }
              )
            }
            DorkNavDestination.Ai -> {
              DorkAiScreen(viewModel = aiViewModel)
            }
            DorkNavDestination.Profile -> {
              ProfileScreen(
                viewModel = profileViewModel,
                onNavigateToHealthProfile = { activeSubScreen = SubScreen.HealthProfileDetail },
                onNavigateToMedicalId = { activeSubScreen = SubScreen.MedicalId },
                onNavigateToMedications = { activeSubScreen = SubScreen.MedicationsView },
                onNavigateToDocuments = { currentTab = DorkNavDestination.Records },
                onLogout = { /* Handled in ProfileViewModel */ }
              )
            }
          }
        }
      }
    }
  }
}
