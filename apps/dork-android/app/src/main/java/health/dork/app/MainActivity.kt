package health.dork.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import health.dork.app.core.data.DefaultAppContainer
import health.dork.app.core.data.DorkApp
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.ui.navigation.DorkAppNavigation

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Initialize Dork singleton dependency container
    DorkApp.initialize(DefaultAppContainer())

    enableEdgeToEdge()
    setContent {
      DorkTheme {
        Surface(
          modifier = Modifier.fillMaxSize()
        ) {
          DorkAppNavigation(container = DorkApp.container)
        }
      }
    }
  }
}
