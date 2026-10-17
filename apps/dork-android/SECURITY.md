# Dork Healthcare Security & Privacy Specification

## 1. Zero PHI in Logs Principle

Under HIPAA and GDPR principles, Protected Health Information (PHI) must never be emitted into unencrypted or unmasked logs:
- `SecurityManager.maskPhi(name)` transforms `"Alex Morgan"` to `"A*** M*****"`.
- `SecurityManager.maskEmail(email)` transforms `"alex.morgan@synthetic.dork.health"` to `"a***n@synthetic.dork.health"`.
- FHIR JSON objects containing patient demographics, conditions, or clinical narratives are strictly prohibited from `android.util.Log` or analytics payloads.

---

## 2. Screen Privacy & Recents Protection

For high-sensitivity screens (such as the **Emergency Medical ID** or **Prescription Details**):
- `SecurityManager.enableScreenSecurity(activity)` applies `WindowManager.LayoutParams.FLAG_SECURE`.
- This prevents Android OS recents snapshots, screenshot capture, and screen-sharing leaks.

---

## 3. Demo Mode Isolation

Section 74 of the product directive dictates that Demo Mode must never accidentally interact with production healthcare data.
- The `DorkSeedData` synthetic patient (Alex Morgan, DOB 12 May 1998, O+) is completely isolated within the synthetic storage layer.
- Demo mode uses a synthetic identifier namespace (`patient-synthetic-*`) that fails validation if sent to production Medplum endpoints.

---

## 4. Family Profile Clinical Isolation

Section 38 requires strict authorization boundaries for future dependent profiles (Mother, Father, Child).
- Each family profile maintains a distinct `Patient` identifier.
- Cached queries and local records are strictly isolated by `tenantId` and `patientId` to eliminate the risk of accidental record cross-contamination.

---

## 5. Dork AI Clinical Safety Boundaries

- Dork AI is explicitly constrained to informational and navigational guidance.
- Dork AI is programmatically blocked from generating autonomous prescriptions, altering dosages, or issuing diagnostic conclusions.
- When emergent keywords (such as *"chest pain"*, *"cannot breathe"*, *"sudden numbness"*) are detected, the system immediately returns an emergency prompt advising the patient to call 911 or visit the nearest emergency facility.
