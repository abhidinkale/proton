package health.dork.app.core.reminder

import androidx.annotation.RawRes
import health.dork.app.R
import kotlinx.serialization.Serializable

/**
 * The sound a medication reminder makes.
 *
 * A pill reminder is the one notification in this app that has to survive a
 * noisy room: on a ward, in traffic, at 2am. A single generic chime is the
 * reason people silence medication apps entirely, so each plan carries its own
 * tone and the patient picks the one they will actually hear.
 *
 * Android fixes a channel's sound at creation time and refuses to change it
 * afterwards, which is why every tone gets its own channel id rather than one
 * channel with a mutable sound. The tones are bundled (synthesised, so no
 * licensing question) instead of leaning on system sounds, which vary by
 * manufacturer and are sometimes missing on AOSP builds.
 */
@Serializable
enum class ReminderTone(
  val label: String,
  val blurb: String,
  @RawRes val soundRes: Int?,
  val channelId: String,
  val vibrate: Boolean
) {
  CHIME(
    label = "Chime",
    blurb = "A single soft bell. Good for daytime doses.",
    soundRes = R.raw.tone_chime,
    channelId = "med_reminders_chime",
    vibrate = true
  ),
  MARIMBA(
    label = "Marimba",
    blurb = "Three rising notes. Hard to mistake for a text message.",
    soundRes = R.raw.tone_marimba,
    channelId = "med_reminders_marimba",
    vibrate = true
  ),
  PULSE(
    label = "Pulse",
    blurb = "A quiet double ping for shared spaces.",
    soundRes = R.raw.tone_pulse,
    channelId = "med_reminders_pulse",
    vibrate = false
  ),
  ALARM(
    label = "Alarm",
    blurb = "Insistent. For the dose you must not miss.",
    soundRes = R.raw.tone_alarm,
    channelId = "med_reminders_alarm",
    vibrate = true
  ),
  SILENT(
    label = "Silent",
    blurb = "Vibrate only, nothing audible.",
    soundRes = null,
    channelId = "med_reminders_silent",
    vibrate = true
  );

  companion object {
    /** Tolerant of rows written before tones existed, and of future names. */
    fun fromStorage(raw: String?): ReminderTone =
      entries.firstOrNull { it.name.equals(raw, ignoreCase = true) } ?: CHIME
  }
}
