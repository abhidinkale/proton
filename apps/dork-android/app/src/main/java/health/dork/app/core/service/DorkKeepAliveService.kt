package health.dork.app.core.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import health.dork.app.MainActivity
import health.dork.app.R

/**
 * Foreground Keep-Alive Service for Dork Health.
 *
 * Ensures the app process is elevated to FOREGROUND_SERVICE priority so
 * Android's Low Memory Killer (LMK) does not terminate it when backgrounded.
 * Keeps real-time clinical messages, reminder alarms, and health synchronization active.
 */
class DorkKeepAliveService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    startAsForeground()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startAsForeground()
    // START_STICKY ensures the OS automatically respawns the service if ever killed under extreme pressure
    return START_STICKY
  }

  private fun startAsForeground() {
    createNotificationChannel()

    val launchIntent = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_MAIN
      addCategory(Intent.CATEGORY_LAUNCHER)
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Dork Health Active")
      .setContentText("Monitoring clinical care messages & medication schedules in background")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setVisibility(NotificationCompat.VISIBILITY_SECRET)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH or ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      } else {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      }
      try {
        startForeground(NOTIFICATION_ID, notification, serviceType)
      } catch (_: Exception) {
        startForeground(NOTIFICATION_ID, notification)
      }
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Dork Background Monitor",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Keeps clinic sync and medication reminders running reliably in background"
        setShowBadge(false)
        enableLights(false)
        enableVibration(false)
      }
      manager.createNotificationChannel(channel)
    }
  }

  companion object {
    private const val CHANNEL_ID = "dork_active_care_keep_alive"
    private const val NOTIFICATION_ID = 90210

    /**
     * Starts the foreground keep-alive service.
     */
    fun start(context: Context) {
      try {
        val intent = Intent(context, DorkKeepAliveService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (e: Exception) {
        // Handled gracefully if background start restrictions apply
      }
    }

    /**
     * Stops the foreground keep-alive service.
     */
    fun stop(context: Context) {
      try {
        val intent = Intent(context, DorkKeepAliveService::class.java)
        context.stopService(intent)
      } catch (_: Exception) {}
    }

    /**
     * Checks if the app is currently exempt from aggressive battery optimization.
     */
    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
      val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return true
      return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    /**
     * Prompts the user to exempt Dork from battery throttling / OS termination.
     */
    fun requestIgnoreBatteryOptimizations(context: Context) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        try {
          if (!isIgnoringBatteryOptimizations(context)) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
              data = Uri.parse("package:${context.packageName}")
              addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
          }
        } catch (_: Exception) {
          try {
            val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
              addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(fallback)
          } catch (_: Exception) {}
        }
      }
    }
  }
}
