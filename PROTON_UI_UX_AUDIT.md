# PROTON UI/UX ARCHITECTURAL AUDIT & REDESIGN BLUEPRINT
**Reference-Driven Clinical Workspace Transformation**
*Date: 2026-10-18 | Role: Lead Product Designer & Frontend Architect*

---

## 1. Executive Summary

Proton is an AI-native clinical operating system built on a FHIR R4 data core, designed for licensed clinicians. This audit establishes the baseline of the current web and desktop user interface, identifies architectural and UX deficits, analyzes the attached high-polish reference designs, and defines the phased migration path to achieve an **Intelly-level aesthetic polish combined with Proton's mission-critical clinical safety, FHIR fidelity, and AI copilot architecture**.

---

## 2. Inventory of Current Web Routes & Components

### 2.1 Route Architecture (`apps/web/src/App.tsx`)
| Route | Component | Current State | Target State |
| :--- | :--- | :--- | :--- |
| `/` & `/dashboard` | `Dashboard.tsx` | Functional dashboard with roster & quick actions | Full Reference 1 transformation: pastel 2x2 metric grid, timeline rail, visit detail inspector |
| `/patients` | `Patients.tsx` | Medplum FHIR patient list with search | High-density clinical table with risk chips, triage status, and quick-filter tabs |
| `/patients/:id` | `PatientProfile.tsx` | Multi-tab patient profile (overview/timeline/docs) | Reference 2 transformation: demographics badge card, allergy alerts, lab cards, timeline |
| `/consultation` | `Consultation.tsx` / `DoctorDeskEncounter.tsx` | Ambient consultation with speech, SOAP, and safety checks | Reference 2 consultation view with floating/docked Proton AI copilot and clinical tabs |
| `/document-review` | `DocumentReview.tsx` | Optical extraction viewer | Split-pane document viewer with verified facts, confidence chips, and FHIR linking |
| `/schedule` | *New Route* (presently inline `TodaySchedule.tsx`) | Embedded component in Dashboard | Reference 4 full calendar workspace: Day/Week/Month grid with colored appointment cards |
| `/assistant` | `Assistant.tsx` | Standalone AI assistant page | Conversational clinical brain with chart context, guideline retrieval, and safety provenance |
| `/education` | *New Route* | Non-existent | Reference 3 Knowledge & CME center: Live grand rounds, guideline updates, article library |
| `/billing` | *New Route* (presently embedded `BillingCodingAdvisor.tsx`) | Sub-component inside encounter | Reference 5 Billing & Invoices workspace: Donut distribution, CPT metrics, transaction ledger |
| `/operations` | `Operations.tsx` | Queues, refills, imaging triage | Polished operational workspace with practice ROI, triage inbox, referral pipeline |
| `/settings` | `Settings.tsx` | Workspace and credentials settings | Unified clinical settings, theme preferences, and sync diagnostics |

### 2.2 Reusable Component Inventory (`apps/web/src/components/`)
* **Existing Clinical Components:**
  * `DoctorDeskEncounter.tsx`: High-velocity ambient scribe, real-time transcription, and SOAP drafting.
  * `DoctorDeskHome.tsx`: Compact home desk view with schedule and alerts.
  * `BillingCodingAdvisor.tsx`: E/M coding (CPT 99213-99215) and MDM level calculator.
  * `NurseRoomingWorkspace.tsx`: Pre-encounter rooming, vitals acquisition, and symptom intake.
  * `PhysicianSignOffModal.tsx`: Explicit clinician authorization gate for FHIR persistence.
  * `StructuredTreatmentPlan.tsx`: Discrete orders, prescriptions, and follow-ups.
  * `ProvenanceBadge.tsx`, `StatusBadge.tsx`, `ConfidenceBadge.tsx`, `ClinicalAlert.tsx`: Existing clinical badges.
  * `TodaySchedule.tsx`: Day schedule list component.
* **Reusable Assets to Retain & Modernize:**
  * All deterministic safety engines (`safetyService`, `jevSafetyGuardrailService`).
  * All Medplum FHIR R4 transactions and atomic batching.
  * Real-time audio ingestion and AudioWorklet pipeline.
  * Structured intake schemas and OCR fact verification.

---

## 3. Analysis of Reference Screenshots

| Reference Screen | Key UX Elements | Visual Language & Composition | Translation to Proton |
| :--- | :--- | :--- | :--- |
| **1. Main Dashboard** | 2x2 metric cards (Canary, Rose, Olive, Periwinkle), horizontal patient queue, focused visit card, right-side mini calendar & vertical time rail | Warm off-white canvas (`#F9F8F5`), charcoal navigation (`#151619`), rounded cards (`24px`), pill search with filter chips | Transform `Dashboard.tsx` into this exact layout, powered by real patient roster and FHIR encounters |
| **2. Patient Overview & Visit Details** | Demographics card with MRN badge `1EG4-TE5-MK72`, allergies with alert count & split food/environment cards, clinical lab cards with reference ranges, docked dark AI copilot | High visual hierarchy, soft pastel accents, clear distinction between clinician-authored and AI content | Implement in `PatientProfile.tsx` and `DoctorDeskEncounter.tsx`, linking with Medplum observations & allergies |
| **3. Knowledge & Education** | "Live now" video hero banner with specialty badge, weekly column cards with speaker tags, right rail with field updates, top articles, and new uploads | Editorial warmth, rich metadata tags, media thumbnails | Create dedicated `/education` page with clinical guideline updates, CME sessions, and clinical reference library |
| **4. Scheduling / Calendar** | Day/Week/Month switcher, multi-column time grid, color-coded appointments by type, red current-time marker (`07:21`), participant avatars | Clean grid lines, spacious cards with action buttons ("Join", "In progress") | Build `/schedule` page using Proton's master clinic schedule dataset and Medplum Appointment resources |
| **5. Billing & Invoices** | Donut chart distribution, summary cards (Received, Requested, Non-insurance), waiting for bills cards, latest transaction cards, filterable ledger table | Financial clarity, status pills (`Requested`, `Paid`, `Sent`), distinct from clinical data | Build `/billing` page connected to Proton's existing `billingCodingService` and CPT / E&M analyzer |

---

## 4. Current UX Problems & Gaps in Proton Web

1. **Color & Hierarchy Inconsistency:**
   * Previous iterations alternated between cold slate gray, dark blue, and stark white backgrounds.
   * Lacks the warm, calm, human feel (`#F9F8F5` canvas) of modern premier workspaces.
2. **Fragmented Navigation:**
   * Current navigation is a standard vertical list without collapsible rail controls, scope-filtered search pills, or unified keyboard shortcuts.
   * Key clinical modules like Scheduling, Knowledge/Education, and Billing lack dedicated first-class routes despite underlying services existing.
3. **Card Composition & Spacing:**
   * Cards currently use sharp or inconsistent border radii (`0.5rem` to `1rem`), lacking the generous `20px-24px` rounded geometry and pastel semantic coloring from the references.
4. **AI Safety Demarcation:**
   * While Proton has `ProvenanceBadge`, AI drafts in certain panels need unmistakable visual distinction (distinct dark copilot shell or lavender tinted container) with explicit approval controls.
5. **Offline & Sync Visibility:**
   * Offline state is currently indicated by toast messages rather than a subtle, continuous status chip in the top navigation bar.

---

## 5. Architectural & Design Migration Strategy

1. **Phase 1: Design Tokens & CSS Architecture**
   * Introduce complete design tokens for canvas (`#F9F8F5`), navigation rail (`#151619`), card surfaces (`#FFFFFF`), pastel semantic accents (Canary `#FEF08A`, Rose `#FCE7F3`, Olive `#DCFCE7`, Periwinkle `#E0E7FF`, Violet `#F3E8FF`), and clinical typography.
2. **Phase 2: Universal Application Shell (`ProtonShell.tsx`)**
   * Collapsible near-black rail with category groupings, active states, collapse toggle, topbar with pill search and scope chips (`In: [Patients] [Prescriptions] [Test results] [Education]`), Command Palette (`Cmd+K`), notification center, and offline/sync chip.
3. **Phase 3: Screen-by-Screen Reference Transformation**
   * Upgrade Dashboard, Patient List & Profile, Encounter & Scribe, Scheduling, Knowledge/Education, Billing, and Document Review.
4. **Phase 4: Desktop OS & Windowing Capabilities**
   * Support split views, keyboard navigation, and desktop-optimized workspace density.
5. **Phase 5: Automated Verification & Clinical Safety Auditing**
   * Verify zero regression across existing test suites, linting, and type checking.
