# ADR-004: Unified Clinical Context Engine & Specialty Relevance Filtering

## Status
Accepted

## Context
Patient context retrieval is currently implemented directly inside `ClinicalPipeline.prototype.retrieveContext()` (`apps/api/services/clinical/clinicalPipeline.js`) and `fhirService.js`.
While it retrieves patient records and performs tenant isolation, it fetches a flat list of conditions, medications, and encounters.
In a multi-specialty clinical operating system, dumping the entire chart into every specialist agent creates:
1. Context window bloat and unnecessary API token costs.
2. Cognitive overload and distraction for specialized models.
3. Lack of specialty-specific relevance filtering (e.g. Cardiology needs ECGs, lipids, vitals, cardiac history; Dermatology needs skin exam observations, topical meds, allergy history).

## Decision
Create a dedicated `ClinicalContextEngine` in `apps/api/services/clinical/clinicalContextEngine.js`:
* **Input:**
  * `patientId`: Required patient identifier.
  * `encounterId`: Optional current encounter reference.
  * `specialty`: Optional target specialty (e.g. `'cardiology'`, `'endocrinology'`).
  * `clinicalQuery`: Optional question or chief complaint text.
* **Mechanism:**
  * Wraps existing `fhirService.getPatientClinicalContext()` for patient data retrieval and tenant isolation.
  * Incorporates deterministic chronological sorting and temporal diffs from `longitudinalService.js`.
  * Integrates multimodal intake and acute image data from `multimodalContextService.js`.
  * Applies **specialty relevance filtering**: Filters conditions, observations, medications, and prior encounters to highlight high-signal records relevant to the queried specialty.
  * Preserves full source provenance: Every retrieved item retains its authoritative FHIR resource reference (e.g. `Observation/obs-hba1c-current`, `MedicationRequest/mr-lisinopril`).
* **Safety Invariant:** Never mixes records across patients. Fails closed with `PATIENT_NOT_FOUND (404)` if patient does not exist, and `CROSS_TENANT_ACCESS_DENIED (403)` on tenant mismatch.

## Alternatives Considered
1. *Keep fetching full chart in `clinicalPipeline.js`:* Rejected because specialist agents require targeted relevance ranking and context optimization.
2. *Let each agent query FHIR independently:* Rejected because redundant database/FHIR reads would degrade performance and complicate audit logging.

## Why This Decision
* Centralizes context retrieval, caching, and specialty relevance filtering in a single auditable engine.
* Reuses existing validated FHIR adapters and longitudinal services.

## Risks & Mitigations
* *Risk:* Over-aggressive filtering hides a critical finding relevant to an unexpected specialty.
* *Mitigation:* Always retain core safety data (all active allergies, all current medications, severe chronic conditions) in the base context regardless of specialty.

## Migration Strategy
1. Construct `ClinicalContextEngine` wrapping `fhirService` and `longitudinalService`.
2. Connect `ClinicalPipeline` Stage 3 to call `ClinicalContextEngine`.
3. Provide specialty-filtered context slices to `SpecialistAgentRegistry`.

## Testing Strategy
* Relevance tests (verifying Cardiology receives cardiac records, Endocrinology receives glycemic records).
* Cross-patient tampering tests (guaranteeing 0 cross-contamination between Patient A and Patient B).
* Empty chart and missing data tests.
