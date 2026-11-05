package health.dork.app.ui.navigation

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Alignment
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import health.dork.app.core.data.AppContainer
import health.dork.app.core.data.model.Doctor
import health.dork.app.core.data.model.HealthRecordItem
import health.dork.app.core.data.model.NextActionKind
import health.dork.app.core.data.repository.AuthState
import health.dork.app.core.data.repository.ClinicInboxRepository
import health.dork.app.core.designsystem.components.DorkBottomNavigation
import health.dork.app.core.designsystem.components.DorkNavDestination
import health.dork.app.ui.ai.DorkAiScreen
import health.dork.app.ui.ai.DorkAiViewModel
import health.dork.app.ui.auth.AuthScreen
import health.dork.app.ui.auth.AuthViewModel
import health.dork.app.ui.care.BookingScreen
import health.dork.app.ui.care.CareScreen
import health.dork.app.ui.care.CareViewModel
import health.dork.app.ui.care.DoctorDetailScreen
import health.dork.app.ui.care.FollowUpScreen
import health.dork.app.ui.care.FollowUpViewModel
import health.dork.app.ui.care.IntakeScreen
import health.dork.app.ui.care.IntakeViewModel
import health.dork.app.ui.chat.ChatScreen
import health.dork.app.ui.chat.ChatViewModel
import health.dork.app.ui.clinic.CarePacketScreen
import health.dork.app.ui.clinic.ClinicLinkScreen
import health.dork.app.ui.clinic.ClinicViewModel
import health.dork.app.ui.home.HomeScreen
import health.dork.app.ui.home.HomeViewModel
import health.dork.app.ui.inbox.ClinicInboxScreen
import health.dork.app.ui.medications.MedicationsScreen
import health.dork.app.ui.medications.MedicationsViewModel
import health.dork.app.ui.medications.RefillScreen
import health.dork.app.ui.medications.RefillViewModel
import health.dork.app.ui.onboarding.OnboardingScreen
import health.dork.app.ui.onboarding.OnboardingViewModel
import health.dork.app.ui.profile.HealthProfileDetailScreen
import health.dork.app.ui.profile.MedicalIdScreen
import health.dork.app.ui.profile.ProfileScreen
import health.dork.app.ui.profile.ProfileViewModel
import health.dork.app.ui.cases.CasesScreen
import health.dork.app.ui.cases.CasesViewModel
import health.dork.app.ui.records.DocumentUploadScreen
import health.dork.app.ui.records.PrescriptionDetailScreen
import health.dork.app.ui.records.RecordDetailScreen
import health.dork.app.ui.records.RecordsScreen
import health.dork.app.ui.records.RecordsViewModel
import health.dork.app.ui.welcome.WelcomeScreen

sealed interface SubScreen {
  data class DoctorDetail(val doctor: Doctor) : SubScreen
  data class Book(val doctor: Doctor) : SubScreen
  data class Reschedule(val appointmentId: String) : SubScreen
  data class Intake(val appointmentId: String) : SubScreen
  data class FollowUp(val appointmentId: String) : SubScreen
  data class Refill(val medicationId: String) : SubScreen
  data class RecordDetail(val record: HealthRecordItem) : SubScreen
  data object PrescriptionDetail : SubScreen
  data object DocumentUpload : SubScreen
  data object DoctorChat : SubScreen
  data object ClinicInbox : SubScreen
  data object HealthProfileDetail : SubScreen
  data object MedicalId : SubScreen
  data object MedicationsView : SubScreen
  data object Clinic : SubScreen
  data object Sync : SubScreen
  data object CarePacket : SubScreen
}

@Composable
fun DorkAppNavigation(container: AppContainer) {
  val authViewModel = remember { AuthViewModel(container.authRepository) }
  val homeViewModel = remember {
    HomeViewModel(
      patientRepository = container.patientRepository,
      careRepository = container.careRepository,
      medicationRepository = container.medicationRepository,
      recordRepository = container.recordRepository,
      settingsRepository = container.settingsRepository,
      authRepository = container.authRepository,
      intakeRepository = container.intakeRepository,
      followUpRepository = container.followUpRepository,
      refillRepository = container.refillRepository,
      clinicRepository = container.clinicRepository
    )
  }
  val careViewModel = remember {
    CareViewModel(
      careRepository = container.careRepository,
      patientRepository = container.patientRepository,
      settingsRepository = container.settingsRepository,
      followUpRepository = container.followUpRepository
    )
  }
  val intakeViewModel = remember {
    IntakeViewModel(
      intakeRepository = container.intakeRepository,
      careRepository = container.careRepository,
      patientRepository = container.patientRepository,
      clinicRepository = container.clinicRepository
    )
  }
  val followUpViewModel = remember {
    FollowUpViewModel(
      followUpRepository = container.followUpRepository,
      patientRepository = container.patientRepository,
      clinicRepository = container.clinicRepository
    )
  }
  val refillViewModel = remember {
    RefillViewModel(
      medicationRepository = container.medicationRepository,
      refillRepository = container.refillRepository,
      patientRepository = container.patientRepository,
      clinicRepository = container.clinicRepository
    )
  }
  val clinicViewModel = remember {
    ClinicViewModel(
      clinicRepository = container.clinicRepository,
      patientRepository = container.patientRepository,
      careRepository = container.careRepository,
      medicationRepository = container.medicationRepository,
      intakeRepository = container.intakeRepository,
      followUpRepository = container.followUpRepository,
      refillRepository = container.refillRepository
    )
  }
  val syncViewModel = remember {
    health.dork.app.ui.sync.SyncViewModel(
      settings = container.syncSettings,
      outbox = container.syncOutbox,
      authClient = container.authClient,
      engine = container.syncEngine,
      clinicRepository = container.clinicRepository,
      scheduleSync = { container.syncScheduler?.schedule() },
      cancelSync = { container.syncScheduler?.cancel() }
    )
  }
  val recordsViewModel = remember {
    RecordsViewModel(
      recordRepository = container.recordRepository,
      medicationRepository = container.medicationRepository,
      ehrSyncClient = container.ehrSyncClient
    )
  }
  val casesViewModel = remember {
    CasesViewModel(
      caseRepository = container.caseRepository,
      recordRepository = container.recordRepository
    )
  }
  val medicationsViewModel = remember { MedicationsViewModel(container.medicationRepository) }
  val chatViewModel = remember { ChatViewModel(container.chatRepository) }
  val aiViewModel = remember { DorkAiViewModel(container.aiRepository) }
  val profileViewModel = remember {
    ProfileViewModel(
      container.patientRepository,
      container.authRepository,
      container.settingsRepository,
      onSignOut = { container.signOut() }
    )
  }

  val authState by authViewModel.authState.collectAsState()
  var showSignInScreen by remember { mutableStateOf(false) }
  val clinicLink by container.clinicRepository.link.collectAsState()
  val context = LocalContext.current

  when (val state = authState) {
    is AuthState.Unauthenticated -> {
      if (showSignInScreen) {
        AuthScreen(
          viewModel = authViewModel,
          onBackToWelcome = { showSignInScreen = false }
        )
      } else {
        WelcomeScreen(
          onGetStarted = {
            authViewModel.startSignUp(initialStep = 2)
          },
          onSignInClick = {
            showSignInScreen = true
          },
          onDemoClick = {
            authViewModel.signInDemo()
          }
        )
      }
    }
    is AuthState.Onboarding -> {
      val onboardingViewModel = remember(state.step) {
        OnboardingViewModel(
          authRepository = container.authRepository,
          patientRepository = container.patientRepository,
          initialStep = state.step
        )
      }
      OnboardingScreen(
        viewModel = onboardingViewModel,
        onSignInClick = {
          container.signOut()
          showSignInScreen = true
        },
        onDemoClick = {
          authViewModel.signInDemo()
        }
      )
    }
    is AuthState.Authenticated, is AuthState.Splash -> {
      AuthenticatedMainShell(
        homeViewModel = homeViewModel,
        careViewModel = careViewModel,
        intakeViewModel = intakeViewModel,
        followUpViewModel = followUpViewModel,
        refillViewModel = refillViewModel,
        clinicViewModel = clinicViewModel,
        syncViewModel = syncViewModel,
        recordsViewModel = recordsViewModel,
        casesViewModel = casesViewModel,
        medicationsViewModel = medicationsViewModel,
        chatViewModel = chatViewModel,
        aiViewModel = aiViewModel,
        profileViewModel = profileViewModel,
        inboxRepository = container.clinicInboxRepository,
        clinicPhone = clinicLink?.clinicPhone.orEmpty(),
        clinicName = clinicLink?.clinicName ?: "your clinic",
        onEraseAllData = {
          container.eraseAllDeviceData()
          (context as? Activity)?.recreate()
        }
      )
    }
  }
}

@Composable
private fun AuthenticatedMainShell(
  homeViewModel: HomeViewModel,
  careViewModel: CareViewModel,
  intakeViewModel: IntakeViewModel,
  followUpViewModel: FollowUpViewModel,
  refillViewModel: RefillViewModel,
  clinicViewModel: ClinicViewModel,
  syncViewModel: health.dork.app.ui.sync.SyncViewModel,
  recordsViewModel: RecordsViewModel,
  casesViewModel: CasesViewModel,
  medicationsViewModel: MedicationsViewModel,
  chatViewModel: ChatViewModel,
  aiViewModel: DorkAiViewModel,
  profileViewModel: ProfileViewModel,
  inboxRepository: ClinicInboxRepository,
  clinicPhone: String,
  clinicName: String,
  onEraseAllData: () -> Unit
) {
  var currentTab by remember { mutableStateOf(DorkNavDestination.Home) }
  var activeSubScreen by remember { mutableStateOf<SubScreen?>(null) }

  val inboxMessages by inboxRepository.messages.collectAsState()
  val unreadClinicMessages by inboxRepository.unreadCount.collectAsState()

  fun close() {
    activeSubScreen = null
  }

  BackHandler(enabled = activeSubScreen != null) {
    activeSubScreen = null
  }

  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    AnimatedContent(
        targetState = activeSubScreen,
        transitionSpec = {
          if (targetState != null) {
            (slideInVertically(
              animationSpec = spring(
                dampingRatio = Spring.DampingRatioLowBouncy,
                stiffness = Spring.StiffnessMediumLow
              )
            ) { height -> height / 8 } +
             scaleIn(
               initialScale = 0.95f,
               animationSpec = spring(
                 dampingRatio = Spring.DampingRatioNoBouncy,
                 stiffness = Spring.StiffnessMediumLow
               )
             ) +
             fadeIn(animationSpec = tween(260, easing = FastOutSlowInEasing))
            ) togetherWith (
             scaleOut(
               targetScale = 0.97f,
               animationSpec = tween(180, easing = FastOutLinearInEasing)
             ) +
             fadeOut(animationSpec = tween(180, easing = FastOutLinearInEasing))
            )
          } else {
            (scaleIn(
              initialScale = 0.97f,
              animationSpec = spring(
                dampingRatio = Spring.DampingRatioNoBouncy,
                stiffness = Spring.StiffnessMediumLow
              )
            ) +
             fadeIn(animationSpec = tween(220, easing = FastOutSlowInEasing))
            ) togetherWith (
             slideOutVertically(
               animationSpec = spring(
                 dampingRatio = Spring.DampingRatioNoBouncy,
                 stiffness = Spring.StiffnessMediumLow
               )
             ) { height -> height / 8 } +
             scaleOut(
               targetScale = 0.95f,
               animationSpec = tween(180, easing = FastOutLinearInEasing)
             ) +
             fadeOut(animationSpec = tween(180, easing = FastOutLinearInEasing))
            )
          }
        },
        label = "subscreen_transition"
      ) { subScreen ->
        if (subScreen != null) {
          when (subScreen) {
            is SubScreen.DoctorDetail -> DoctorDetailScreen(
              doctor = subScreen.doctor,
              nextSlotLabel = careViewModel.nextSlotLabel(subScreen.doctor),
              onBackClick = ::close,
              onBookClick = { activeSubScreen = SubScreen.Book(subScreen.doctor) }
            )

            is SubScreen.Book -> {
              androidx.compose.runtime.LaunchedEffect(Unit) { careViewModel.startBooking(subScreen.doctor) }
              BookingScreen(
                viewModel = careViewModel,
                onBackClick = { careViewModel.dismissBooking(); close() },
                onConfirmedDone = { careViewModel.dismissBooking(); close() },
                onStartIntake = { appointment ->
                  careViewModel.dismissBooking()
                  activeSubScreen = SubScreen.Intake(appointment.id)
                }
              )
            }

            is SubScreen.Reschedule -> {
              androidx.compose.runtime.LaunchedEffect(subScreen.appointmentId) {
                careViewModel.startReschedule(subScreen.appointmentId)
              }
              BookingScreen(
                viewModel = careViewModel,
                onBackClick = { careViewModel.dismissBooking(); close() },
                onConfirmedDone = { careViewModel.dismissBooking(); close() },
                onStartIntake = { appointment ->
                  careViewModel.dismissBooking()
                  activeSubScreen = SubScreen.Intake(appointment.id)
                }
              )
            }

            is SubScreen.Intake -> IntakeScreen(
              appointmentId = subScreen.appointmentId,
              viewModel = intakeViewModel,
              onBackClick = ::close,
              onFinished = ::close
            )

            is SubScreen.FollowUp -> FollowUpScreen(
              appointmentId = subScreen.appointmentId,
              viewModel = followUpViewModel,
              clinicPhone = clinicPhone,
              clinicName = clinicName,
              onBackClick = ::close,
              onDone = ::close
            )

            is SubScreen.Refill -> RefillScreen(
              medicationId = subScreen.medicationId,
              viewModel = refillViewModel,
              onBackClick = ::close,
              onDone = ::close
            )

            is SubScreen.RecordDetail -> RecordDetailScreen(
              record = subScreen.record,
              viewModel = recordsViewModel,
              document = recordsViewModel.documentForRecord(subScreen.record),
              onBackClick = ::close,
              onViewPrescriptionClick = { activeSubScreen = SubScreen.PrescriptionDetail }
            )

            is SubScreen.PrescriptionDetail -> PrescriptionDetailScreen(
              viewModel = recordsViewModel,
              onBackClick = ::close,
              onNavigateToMedications = {
                close()
                activeSubScreen = SubScreen.MedicationsView
              }
            )

            is SubScreen.DocumentUpload -> DocumentUploadScreen(
              viewModel = recordsViewModel,
              onBackClick = ::close,
              onUploadDone = ::close
            )

            is SubScreen.DoctorChat -> ChatScreen(
              viewModel = chatViewModel,
              onBackClick = ::close
            )

            is SubScreen.ClinicInbox -> ClinicInboxScreen(
              inboxRepository = inboxRepository,
              onBackClick = ::close
            )

            is SubScreen.HealthProfileDetail -> HealthProfileDetailScreen(
              viewModel = profileViewModel,
              onBackClick = ::close
            )

            is SubScreen.MedicalId -> MedicalIdScreen(
              viewModel = profileViewModel,
              onBackClick = ::close
            )

            is SubScreen.MedicationsView -> MedicationsScreen(
              viewModel = medicationsViewModel,
              onRequestRefill = { activeSubScreen = SubScreen.Refill(it) }
            )

            is SubScreen.Clinic -> ClinicLinkScreen(
              viewModel = clinicViewModel,
              onBackClick = ::close,
              onShareSummary = { activeSubScreen = SubScreen.CarePacket },
              onOpenSync = { activeSubScreen = SubScreen.Sync }
            )

            is SubScreen.Sync -> health.dork.app.ui.sync.SyncScreen(
              viewModel = syncViewModel,
              onBackClick = { activeSubScreen = SubScreen.Clinic }
            )

            is SubScreen.CarePacket -> CarePacketScreen(
              viewModel = clinicViewModel,
              onBackClick = { activeSubScreen = SubScreen.Clinic }
            )
          }
        } else {
          AnimatedContent(
            targetState = currentTab,
            transitionSpec = {
              fadeIn(animationSpec = tween(140, easing = FastOutSlowInEasing)) togetherWith
              fadeOut(animationSpec = tween(90, easing = FastOutLinearInEasing))
            },
            label = "tab_crossfade"
          ) { tab ->
            when (tab) {
              DorkNavDestination.Home -> HomeScreen(
                viewModel = homeViewModel,
                onNavigateToCare = { currentTab = DorkNavDestination.Care },
                onNavigateToRecords = { currentTab = DorkNavDestination.Cases },
                onNavigateToAi = { currentTab = DorkNavDestination.Ai },
                onNavigateToMedications = { activeSubScreen = SubScreen.MedicationsView },
                onAppointmentClick = { appointmentId ->
                  activeSubScreen = SubScreen.Intake(appointmentId)
                },
                onProfileClick = { currentTab = DorkNavDestination.Profile },
                onNavigateToChat = { activeSubScreen = SubScreen.DoctorChat },
                onNextAction = { action ->
                  when (action.kind) {
                    NextActionKind.COMPLETE_INTAKE,
                    NextActionKind.SHARE_INTAKE -> action.appointmentId?.let {
                      activeSubScreen = SubScreen.Intake(it)
                    }

                    NextActionKind.FOLLOW_UP,
                    NextActionKind.SHARE_FOLLOW_UP -> action.appointmentId?.let {
                      activeSubScreen = SubScreen.FollowUp(it)
                    }

                    NextActionKind.REQUEST_REFILL,
                    NextActionKind.SHARE_REFILL -> action.medicationId?.let {
                      activeSubScreen = SubScreen.Refill(it)
                    }

                    NextActionKind.BOOK_VISIT -> currentTab = DorkNavDestination.Care

                    else -> currentTab = DorkNavDestination.Care
                  }
                }
              )

              DorkNavDestination.Care -> CareScreen(
                viewModel = careViewModel,
                onDoctorClick = { doctor -> activeSubScreen = SubScreen.DoctorDetail(doctor) },
                onBookClick = { doctor -> activeSubScreen = SubScreen.Book(doctor) },
                onMessagesClick = { activeSubScreen = SubScreen.ClinicInbox },
                unreadClinicMessages = unreadClinicMessages,
                latestClinicMessage = inboxMessages.firstOrNull(),
                onReschedule = { id -> activeSubScreen = SubScreen.Reschedule(id) },
                onFollowUp = { id -> activeSubScreen = SubScreen.FollowUp(id) }
              )

              DorkNavDestination.Cases -> CasesScreen(
                viewModel = casesViewModel
              )

              DorkNavDestination.Ai -> DorkAiScreen(viewModel = aiViewModel)

              DorkNavDestination.Profile -> ProfileScreen(
                viewModel = profileViewModel,
                onNavigateToHealthProfile = { activeSubScreen = SubScreen.HealthProfileDetail },
                onNavigateToMedicalId = { activeSubScreen = SubScreen.MedicalId },
                onNavigateToMedications = { activeSubScreen = SubScreen.MedicationsView },
                onNavigateToDocuments = { currentTab = DorkNavDestination.Cases },
                onNavigateToClinic = { activeSubScreen = SubScreen.Clinic },
                onLogout = { },
                onEraseAllData = onEraseAllData
              )
            }
          }
        }
      }

    if (activeSubScreen == null) {
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .align(Alignment.BottomCenter)
      ) {
        DorkBottomNavigation(
          currentDestination = currentTab,
          onNavigate = { currentTab = it }
        )
      }
    }
  }
}
