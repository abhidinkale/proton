package health.dork.app.core.data.util

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.Period
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.format.TextStyle
import java.time.temporal.TemporalAdjusters
import java.util.Locale

/**
 * Authoritative Date and Age Calculation Utility.
 *
 * Guarantees dynamic, leap-year-safe and timezone-consistent age derivation from ISO-8601 YYYY-MM-DD.
 */
object DateCalculators {
  private val ISO_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US)
  private val DISPLAY_FORMATTER = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.US)
  private val DISPLAY_LONG_FORMATTER = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US)
  private val TIME_FORMATTER = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
  private val SHORT_DAY_FORMATTER = DateTimeFormatter.ofPattern("d MMM", Locale.US)

  /**
   * Calculates the exact integer age in years from an authoritative date of birth.
   * Handles leap years correctly (e.g. Feb 29 birth date).
   */
  fun calculateAge(birthDate: LocalDate, currentDate: LocalDate = LocalDate.now()): Int {
    require(!birthDate.isAfter(currentDate)) { "Birth date cannot be in the future" }
    return Period.between(birthDate, currentDate).years
  }

  /**
   * Parses ISO-8601 string "YYYY-MM-DD" and calculates age. Returns null if invalid or in the future.
   */
  fun calculateAgeFromString(birthDateIso: String, currentDate: LocalDate = LocalDate.now()): Int? {
    return try {
      val parsed = LocalDate.parse(birthDateIso.trim(), ISO_FORMATTER)
      if (parsed.isAfter(currentDate)) null else calculateAge(parsed, currentDate)
    } catch (e: Exception) {
      null
    }
  }

  /**
   * Formats ISO date "2026-10-17" to "17 Oct 2026".
   */
  fun formatDisplayDate(dateIso: String): String {
    return try {
      val parsed = LocalDate.parse(dateIso.trim(), ISO_FORMATTER)
      parsed.format(DISPLAY_FORMATTER)
    } catch (e: Exception) {
      dateIso
    }
  }

  /**
   * Formats ISO date "1998-05-12" to "May 12, 1998".
   */
  fun formatDisplayLongDate(dateIso: String): String {
    return try {
      val parsed = LocalDate.parse(dateIso.trim(), ISO_FORMATTER)
      parsed.format(DISPLAY_LONG_FORMATTER)
    } catch (e: Exception) {
      dateIso
    }
  }

  /**
   * Formats LocalDate to standard authoritative ISO string "YYYY-MM-DD".
   */
  fun toIsoString(date: LocalDate): String {
    return date.format(ISO_FORMATTER)
  }

  /**
   * Calculates BMI: Weight (kg) / (Height (m) ^ 2)
   */
  fun calculateBmi(heightCm: Double, weightKg: Double): Double? {
    if (heightCm <= 0.0 || weightKg <= 0.0) return null
    val heightMeters = heightCm / 100.0
    val bmi = weightKg / (heightMeters * heightMeters)
    return Math.round(bmi * 10.0) / 10.0
  }

  /**
   * Classifies BMI into standard clinical categories.
   */
  fun getBmiCategory(bmi: Double): String {
    return when {
      bmi < 18.5 -> "Underweight"
      bmi < 25.0 -> "Healthy weight"
      bmi < 30.0 -> "Overweight"
      else -> "Obesity"
    }
  }

  /**
   * Parses a clinic time such as "8:00 AM" into a [LocalTime].
   */
  fun parseClinicTime(value: String): LocalTime? {
    return runCatching { LocalTime.parse(value.trim(), TIME_FORMATTER) }.getOrNull()
  }

  /**
   * Turns an ISO date-time into a human label that stays correct as days pass:
   * "Today · 4:30 PM", "Tomorrow · 10:00 AM", "3 Nov 2026 · 2:15 PM".
   */
  fun formatSlotDisplay(
    dateIso: String,
    fallback: String = "",
    today: LocalDate = LocalDate.now()
  ): String {
    return try {
      val dateTime = LocalDateTime.parse(dateIso.trim())
      val date = dateTime.toLocalDate()
      val label = when (date) {
        today -> "Today"
        today.plusDays(1) -> "Tomorrow"
        today.minusDays(1) -> "Yesterday"
        else -> date.format(SHORT_DAY_FORMATTER) + " " + date.year
      }
      "$label · ${dateTime.toLocalTime().format(TIME_FORMATTER)}"
    } catch (e: Exception) {
      fallback
    }
  }

  /**
   * Resolves a booking slot label ("Tomorrow · 10:00 AM", "Thursday · 11:30 AM")
   * into an absolute ISO local date-time. Returning an absolute value is what
   * keeps a booked appointment meaningful after the app is restarted.
   */
  fun resolveSlotDateTime(
    slot: String,
    now: LocalDateTime = LocalDateTime.now()
  ): String? {
    val segments = slot.split("·")
    val dayLabel = segments.getOrNull(0)?.trim().orEmpty()
    val timeLabel = segments.getOrNull(1)?.trim().orEmpty()
    val time = parseClinicTime(timeLabel) ?: return null

    val baseDate = now.toLocalDate()
    val today = baseDate

    val targetDate = when {
      dayLabel.equals("Today", ignoreCase = true) -> today
      dayLabel.equals("Tomorrow", ignoreCase = true) -> today.plusDays(1)
      dayLabel.startsWith("Next ", ignoreCase = true) -> {
        val target = parseDayOfWeek(dayLabel.removePrefix("Next ").trim()) ?: return null
        today.with(TemporalAdjusters.next(target))
      }
      else -> {
        val target = parseDayOfWeek(dayLabel) ?: return null
        today.with(TemporalAdjusters.nextOrSame(target))
      }
    }

    var resolved = LocalDateTime.of(targetDate, time)
    // A weekday label that lands on today but has already passed means next week.
    if (!dayLabel.equals("Today", ignoreCase = true) &&
      !dayLabel.equals("Tomorrow", ignoreCase = true) &&
      resolved.isBefore(now)
    ) {
      resolved = resolved.plusWeeks(1)
    }
    return resolved.toString()
  }

  fun formatTimeOfDay(time: LocalTime): String = time.format(TIME_FORMATTER)

  private fun parseDayOfWeek(label: String): DayOfWeek? {
    if (label.isBlank()) return null
    return DayOfWeek.entries.firstOrNull { day ->
      day.name.startsWith(label.take(3), ignoreCase = true) ||
        day.getDisplayName(TextStyle.FULL, Locale.US).startsWith(label, ignoreCase = true) ||
        day.getDisplayName(TextStyle.SHORT, Locale.US).startsWith(label, ignoreCase = true)
    }
  }
}
