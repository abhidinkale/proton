package health.dork.app.core.telemetry

import health.dork.app.core.fhir.FhirCodeableConcept
import health.dork.app.core.fhir.FhirCoding
import health.dork.app.core.fhir.FhirObservation
import health.dork.app.core.fhir.FhirQuantity
import health.dork.app.core.fhir.FhirReference
import kotlinx.serialization.Serializable
import java.time.Instant
import java.util.UUID

/**
 * HealthConnectManager
 * Connects Android Health Connect client data into Proton Autonomous Clinical OS:
 * - Continuous Glucose Monitoring (CGM)
 * - Blood Pressure telemetry
 * - Wearable Single-Lead ECG recordings
 */
object HealthConnectManager {

  @Serializable
  data class WearableTelemetryPacket(
    val patientId: String,
    val source: String = "AndroidHealthConnect",
    val meanGlucoseMgDl: Double?,
    val timeInRangePercent: Int?,
    val systolicBp: Int?,
    val diastolicBp: Int?,
    val ecgRhythm: String?,
    val timestamp: String
  )

  fun buildFhirObservations(packet: WearableTelemetryPacket): List<FhirObservation> {
    val obsList = mutableListOf<FhirObservation>()
    val now = packet.timestamp.ifEmpty { Instant.now().toString() }
    val patientRef = FhirReference("Patient/${packet.patientId}")

    packet.meanGlucoseMgDl?.let { glucose ->
      obsList.add(
        FhirObservation(
          id = "obs-cgm-${UUID.randomUUID()}",
          status = "final",
          category = listOf(FhirCodeableConcept(listOf(FhirCoding("http://terminology.hl7.org/CodeSystem/observation-category", "laboratory", "Laboratory")))),
          code = FhirCodeableConcept(listOf(FhirCoding("http://loinc.org", "97507-8", "Continuous glucose monitoring summary")), "CGM Mean Glucose"),
          subject = patientRef,
          effectiveDateTime = now,
          valueQuantity = FhirQuantity(glucose, "mg/dL", "http://unitsofmeasure.org", "mg/dL")
        )
      )
    }

    if (packet.systolicBp != null && packet.diastolicBp != null) {
      obsList.add(
        FhirObservation(
          id = "obs-cuff-${UUID.randomUUID()}",
          status = "final",
          category = listOf(FhirCodeableConcept(listOf(FhirCoding("http://terminology.hl7.org/CodeSystem/observation-category", "vital-signs", "Vital Signs")))),
          code = FhirCodeableConcept(listOf(FhirCoding("http://loinc.org", "85354-9", "Blood pressure panel with device")), "Connected Blood Pressure Cuff"),
          subject = patientRef,
          effectiveDateTime = now,
          valueQuantity = FhirQuantity(packet.systolicBp.toDouble(), "mmHg", "http://unitsofmeasure.org", "mm[Hg]")
        )
      )
    }

    packet.ecgRhythm?.let { rhythm ->
      obsList.add(
        FhirObservation(
          id = "obs-ecg-${UUID.randomUUID()}",
          status = "final",
          category = listOf(FhirCodeableConcept(listOf(FhirCoding("http://terminology.hl7.org/CodeSystem/observation-category", "procedure", "Procedure")))),
          code = FhirCodeableConcept(listOf(FhirCoding("http://loinc.org", "11524-6", "EKG study")), "Wearable ECG Rhythm"),
          subject = patientRef,
          effectiveDateTime = now,
          valueString = rhythm
        )
      )
    }

    return obsList
  }
}
