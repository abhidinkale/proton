# Dork Testing Strategy & Verification Suite

## 1. Overview

Testing in Dork validates healthcare correctness, dynamic age derivations, FHIR schema compliance, medication safety, and AI boundaries from day one.

---

## 2. Test Suites

### A. Date and Dynamic Age Tests (`DateCalculatorsTest.kt`)
- **Authoritative Date Calculation**: Validates that age is computed from `birthDate` dynamically (Alex Morgan, born `1998-05-12` -> 28 years).
- **Leap Year Calculations**: Verifies Feb 29 birth date behavior across leap and non-leap years (Feb 28 vs March 1 anniversary transitions).
- **Future Date Handling**: Verifies that future birth dates are rejected.
- **BMI Calculation & Categorization**: Verifies formula `Weight / (Height^2)` and threshold classifications (Underweight, Healthy, Overweight, Obese).

### B. Patient Profile Tests (`PatientProfileTest.kt`)
- **Profile Completion Percentage**: Tests scoring across complete vs incomplete fields.
- **Dynamic Age Derivation**: Verifies that updating `birthDate` automatically updates `calculatedAge` across all domain entities.

### C. Medication Safety Tests (`MedicationRepositoryTest.kt`)
- **State Transitions**: Tests `Due -> Taken` with timestamp recording, and `Upcoming -> Skipped`.
- **Dose Adherence**: Validates non-judgmental adherence percentage calculations.
- **Data Integrity**: Ensures server updates do not overwrite patient-facing medication instructions.

### D. Care & Booking Tests (`CareRepositoryTest.kt`)
- **Doctor Discovery**: Tests lookup by ID and specialty filtering.
- **Appointment Booking**: Validates creation of confirmed appointments with slot and consultation type.
- **Pre-Consultation Summary**: Validates addition of structured patient chief complaints and symptom checklists.

### E. AI Safety Guardrail Tests (`DorkAiSafetyTest.kt`)
- **Urgent Symptom Warning**: Verifies that queries containing *"chest pain"* or *"cannot breathe"* trigger immediate emergency notices advising the user to contact emergency services (911).
- **Record Citations**: Verifies that questions regarding lab results or medications return structured responses citing specific longitudinal health records.

### F. FHIR R4 Serialization Tests (`FhirModelsSerializationTest.kt`)
- **Schema Compatibility**: Tests bidirectional JSON serialization/deserialization for `FhirPatient` and `FhirAppointment`.
- **In-Memory Store**: Verifies synthetic store persistence and retrieval.

### G. Security Tests (`SecurityManagerTest.kt`)
- **PHI Masking**: Verifies patient full name masking (*"Alex Morgan"* -> *"A*** M*****"*).
- **Email Masking**: Verifies email masking (*"alex.morgan@synthetic.dork.health"* -> *"a***n@synthetic.dork.health"*).

---

## 3. Running Tests

```bash
cd apps/dork-android
./gradlew test
```
All 22 unit tests execute in under 2 seconds.
