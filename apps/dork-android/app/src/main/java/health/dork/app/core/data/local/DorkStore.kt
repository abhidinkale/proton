package health.dork.app.core.data.local

import android.content.Context
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json

/**
 * Small, explicit persistence layer for the patient app.
 *
 * Every record the patient can change (profile, doses, bookings, uploads,
 * messages, preferences) is written here, so a process restart never silently
 * resets the app to seeded demo state. When no Android context is available
 * (unit tests) the store degrades to memory only.
 */
class DorkStore(context: Context? = null) {

  private val prefs = context?.applicationContext
    ?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private val memory = mutableMapOf<String, String>()

  private val json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    encodeDefaults = true
  }

  fun putString(key: String, value: String) {
    memory[key] = value
    prefs?.edit()?.putString(key, value)?.apply()
  }

  fun getString(key: String): String? = prefs?.getString(key, null) ?: memory[key]

  fun remove(key: String) {
    memory.remove(key)
    prefs?.edit()?.remove(key)?.apply()
  }

  /** Wipes every key the app owns on this device. */
  fun clear() {
    memory.clear()
    prefs?.edit()?.clear()?.commit()
  }

  fun <T> read(key: String, serializer: KSerializer<T>): T? {
    val raw = getString(key) ?: return null
    return runCatching { json.decodeFromString(serializer, raw) }.getOrNull()
  }

  fun <T> write(key: String, serializer: KSerializer<T>, value: T) {
    runCatching { json.encodeToString(serializer, value) }.onSuccess { putString(key, it) }
  }

  private companion object {
    const val PREFS_NAME = "dork_patient_store_v2"
  }
}
