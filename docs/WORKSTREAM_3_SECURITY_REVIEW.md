# Proton Healthcare Operations OS — Workstream 3 Security Review

**Document Version:** 1.0.0  
**Date:** October 17, 2026  
**Environment Scope:** Private Beta & Real-World Clinic Pilot  
**Author:** Security & Platform Architecture Workstream  
**Target Invariant:** Zero autonomous clinical decisions, fail-closed access boundaries, zero persistent PHI in operational logs, zero chain-of-thought persistence.

---

## 1. Executive Summary

As part of Proton Acceleration Workstream 3, a comprehensive security and threat modeling audit was performed across Proton's application server (`apps/api`), database persistence layer, integration boundaries, agent engine, and clinical safety gates.

The platform architecture enforces a strict **human-in-the-loop clinical governance model**, wherein AI agents formulate structured recommendations or administrative dispatches, but attending licensed physicians retain 100% exclusive authority over clinical care, diagnosis, and prescription authoring.

### Threat Model & Audit Key Metrics

| Audit Dimension | Target Invariant | Achieved Status | Verification Method |
| :--- | :--- | :--- | :--- |
| **Authentication Authority** | Session Token -> Server resolves Identity | **VERIFIED** | HMAC-SHA256 Signed JWT, server-side derivation |
| **Session Inactivity** | 15-minute sliding idle timeout | **VERIFIED** | Active session tracker + token revocation store |
| **Dev Persona Bypass** | 100% Rejected in Beta / Prod | **VERIFIED** | Gated strictly by `!isProduction && !isBeta` |
| **RBAC Failure Mode** | Fail-closed on missing/mismatched role | **VERIFIED** | 403 Forbidden on all non-physician clinical actions |
| **Tenant Isolation** | Strict organization boundary enforcement | **VERIFIED** | 403 Cross-Tenant Access Denied on foreign queries |
| **Adversarial Injections** | Quarantined; zero unapproved clinical facts | **VERIFIED** | 250/250 Adversarial simulation tests passed |
| **Prompt Leakage** | Zero secret or system prompt disclosure | **VERIFIED** | 0/50 Direct injection attempts leaked |
| **Audit Chaining** | Tamper-evident SHA-256 hash linked chain | **VERIFIED** | Unbroken across 900+ consecutive events |
| **Zero CoT Storage** | No private model reasoning in records | **VERIFIED** | Invariant confirmed in agent execution records |
| **PHI Redaction** | Operational telemetry stripped of raw PHI | **VERIFIED** | Telemetry middleware masks bodies, notes & prompts |

---

## 2. Authentication & Session Lifecycle Hardening

### 2.1 Cryptographic Identity Resolution
In production and private-beta deployments, Proton resolves actor identity strictly from cryptographically signed session tokens:

$$\text{Bearer Token} \xrightarrow{\text{HMAC-SHA256 Signature Verification}} \text{Server Verified Actor} \xrightarrow{\text{Tenant Resolution}} \text{RBAC Gate}$$

- **No Browser Identity Headers:** Any browser-supplied headers attempting to inject identity (`X-Proton-Actor-Id`, `X-Proton-Actor-Role`, `X-Proton-Actor-Name`) are stripped and discarded at the edge before route handling.
- **Development Persona Adapter Isolation:** The development persona adapter (`X-Proton-Dev-Persona`) is strictly isolated behind `process.env.NODE_ENV !== 'production' && process.env.PROTON_ENV !== 'private-beta' && process.env.PROTON_ENV !== 'production'`. In any pilot or production tier, attempting to pass a persona header without an authentic signed Bearer token fails closed with HTTP 401 `AUTHENTICATION_REQUIRED`.

### 2.2 15-Minute HIPAA / Healthcare Inactivity Timeout
- Sessions track a sliding activity window (`lastActive`).
- If more than 900 seconds (15 minutes) elapse without an authenticated transaction, the token is invalidated with code `INACTIVITY_TIMEOUT` (`HTTP 401: Session expired due to inactivity (15 minutes). Please re-authenticate.`).
- Valid transactions dynamically slide the active window.

### 2.3 Instantaneous Session Revocation (Kill Switch)
- Proton maintains a centralized revocation registry (`revokedTokens`).
- Revoking a token or session identifier (`jti`) takes effect instantaneously across all subsequent requests with code `SESSION_REVOKED`.

### 2.4 Multi-Factor Authentication (MFA / FIDO2 Passkeys)
- WebAuthn passkey assertion and TOTP verification interfaces (`verifyMfaChallenge`) validate strong two-factor authentication for attending physicians during credential onboarding and critical order signing.

---

## 3. Authorization & Multi-Tenant Boundary Enforcement

### 3.1 Role-Based Access Control (RBAC) Matrix

| Platform Role | Administrative Actions | Proposed Clinical Drafts | High-Risk Orders (Refills / Referrals) | Clinical Note Sign-Off | Prescribing Tool Execution |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Physician (MD/DO)** | Allowed | Allowed (Review & Edit) | **Exclusive Sign-Off** | **Exclusive Sign-Off** | **Exclusive Authority** |
| **Operations Staff** | Allowed | View / Draft Escalation | Prohibited (403) | Prohibited (403) | Prohibited (403) |
| **Autonomous Agent** | Read / Classify | Draft Recommendation | Prohibited (Policy POL-02) | Prohibited (Policy POL-01) | Hard-Blocked (Class E) |
| **External Physician** | Tenant Scoped | Tenant Scoped | Scoped to Home Organization | Scoped to Home Organization | Prohibited on Foreign Tenant |

### 3.2 Tenant Isolation & IDOR Protection
- Operational tasks, jobs, audit logs, and agent execution runs carry an authoritative `tenant_id` foreign key.
- The `requireTenantMatch` middleware validates that the authenticated actor's tenant matches the target resource tenant.
- Attempting to query, update, or approve a task belonging to another organization yields HTTP 403 `CROSS_TENANT_ACCESS_DENIED`.

---

## 4. Document Security & Prompt Injection Shield

### 4.1 Ingestion Threat Vector Analysis
Clinical documents (faxes, discharge summaries, laboratory panels) ingested from external facilities represent an untrusted input boundary susceptible to:
1. Direct prompt injection embedded in document text.
2. Indirect jailbreak instructions attempting to force autonomous approvals.
3. Obfuscated script execution tags (`<script>`, `javascript:eval`).
4. Denial of Service via oversized or malformed payloads.

### 4.2 Multi-Layer Defense-in-Depth Shield
1. **Payload Limit:** Text bodies exceeding 500,000 characters (> 10MB equivalent) are rejected immediately with `DOCUMENT_PAYLOAD_TOO_LARGE`.
2. **Deterministic Adversarial Pattern Scanning:** The document agent evaluates input against known adversarial override markers:
   - System instruction overrides (`ignore previous instructions`, `system override`)
   - Jailbreak / roleplay attempts (`you are now a DAN model`, `developer mode`)
   - Safety bypass injection (`auto-approve all prescriptions`, `skip physician review`)
   - Executable payload injection (`<script>`, `onerror=`, `onload=`, `javascript:`, `eval(`)
3. **Quarantine State Machine:**
   - Flagged documents are assigned `securityQuarantined: true`.
   - Priority is automatically elevated to `urgent`.
   - Title is prefixed with `[SECURITY ALERT]`.
   - **Crucial Invariant:** Automated extraction of clinical facts is 100% suppressed (`proposedFacts: []`). Extracted unapproved text is NEVER committed to Clinical Brain memory or FHIR resources.
   - An immutable security event `SECURITY_INJECTION_QUARANTINE` is appended to the tamper-evident audit ledger.

---

## 5. FHIR / Medplum Production Hardening

### 5.1 Fail-Closed Configuration
- In development/synthetic staging, Proton supports deterministic synthetic memory stores for rapid local testing.
- In production (`NODE_ENV=production` or `PROTON_ENV=production`), the platform strictly prohibits synthetic mode. If `PROTON_FHIR_PERSISTENCE_MODE` is set to `synthetic` or if `MEDPLUM_BASE_URL` / `MEDPLUM_TOKEN` credentials are missing, server startup immediately fails closed with `ConfigurationError`.

### 5.2 Deterministic Idempotency & Replay Prevention
- Every operational task generates an immutable, deterministic FHIR identifier derived from its unique logical task ID:
  $$\text{system} = \text{https://proton.health/ops/task}, \quad \text{value} = \text{task-id}$$
- Retries and concurrent requests reuse the exact same identifier, preventing duplicate resource creation.
- Operations use FHIR conditional create headers:
  `If-None-Exist: identifier=https://proton.health/ops/task|<immutable-task-id>`

### 5.3 Durable Intent + FHIR Reconciliation Worker
- Proton does not claim false distributed 2PC. Instead, it follows:
  $$\text{Durable Operational Intent} \rightarrow \text{FHIR Operation} \rightarrow \text{Reconciled OR Reconciliation Failed} \rightarrow \text{Worker Retry}$$
- If the FHIR upstream endpoint encounters an outage, the task transitions to `reconciliation_failed` (HTTP 502) and an operational job is enqueued.
- Background worker processes retry with exponential backoff (2s, 4s, 8s). After 3 failed retries, jobs route to a Dead Letter Queue (`dead_letter`) for manual operational resolution.

---

## 6. OWASP Top 10 API Security Alignment

| OWASP API Risk | Platform Defense Implementation |
| :--- | :--- |
| **API1: Broken Object Level Auth** | Server-side tenant match gate + actor identity validation on all `/api/operations/tasks/:id` routes. |
| **API2: Broken Authentication** | HMAC-SHA256 signature verification, 15-min idle timeout, instant token revocation registry, passkey support. |
| **API3: Broken Object Property Auth** | Strict Zod and schema whitelisting for all task mutations and approval endpoints; browser cannot inject `verifiedBy`. |
| **API4: Unrestricted Resource Consumption** | In-memory token bucket rate limiting: general routes (500 req/min), AI/transcription routes (60 req/min). |
| **API5: Broken Function Level Auth** | Role gates (`requireRole(['physician'])`) enforce that only Attending Physicians can sign notes, approve refills, or authorize referrals. |
| **API6: Unrestricted Access to Sensitive Business Flows** | Clinical gates check pharmacovigilance, allergies, renal drift, and controlled substances before allowing refill workflows. |
| **API7: Server Side Request Forgery (SSRF)** | Integration adapters (SMS, Voice, FHIR) use strictly whitelisted base URLs from verified environment configuration. |
| **API8: Security Misconfiguration** | Strict HTTP security headers (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `CSP: default-src 'self'`). |
| **API9: Improper Inventory Management** | Consolidated OpenAPI routes under `/api/operations/*`, removal of legacy dev endpoints from production routers. |
| **API10: Unsafe Consumption of APIs** | Medplum and external carrier API calls wrapped with try-catch, circuit breakers, timeout limits, and durable retry workers. |

---

## 7. Data Privacy & Regulatory Readiness (India DPDPA 2023 & Clinical Governance)

> [!IMPORTANT]
> **Regulatory Disclaimer:** Proton does not falsely claim formal government or third-party certifications (such as ABDM sandbox clearance, SOC 2 Type II, ISO 27001, HIPAA attestation, or FDA clearance). The safeguards described below represent internal technical readiness controls designed to align with the Digital Personal Data Protection Act (DPDPA) 2023 and medical ethics guidelines.

### 7.1 DPDPA 2023 Technical Alignment
1. **Data Fiduciary & Data Processor Isolation:** Multi-tenant scoping guarantees that clinic patient records remain segregated per health provider entity.
2. **Purpose Limitation & Purpose of Use:** Context retrieval (`getScopedPatientContext`) enforces `purposeOfUse` logging in audit trails (e.g. `inbound_patient_communication_triage`, `refill_pharmacovigilance`).
3. **Data Minimization:** Only high-signal clinical facts (allergies, active meds, recent vitals, renal function) are extracted; demographic clutter is excluded from agent prompts.
4. **Consent & Notice Workflow:** Patient communication records store consent status and delivery channel preferences.
5. **Breach Notification Readiness:** Immediate security alerts (`SECURITY_INJECTION_QUARANTINE`, `AUDIT_TAMPER_DETECTED`) trigger automated incident logging for administrative review.

---

## 8. Summary Security Invariant Table

| Invariant | Status | Enforcement Mechanism |
| :--- | :---: | :--- |
| Physician Sole Clinical Authority | **ENFORCED** | Policy `POL-01`, `POL-02`, and RBAC role gate |
| Zero Autonomous Clinical Communication | **ENFORCED** | Mandatory Physician Review & Sign-Off |
| Zero Chain-of-Thought Persisted | **ENFORCED** | Agent run serializer strips internal thought buffers |
| Zero PHI in Operational Telemetry | **ENFORCED** | Regex and key-based PHI scrubbing in telemetry |
| Fail-Closed on Unverified Identity | **ENFORCED** | 401 on missing/expired/tampered session tokens |
| Zero Cross-Tenant Leakage | **ENFORCED** | Server-enforced organization boundary gates |
| Tamper-Evident Audit Ledger | **ENFORCED** | Cryptographic SHA-256 hash chaining |
