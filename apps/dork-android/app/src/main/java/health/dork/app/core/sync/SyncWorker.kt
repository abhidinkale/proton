package health.dork.app.core.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import health.dork.app.core.data.DefaultAppContainer
import health.dork.app.core.data.DorkApp
import java.util.concurrent.TimeUnit

/**
 * Drains the queue in the background.
 *
 * WorkManager supplies the connectivity constraint and the exponential backoff
 * (30s doubling, capped by WorkManager at five hours). Returning
 * [Result.retry] after a 5xx/429/network failure makes the next attempt wait
 * longer; a permanently rejected row does not stop the rest.
 */
class SyncWorker(
  appContext: Context,
  params: WorkerParameters
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    val container = DorkApp.maybeContainer() ?: DefaultAppContainer(applicationContext)
    if (!container.syncSettings.enabled.value) return Result.success()

    val report = container.syncEngine.runOnce()
    return when {
      report.needsReauth -> Result.success()
      report.retryableFailure -> Result.retry()
      else -> Result.success()
    }
  }

  companion object {
    const val UNIQUE_WORK_NAME = "proton-sync"
  }
}

/** Creates the single unique sync job. WorkManager de-duplicates it by name. */
class SyncScheduler(private val context: Context) {

  fun schedule() {
    val request = OneTimeWorkRequestBuilder<SyncWorker>()
      .setConstraints(
        Constraints.Builder()
          .setRequiredNetworkType(NetworkType.CONNECTED)
          .build()
      )
      .setBackoffCriteria(
        BackoffPolicy.EXPONENTIAL,
        MIN_BACKOFF_SECONDS,
        TimeUnit.SECONDS
      )
      .build()

    WorkManager.getInstance(context)
      .enqueueUniqueWork(
        SyncWorker.UNIQUE_WORK_NAME,
        ExistingWorkPolicy.KEEP,
        request
      )
  }

  fun cancel() {
    WorkManager.getInstance(context).cancelUniqueWork(SyncWorker.UNIQUE_WORK_NAME)
  }

  private companion object {
    const val MIN_BACKOFF_SECONDS = 30L
  }
}
