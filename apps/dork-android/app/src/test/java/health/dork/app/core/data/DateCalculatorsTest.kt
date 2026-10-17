package health.dork.app.core.data

import health.dork.app.core.data.util.DateCalculators
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/**
 * Unit tests covering Specification Section 14 & 70:
 * - Authoritative Date of birth
 * - Leap year handling (Feb 29)
 * - Leap day transitions across non-leap years
 * - BMI computation & classification
 */
class DateCalculatorsTest {

  @Test
  fun testAuthoritativeDobAgeCalculation() {
    val birthDate = LocalDate.of(1998, 5, 12)
    val asOfDate = LocalDate.of(2026, 10, 18)

    val age = DateCalculators.calculateAge(birthDate, asOfDate)
    assertEquals(28, age)
  }

  @Test
  fun testLeapYearBirthDateCalculation() {
    // Born on Leap Day Feb 29, 2000
    val leapDayBirth = LocalDate.of(2000, 2, 29)

    // On Feb 28, 2021 (non-leap year, day before anniversary)
    val beforeAnniversary = LocalDate.of(2021, 2, 28)
    assertEquals(20, DateCalculators.calculateAge(leapDayBirth, beforeAnniversary))

    // On March 1, 2021 (non-leap year, anniversary completed)
    val afterAnniversary = LocalDate.of(2021, 3, 1)
    assertEquals(21, DateCalculators.calculateAge(leapDayBirth, afterAnniversary))

    // On Feb 29, 2024 (leap year, exact anniversary)
    val nextLeapDay = LocalDate.of(2024, 2, 29)
    assertEquals(24, DateCalculators.calculateAge(leapDayBirth, nextLeapDay))
  }

  @Test
  fun testAgeFromString() {
    val age = DateCalculators.calculateAgeFromString("1998-05-12", LocalDate.of(2026, 10, 18))
    assertNotNull(age)
    assertEquals(28, age)
  }

  @Test
  fun testFutureDateReturnsNull() {
    val futureDate = LocalDate.now().plusYears(1).toString()
    val age = DateCalculators.calculateAgeFromString(futureDate)
    assertNull(age)
  }

  @Test
  fun testBmiCalculationAndClassification() {
    // 172 cm, 68.5 kg -> BMI = 68.5 / (1.72^2) = 23.15 -> 23.2
    val bmi = DateCalculators.calculateBmi(172.0, 68.5)
    assertNotNull(bmi)
    assertEquals(23.2, bmi!!, 0.1)

    val category = DateCalculators.getBmiCategory(bmi)
    assertEquals("Healthy weight", category)

    assertEquals("Underweight", DateCalculators.getBmiCategory(17.5))
    assertEquals("Overweight", DateCalculators.getBmiCategory(27.0))
    assertEquals("Obesity", DateCalculators.getBmiCategory(32.0))
  }

  @Test
  fun testDisplayDateFormatting() {
    val formatted = DateCalculators.formatDisplayDate("2026-10-18")
    assertEquals("18 Oct 2026", formatted)
  }
}
