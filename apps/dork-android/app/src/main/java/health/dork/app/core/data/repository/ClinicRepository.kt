package health.dork.app.core.data.repository

import health.dork.app.core.data.local.DorkStore
import health.dork.app.core.data.model.ClinicLink
import health.dork.app.core.data.model.ShareChannel
import health.dork.app.core.data.model.ShareEvent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.time.LocalDateTime

/**
 * The patient's link to a real clinic.
 *
 * Deliberately not a fake server session. A clinic hands the patient a six
 * character code at the desk; the app stores the link locally and uses it to
 * address everything the patient chooses to send. Until a clinic runs a Proton
 * server, this is both the honest and the universally compatible integration —
 * every clinic on earth can hand out a code.
 */
interface ClinicRepository {
  val link: StateFlow<ClinicLink?>
  val shareLog: StateFlow<List<ShareEvent>>

  fun linkClinic(
    clinicName: String,
    clinicPhone: String,
    clinicianName: String,
    linkCode: String
  ): Result<ClinicLink>

  fun unlink()

  fun recordShare(
    packetKind: String,
    channel: ShareChannel,
    destination: String = link.value?.clinicName ?: "Your clinic"
  ): ShareEvent

  fun isLinked(): Boolean = link.value != null
}

class DorkClinicRepository(
  private val store: DorkStore = DorkStore(),
  private val now: () -> LocalDateTime = { LocalDateTime.now() }
) : ClinicRepository {

  private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
  private val logSerializer = ListSerializer(ShareEvent.serializer())

  private val _link = MutableStateFlow(
    store.getString(KEY_LINK)?.let {
      runCatching { json.decodeFromString(ClinicLink.serializer(), it) }.getOrNull()
    }
  )
  override val link: StateFlow<ClinicLink?> = _link.asStateFlow()

  private val _shareLog = MutableStateFlow(store.read(KEY_LOG, logSerializer) ?: emptyList())
  override val shareLog: StateFlow<List<ShareEvent>> = _shareLog.asStateFlow()

  override fun linkClinic(
    clinicName: String,
    clinicPhone: String,
    clinicianName: String,
    linkCode: String
  ): Result<ClinicLink> {
    val name = clinicName.trim()
    val code = linkCode.trim().uppercase().replace(" ", "")
    if (name.isBlank()) return Result.failure(IllegalArgumentException("Add the clinic name."))
    if (code.length != CODE_LENGTH || !code.all { it.isLetterOrDigit() }) {
      return Result.failure(IllegalArgumentException("A clinic code is $CODE_LENGTH letters or numbers."))
    }
    val link = ClinicLink(
      clinicName = name,
      clinicPhone = clinicPhone.trim(),
      linkCode = code,
      clinicianName = clinicianName.trim().ifBlank { null },
      linkedAtIso = now().toString()
    )
    _link.value = link
    store.putString(KEY_LINK, json.encodeToString(ClinicLink.serializer(), link))
    return Result.success(link)
  }

  override fun unlink() {
    _link.value = null
    store.remove(KEY_LINK)
  }

  override fun recordShare(
    packetKind: String,
    channel: ShareChannel,
    destination: String
  ): ShareEvent {
    val event = ShareEvent(
      id = "share-${System.currentTimeMillis()}",
      packetKind = packetKind,
      channel = channel.label,
      destination = destination,
      sharedAtIso = now().toString()
    )
    _shareLog.value = (listOf(event) + _shareLog.value).take(MAX_LOG)
    store.write(KEY_LOG, logSerializer, _shareLog.value)
    return event
  }

  private companion object {
    const val KEY_LINK = "clinic:link"
    const val KEY_LOG = "clinic:share_log"
    const val CODE_LENGTH = 6
    const val MAX_LOG = 100
  }
}
