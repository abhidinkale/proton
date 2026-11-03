package health.dork.app.ui.cases

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.repository.DorkCaseRepository
import health.dork.app.core.data.repository.DorkRecordRepository
import health.dork.app.core.designsystem.DorkColors
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.core.designsystem.components.DorkBottomNavigation
import health.dork.app.core.designsystem.components.DorkNavDestination
import health.dork.app.core.designsystem.components.UploadHealthRecordsTile
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xhdpi")
class CasesScreenshotTest {

  @get:Rule
  val composeRule = createComposeRule()

  @Test
  fun casesFileSectionScreen() {
    val store = DorkStore()
    val caseRepository = DorkCaseRepository(store)
    val recordRepository = DorkRecordRepository(store)
    val viewModel = CasesViewModel(caseRepository, recordRepository)

    composeRule.setContent {
      DorkTheme(darkTheme = false) {
        Scaffold(
          containerColor = Color(0xFFF7F7F8),
          bottomBar = {
            DorkBottomNavigation(
              currentDestination = DorkNavDestination.Cases,
              onNavigate = {}
            )
          }
        ) { paddingValues ->
          CasesScreen(
            viewModel = viewModel,
            darkTheme = false,
            modifier = Modifier.padding(paddingValues)
          )
        }
      }
    }

    composeRule.onRoot().captureRoboImage("build/outputs/roborazzi/file-section-cases.png")
  }

  @Test
  fun uploadHealthRecordsTileCloseUp() {
    composeRule.setContent {
      DorkTheme(darkTheme = false) {
        Box(
          modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF0F2F5))
            .padding(20.dp)
        ) {
          UploadHealthRecordsTile(
            existingFilesCount = 2,
            onAddFileClick = {},
            onViewRecordsClick = {},
            modifier = Modifier.fillMaxWidth()
          )
        }
      }
    }

    composeRule.onRoot().captureRoboImage("build/outputs/roborazzi/upload-tile-card.png")
  }
}
