package health.dork.app.core.data

import health.dork.app.core.data.model.BiomarkerTrendPoint
import health.dork.app.core.data.model.BiomarkerTrendSeries
import health.dork.app.core.data.model.LabStatus
import health.dork.app.core.data.model.LabTestItem
import health.dork.app.core.data.model.buildBiomarkerTrends
import health.dork.app.core.data.model.parseBiomarkerValue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BiomarkerTrendTest {

  @Test
  fun testParseBiomarkerValue() {
    assertEquals(88.0, parseBiomarkerValue("88") ?: 0.0, 0.001)
    assertEquals(13.8, parseBiomarkerValue("13.8") ?: 0.0, 0.001)
    assertEquals(6.4, parseBiomarkerValue("  6.4  ") ?: 0.0, 0.001)
    assertEquals(0.5, parseBiomarkerValue("< 0.5") ?: 0.0, 0.001)
    assertEquals(210.5, parseBiomarkerValue("> 210.5") ?: 0.0, 0.001)
    assertNull(parseBiomarkerValue("NEGATIVE"))
    assertNull(parseBiomarkerValue(""))
  }

  @Test
  fun testGroupingAndChronologicalOrdering() {
    val items = listOf(
      LabTestItem(
        id = "lab-3",
        testName = "Fasting Blood Glucose",
        value = "88",
        unit = "mg/dL",
        referenceRangeLow = 70.0,
        referenceRangeHigh = 99.0,
        status = LabStatus.WITHIN_RANGE,
        dateString = "2026-10-15",
        laboratoryName = "Quest Diagnostics"
      ),
      LabTestItem(
        id = "lab-1",
        testName = "Fasting Blood Glucose",
        value = "104",
        unit = "mg/dL",
        referenceRangeLow = 70.0,
        referenceRangeHigh = 99.0,
        status = LabStatus.ABOVE_RANGE,
        dateString = "2026-05-12",
        laboratoryName = "Quest Diagnostics"
      ),
      LabTestItem(
        id = "lab-2",
        testName = "Fasting Blood Glucose",
        value = "96",
        unit = "mg/dL",
        referenceRangeLow = 70.0,
        referenceRangeHigh = 99.0,
        status = LabStatus.WITHIN_RANGE,
        dateString = "2026-08-18",
        laboratoryName = "Quest Diagnostics"
      )
    )

    val trends = items.buildBiomarkerTrends()
    assertEquals(1, trends.size)

    val glucoseTrend = trends.first()
    assertEquals("Fasting Blood Glucose", glucoseTrend.testName)
    assertEquals("mg/dL", glucoseTrend.unit)
    assertEquals(3, glucoseTrend.points.size)

    // Verify chronological order: May -> Aug -> Oct
    assertEquals("2026-05-12", glucoseTrend.points[0].dateIso)
    assertEquals(104.0, glucoseTrend.points[0].numericValue, 0.001)
    assertEquals(LabStatus.ABOVE_RANGE, glucoseTrend.points[0].status)

    assertEquals("2026-08-18", glucoseTrend.points[1].dateIso)
    assertEquals(96.0, glucoseTrend.points[1].numericValue, 0.001)

    assertEquals("2026-10-15", glucoseTrend.points[2].dateIso)
    assertEquals(88.0, glucoseTrend.points[2].numericValue, 0.001)
    assertEquals(LabStatus.WITHIN_RANGE, glucoseTrend.points[2].status)

    // Verify latest point
    assertEquals(88.0, glucoseTrend.latestPoint?.numericValue ?: 0.0, 0.001)

    // Verify percentage change from previous test (from 96 to 88: -8.33%)
    assertNotNull(glucoseTrend.changePercentage)
    assertEquals(-8.33, glucoseTrend.changePercentage ?: 0.0, 0.1)
  }

  @Test
  fun testMultipleDistinctBiomarkers() {
    val items = listOf(
      LabTestItem(
        id = "lab-1",
        testName = "Hemoglobin",
        value = "13.8",
        unit = "g/dL",
        referenceRangeLow = 12.0,
        referenceRangeHigh = 16.0,
        status = LabStatus.WITHIN_RANGE,
        dateString = "2026-10-15",
        laboratoryName = "Quest"
      ),
      LabTestItem(
        id = "lab-2",
        testName = "Total Cholesterol",
        value = "182",
        unit = "mg/dL",
        referenceRangeLow = 125.0,
        referenceRangeHigh = 200.0,
        status = LabStatus.WITHIN_RANGE,
        dateString = "2026-10-15",
        laboratoryName = "Quest"
      )
    )

    val trends = items.buildBiomarkerTrends()
    assertEquals(2, trends.size)
    assertTrue(trends.any { it.testName == "Hemoglobin" })
    assertTrue(trends.any { it.testName == "Total Cholesterol" })
  }
}
