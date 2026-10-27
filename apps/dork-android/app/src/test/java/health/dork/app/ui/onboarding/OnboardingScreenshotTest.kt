package health.dork.app.ui.onboarding

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.repository.DorkAuthRepository
import health.dork.app.core.data.repository.DorkPatientRepository
import health.dork.app.core.designsystem.DorkTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Renders the onboarding surface off-device.
 *
 * The hero band is a gradient, an animated progress bar and a serif title in a
 * clipped box — three things that compile fine and can still look wrong. These
 * captures are how the layout gets checked without installing the app on a
 * phone, and they run in CI with the rest of the unit tests.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xhdpi")
class OnboardingScreenshotTest {

  @get:Rule
  val composeRule = createComposeRule()

  private fun viewModel() = OnboardingViewModel(
    authRepository = DorkAuthRepository(DorkStore()),
    patientRepository = DorkPatientRepository(DorkStore())
  )

  @Test
  fun welcome() {
    val vm = viewModel()
    composeRule.setContent {
      DorkTheme(darkTheme = false) { OnboardingScreen(vm) }
    }
    composeRule.onRoot().captureRoboImage("build/outputs/roborazzi/onboarding-welcome.png")
  }

  @Test
  fun dateOfBirth() {
    val vm = viewModel()
    // The wizard validates as it goes, so the account step has to be satisfied
    // before the calendar step can be reached.
    vm.onEmailChange("pat@example.com")
    vm.onPasswordChange("correct-horse-battery")
    vm.onConfirmPasswordChange("correct-horse-battery")
    vm.onNameChange("Eleanor Vance")
    repeat(3) { vm.nextStep() }

    composeRule.setContent {
      DorkTheme(darkTheme = false) { OnboardingScreen(vm) }
    }
    composeRule.onRoot().captureRoboImage("build/outputs/roborazzi/onboarding-dob.png")
  }

  @Test
  fun conditionsWithCustomEntry() {
    val vm = viewModel()
    vm.onEmailChange("pat@example.com")
    vm.onPasswordChange("correct-horse-battery")
    vm.onConfirmPasswordChange("correct-horse-battery")
    vm.onNameChange("Eleanor Vance")
    vm.onDobChange("1962-03-14")
    repeat(8) { vm.nextStep() }
    vm.onCustomConditionChange("Post-viral fatigue")
    vm.addCustomCondition()

    composeRule.setContent {
      DorkTheme(darkTheme = false) { OnboardingScreen(vm) }
    }
    composeRule.onRoot().captureRoboImage("build/outputs/roborazzi/onboarding-conditions.png")
  }

  @Test
  fun darkWelcome() {
    val vm = viewModel()
    composeRule.setContent {
      DorkTheme(darkTheme = true) { OnboardingScreen(vm) }
    }
    composeRule.onRoot().captureRoboImage("build/outputs/roborazzi/onboarding-welcome-dark.png")
  }
}
