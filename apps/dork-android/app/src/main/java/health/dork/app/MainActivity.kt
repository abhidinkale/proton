package health.dork.app

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import health.dork.app.core.data.DefaultAppContainer
import health.dork.app.core.data.DorkApp
import health.dork.app.core.designsystem.DorkTheme
import health.dork.app.ui.navigation.DorkAppNavigation

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val container = DefaultAppContainer(applicationContext)
    DorkApp.initialize(container)
    container.reminders?.ensureChannel()

    // While the app is open, the clinic's replies are pulled on a short loop so
    // a doctor's message appears without the patient doing anything.
    lifecycle.addObserver(
      object : DefaultLifecycleObserver {
        override fun onStart(owner: LifecycleOwner) {
          container.syncCoordinator?.onAppForeground()
        }

        override fun onStop(owner: LifecycleOwner) {
          container.syncCoordinator?.onAppBackground()
        }
      }
    )

    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
      navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
    )

    setContent {
      val darkTheme by container.settingsRepository.darkTheme.collectAsState()

      LaunchedEffect(darkTheme) {
        enableEdgeToEdge(
          statusBarStyle = if (darkTheme) {
            SystemBarStyle.dark(Color.TRANSPARENT)
          } else {
            SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
          },
          navigationBarStyle = if (darkTheme) {
            SystemBarStyle.dark(Color.TRANSPARENT)
          } else {
            SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
          }
        )
      }

      DorkTheme(darkTheme = darkTheme) {
        Surface(
          modifier = Modifier.fillMaxSize(),
          color = MaterialTheme.colorScheme.background
        ) {
          NotificationPermissionGate()
          ReminderRegistrar(container = container)
          DorkAppNavigation(container = DorkApp.container)
        }
      }
    }
  }
}

/**
 * Asks for the notification permission once, only when the patient still has
 * reminders switched on. Denying it is not an error state — the in-app dose card
 * keeps working.
 */
@Composable
private fun NotificationPermissionGate() {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
  val context = LocalContext.current
  val launcher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { /* either answer is fine; the UI never blocks on it */ }

  LaunchedEffect(Unit) {
    val granted = ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.POST_NOTIFICATIONS
    ) == PackageManager.PERMISSION_GRANTED
    if (!granted) launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
  }
}

/** Keeps the OS alarm schedule in step with the medication list and the toggle. */
@Composable
private fun ReminderRegistrar(container: DefaultAppContainer) {
  val plans by container.medicationRepository.medicationPlans.collectAsState()
  val enabled by container.settingsRepository.medicationReminders.collectAsState()

  LaunchedEffect(plans, enabled) {
    container.reminders?.reschedule(plans = plans, enabled = enabled)
  }
}
