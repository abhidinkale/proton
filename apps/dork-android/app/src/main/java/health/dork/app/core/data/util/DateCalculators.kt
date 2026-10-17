package health.dork.app.core.data.util

import java.time.LocalDate
import java.time.Period
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
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
}
