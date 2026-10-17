# Dork FHIR R4 & Medplum Integration Mapping

## 1. Core Principle

Dork uses **HL7 FHIR Release 4 (R4)** as its canonical healthcare data standard.
- Raw FHIR JSON is NEVER exposed directly to Composables.
- Data flows from FHIR resources into strongly-typed Kotlin domain models (`health.dork.app.core.data.model`).
- Compatibility is maintained with Medplum server and the existing Proton Node backend (`apps/api/adapters/fhirAdapter.js`).

---

## 2. Resource Mapping Table

| Dork Domain Concept | FHIR R4 Resource | Key Mapped Attributes |
|---|---|---|
| **Patient Profile** | `Patient` | `name[0].given`, `name[0].family`, `birthDate` (authoritative `YYYY-MM-DD`), `gender`, `telecom` |
| **Doctor / Provider** | `Practitioner` | `name`, `qualification`, `telecom` |
| **Clinic / Center** | `Organization` / `Location` | `name`, `address`, `type` |
| **Appointment** | `Appointment` | `status` (`proposed`, `pending`, `booked`, `arrived`, `fulfilled`, `cancelled`), `start`, `end`, `participant`, `description` |
| **Medical Condition** | `Condition` | `code.text`, `clinicalStatus`, `verificationStatus`, `onsetDateTime` |
| **Allergy** | `AllergyIntolerance` | `code.text`, `criticality` (`low`, `high`), `category` |
| **Prescription Plan** | `MedicationRequest` | `medicationCodeableConcept`, `status`, `intent`, `dosageInstruction[0].text`, `dosageInstruction[0].route` |
| **Lab Test Result** | `Observation` | `code.text`, `valueQuantity.value`, `valueQuantity.unit`, `referenceRange[0].low`, `referenceRange[0].high` |
| **Diagnostic Report** | `DiagnosticReport` | `code`, `status`, `issued`, `conclusion`, `result` (references to `Observation`) |
| **Medical Document** | `DocumentReference` | `status`, `type`, `date`, `content[0].attachment.url`, `content[0].attachment.contentType` |
| **Doctor Chat** | `Communication` | `status`, `sender`, `recipient`, `payload[0].contentString`, `sent` |

---

## 3. Authoritative Date of Birth & Age Computation

Per FHIR R4 Patient specification, `birthDate` is stored as an ISO-8601 string (`YYYY-MM-DD`).
Age is never stored statically in the database. Instead, `DateCalculators.calculateAge(birthDate)` dynamically computes the exact integer age at runtime, ensuring leap-year correctness and timezone consistency.

---

## 4. Medplum Client Integration

`FhirApiClient` supports two modes configured via `FhirConfig`:
1. `SYNTHETIC_STORE`: An in-memory, thread-safe deterministic store for demo mode, development, and offline operation.
2. `MEDPLUM_LIVE`: Direct REST communication with Medplum endpoints (e.g. `http://localhost:8103/fhir/R4/*`) using standard HTTP headers:
   - `Content-Type: application/fhir+json`
   - `Authorization: Bearer <TOKEN>`
   - `If-None-Exist: identifier=<SYSTEM>|<VALUE>` for idempotent creation.
