package health.dork.app.core.util

import android.content.Context
import android.content.Intent
import android.provider.CalendarContract
import android.widget.Toast
import health.dork.app.core.data.model.AppointmentItem
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Hands an appointment to the device's own calendar app.
 *
 * An insert intent, so no calendar permission is needed and the patient confirms
 * the event themselves. Proton never writes to a calendar silently.
 */
fun addAppointmentToCalendar(context: Context, appointment: AppointmentItem) {
  val start = runCatching { LocalDateTime.parse(appointment.dateIso) }.getOrNull()
  if (start == null) {
    Toast.makeText(context, "This appointment has no confirmed date yet.", Toast.LENGTH_SHORT).show()
    return
  }

  val zone = ZoneId.systemDefault()
  val beginMillis = start.atZone(zone).toInstant().toEpochMilli()
  val endMillis = start.plusMinutes(30).atZone(zone).toInstant().toEpochMilli()

  val intent = Intent(Intent.ACTION_INSERT).apply {
    data = CalendarContract.Events.CONTENT_URI
    putExtra(CalendarContract.Events.TITLE, "Appointment with ${appointment.doctorName}")
    putExtra(
      CalendarContract.Events.DESCRIPTION,
      "${appointment.consultationType.label} · ${appointment.reasonForVisit}"
    )
    putExtra(CalendarContract.Events.EVENT_LOCATION, appointment.clinicLocation)
    putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, beginMillis)
    putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endMillis)
  }

  runCatching { context.startActivity(intent) }
    .onFailure {
      Toast.makeText(context, "No calendar app is available on this device.", Toast.LENGTH_SHORT).show()
    }
}
