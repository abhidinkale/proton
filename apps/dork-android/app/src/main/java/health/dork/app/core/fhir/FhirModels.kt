package health.dork.app.core.fhir

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * Standard FHIR R4 Data Models compatible with Medplum and Proton Operations OS.
 */

@Serializable
data class FhirMeta(
  val versionId: String? = null,
  val lastUpdated: String? = null,
  val tag: List<FhirCoding>? = null
)

@Serializable
data class FhirCoding(
  val system: String? = null,
  val code: String? = null,
  val display: String? = null
)

@Serializable
data class FhirCodeableConcept(
  val coding: List<FhirCoding>? = null,
  val text: String? = null
)

@Serializable
data class FhirReference(
  val reference: String? = null,
  val display: String? = null,
  val type: String? = null
)

@Serializable
data class FhirPeriod(
  val start: String? = null,
  val end: String? = null
)

@Serializable
data class FhirQuantity(
  val value: Double? = null,
  val unit: String? = null,
  val system: String? = null,
  val code: String? = null
)

@Serializable
data class FhirHumanName(
  val use: String? = "official",
  val text: String? = null,
  val family: String? = null,
  val given: List<String>? = null
)

@Serializable
data class FhirContactPoint(
  val system: String? = "phone", // phone, email
  val value: String? = null,
  val use: String? = "mobile"
)

@Serializable
data class FhirAddress(
  val line: List<String>? = null,
  val city: String? = null,
  val state: String? = null,
  val postalCode: String? = null,
  val country: String? = null
)

// Patient Resource
@Serializable
data class FhirPatient(
  val resourceType: String = "Patient",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val active: Boolean = true,
  val name: List<FhirHumanName>? = null,
  val telecom: List<FhirContactPoint>? = null,
  val gender: String? = null, // male, female, other, unknown
  val birthDate: String? = null, // YYYY-MM-DD (Authoritative)
  val address: List<FhirAddress>? = null
)

// Practitioner Resource
@Serializable
data class FhirPractitioner(
  val resourceType: String = "Practitioner",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val active: Boolean = true,
  val name: List<FhirHumanName>? = null,
  val telecom: List<FhirContactPoint>? = null,
  val qualification: List<FhirCodeableConcept>? = null
)

// Appointment Resource
@Serializable
data class FhirAppointmentParticipant(
  val actor: FhirReference? = null,
  val required: String? = "required",
  val status: String? = "accepted"
)

@Serializable
data class FhirAppointment(
  val resourceType: String = "Appointment",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val status: String, // proposed, pending, booked, arrived, fulfilled, cancelled, noshow
  val serviceCategory: List<FhirCodeableConcept>? = null,
  val serviceType: List<FhirCodeableConcept>? = null,
  val description: String? = null,
  val start: String? = null, // ISO-8601
  val end: String? = null,   // ISO-8601
  val created: String? = null,
  val comment: String? = null,
  val participant: List<FhirAppointmentParticipant> = emptyList()
)

// MedicationRequest Resource
@Serializable
data class FhirDosageInstruction(
  val text: String? = null,
  val route: FhirCodeableConcept? = null,
  val asNeededBoolean: Boolean? = false
)

@Serializable
data class FhirMedicationRequest(
  val resourceType: String = "MedicationRequest",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val status: String, // active, completed, entered-in-error, stopped, on-hold
  val intent: String = "order",
  val medicationCodeableConcept: FhirCodeableConcept? = null,
  val subject: FhirReference? = null, // Patient/123
  val authoredOn: String? = null,
  val requester: FhirReference? = null, // Practitioner/456
  val dosageInstruction: List<FhirDosageInstruction>? = null,
  val note: List<FhirAnnotation>? = null
)

@Serializable
data class FhirAnnotation(
  val text: String? = null,
  val time: String? = null
)

// Observation Resource (Vitals, Lab tests, Body metrics)
@Serializable
data class FhirObservationReferenceRange(
  val low: FhirQuantity? = null,
  val high: FhirQuantity? = null,
  val text: String? = null
)

@Serializable
data class FhirObservation(
  val resourceType: String = "Observation",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val status: String, // registered, preliminary, final, amended
  val category: List<FhirCodeableConcept>? = null,
  val code: FhirCodeableConcept,
  val subject: FhirReference? = null,
  val effectiveDateTime: String? = null,
  val valueQuantity: FhirQuantity? = null,
  val valueString: String? = null,
  val interpretation: List<FhirCodeableConcept>? = null,
  val referenceRange: List<FhirObservationReferenceRange>? = null
)

// DiagnosticReport Resource
@Serializable
data class FhirDiagnosticReport(
  val resourceType: String = "DiagnosticReport",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val status: String, // registered, preliminary, final, amended
  val category: List<FhirCodeableConcept>? = null,
  val code: FhirCodeableConcept,
  val subject: FhirReference? = null,
  val effectiveDateTime: String? = null,
  val issued: String? = null,
  val performer: List<FhirReference>? = null,
  val result: List<FhirReference>? = null, // references to Observations
  val conclusion: String? = null
)

// DocumentReference Resource
@Serializable
data class FhirAttachment(
  val contentType: String? = null,
  val url: String? = null,
  val size: Long? = null,
  val title: String? = null,
  val creation: String? = null
)

@Serializable
data class FhirDocumentContent(
  val attachment: FhirAttachment
)

@Serializable
data class FhirDocumentReference(
  val resourceType: String = "DocumentReference",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val status: String, // current, superseded, entered-in-error
  val docStatus: String? = null,
  val type: FhirCodeableConcept? = null,
  val category: List<FhirCodeableConcept>? = null,
  val subject: FhirReference? = null,
  val date: String? = null,
  val description: String? = null,
  val content: List<FhirDocumentContent> = emptyList()
)

// Condition Resource
@Serializable
data class FhirCondition(
  val resourceType: String = "Condition",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val clinicalStatus: FhirCodeableConcept? = null,
  val verificationStatus: FhirCodeableConcept? = null,
  val category: List<FhirCodeableConcept>? = null,
  val code: FhirCodeableConcept,
  val subject: FhirReference? = null,
  val onsetDateTime: String? = null
)

// AllergyIntolerance Resource
@Serializable
data class FhirAllergyIntolerance(
  val resourceType: String = "AllergyIntolerance",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val clinicalStatus: FhirCodeableConcept? = null,
  val verificationStatus: FhirCodeableConcept? = null,
  val type: String? = null, // allergy | intolerance
  val category: List<String>? = null, // food | medication | environment | biologic
  val criticality: String? = null, // low | high | unable-to-assess
  val code: FhirCodeableConcept,
  val patient: FhirReference? = null
)

// Communication Resource (Doctor Chat)
@Serializable
data class FhirCommunicationPayload(
  val contentString: String? = null
)

@Serializable
data class FhirCommunication(
  val resourceType: String = "Communication",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val status: String, // preparation | in-progress | not-done | on-hold | stopped | completed | entered-in-error | unknown
  val sender: FhirReference? = null,
  val recipient: List<FhirReference>? = null,
  val payload: List<FhirCommunicationPayload> = emptyList(),
  val sent: String? = null
)

// ServiceRequest Resource (Laboratory & Diagnostic Workup Requisition)
@Serializable
data class FhirServiceRequest(
  val resourceType: String = "ServiceRequest",
  val id: String? = null,
  val meta: FhirMeta? = null,
  val status: String, // draft | active | on-hold | revoked | completed | entered-in-error | unknown
  val intent: String = "order", // proposal | plan | directive | order | original-order | reflex-order | filler-order | instance-order | option
  val priority: String? = "routine", // routine | urgent | asap | stat
  val code: FhirCodeableConcept, // LOINC or CPT test code
  val subject: FhirReference, // Reference to Patient
  val requester: FhirReference? = null, // Reference to Practitioner or Autonomous Diagnostic Agent
  val authoredOn: String? = null, // ISO-8601
  val reasonCode: List<FhirCodeableConcept>? = null, // Clinical indication
  val supportingInfo: List<FhirReference>? = null,
  val note: List<FhirAnnotation>? = null
)
