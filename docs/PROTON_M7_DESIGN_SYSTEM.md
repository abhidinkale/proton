# PROTON DESIGN SYSTEM (PDS) — SPECIFICATION & ARCHITECTURE

**Product:** Proton AI-Native Multi-Specialty Clinical Operating System  
**Version:** 7.1.0  
**Status:** Canonical Design System Baseline  
**Scope:** Proton Web, Physician Workstation, Proton OS/Desktop, Android Native, and Tablet Formats  

---

## 1. Design Philosophy & North Star Principles

Proton is an **AI-native clinical operating system** engineered to reduce physician cognitive workload while reinforcing the physician as the sole clinical authority. The interface design reflects this mission through five foundational tenets:

1. **Clinical Ergonomics (Calm, Dense, Focused):**
   - The interface must never look like a generic hospital dashboard, a crypto trading app, or an experimental neon AI startup demo.
   - It draws inspiration from high-productivity workspaces ("Bloomberg Terminal meets Linear meets modern clinical software"), utilizing calm warm alabasters (`#F9F8F5`), obsidian rail controls (`#151619`), and restrained functional pastels.
2. **Absolute AI Provenance Transparency:**
   - Machine-generated content, differential hypotheses, and automated draft documentation must **never** be visually indistinguishable from human-attested clinical records.
   - AI drafts feature explicit, non-bypassable provenance framing (`AI generated — physician review required`) with amber/pink soft indicators.
3. **Deterministic Human Approval & Tamper-Binding:**
   - Every clinical record committed to FHIR requires explicit physician review, cryptographic digest binding, and attestation. The UI reflects this with unambiguous lifecycle states (`DRAFT` $\rightarrow$ `REVIEW` $\rightarrow$ `APPROVED` $\rightarrow$ `AMENDED` / `VOIDED`).
4. **Information Density without Cognitive Noise:**
   - Vitals, lab values, MRN identifiers, and dosage regimens utilize tabular numerals and high-legibility typographic hierarchies.
   - Secondary metadata is cleanly disclosed through progressive disclosure and structured paneling rather than visual clutter.
5. **Accessibility & Cross-Platform Unity (WCAG 2.2 AA):**
   - Semantic HTML, high-contrast borders, visible keyboard focus rings, screen-reader annotations, and full keyboard navigation (e.g., `⌘K`, `⌘/`, `⌘↵`, `⌘T`).

---

## 2. Centralized Design Tokens

All tokens are centrally declared in [`apps/web/src/domain/theme/tokens.ts`](file:///Users/abhidinkale/Downloads/proton/apps/web/src/domain/theme/tokens.ts) and surfaced via CSS variables in [`apps/web/src/index.css`](file:///Users/abhidinkale/Downloads/proton/apps/web/src/index.css).

### 2.1 Color Tokens

| Token Category | Token Name | Value | Clinical & UI Usage |
| :--- | :--- | :--- | :--- |
| **Surfaces** | `canvas` | `#F9F8F5` | Primary warm alabaster application canvas |
| | `surface` | `#FFFFFF` | Standard card and workspace panel background |
| | `surfaceSubtle` | `#FAF9F6` | Secondary panel, nested table, and input background |
| | `surfaceSunken` | `#F4F2EC` | Inactive tabs, disabled states, sunken containers |
| | `surfaceHover` | `#F4F3EE` | Interactive card and row hover state |
| **Rail / Dark Chrome** | `rail` | `#151619` | Persistent navigation rail, primary buttons, avatars |
| | `railHover` | `#202227` | Navigation item hover background |
| | `railActive` | `#2B2E35` | Navigation item active background |
| | `railBorder` | `#23252B` | Navigation divider and border |
| **Borders** | `border` | `#E8E5DC` | Standard component border |
| | `borderLight` | `#F0ECE1` | Internal card dividers and sub-borders |
| | `borderStrong`| `#D6D2C4` | Focused cards, prominent panels, active inputs |
| **Typography Ink** | `textPrimary` | `#151719` | Headings, patient names, primary clinical text |
| | `textSecondary`| `#575D65` | Subtitles, clinical observations, section summaries |
| | `textMuted` | `#88909A` | Timestamps, units, captions, keyboard shortcuts |
| | `textOnDark` | `#FFFFFF` | Text on obsidian rail and primary buttons |
| **Brand Accents** | `brand.rose` | `#FCE7F3` | Soft blush pink pill highlights, AI search trigger |
| | `brand.roseText`| `#9D174D` | Deep berry rose text for AI indicators |
| | `brand.canary` | `#FEF08A` | Soft canary yellow for census and review queues |
| | `brand.canaryText`| `#854D0E` | Amber-brown text for attention states |
| | `brand.olive` | `#DCFCE7` | Sage olive background for condition stability |
| | `brand.oliveText`| `#166534` | Forest green text for clinical stability |
| | `brand.periwinkle`| `#E0E7FF` | Soft periwinkle background for consultation sessions |
| | `brand.periwinkleText`| `#1E40AF`| Deep blue text for virtual sessions and orders |

### 2.2 Clinical Semantic Tokens

| Semantic Variant | Background | Text | Border | Dot / Indicator | Meaning / Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `normal` / `stable` | `#ECFDF5` | `#065F46` | `#A7F3D0` | `#10B981` | Within normal reference limits; stable status |
| `info` | `#EFF6FF` | `#1E40AF` | `#BFDBFE` | `#3B82F6` | Routine diagnostic notes, informational advisories |
| `attention` | `#FEF08A` | `#854D0E` | `#FDE047` | `#EAB308` | Requires clinical review; borderline metrics |
| `warning` | `#FFEDD5` | `#9A3412` | `#FED7AA` | `#F97316` | Drug-drug interaction risk; safety guard alert |
| `critical` / `danger`| `#FEF2F2` | `#991B1B` | `#FECACA` | `#EF4444` | Anaphylaxis risk, critical lab value escalation |
| `ai` | `#FCE7F3` | `#9D174D` | `#FBCFE8` | `#EC4899` | Machine-generated draft, synthesis in progress |
| `physician` | `#F3E8FF` | `#6B21A8` | `#E9D5FF` | `#A855F7` | Clinician-attested entry, cryptographic sign-off |

### 2.3 Clinical Governance & Lifecycle Tokens

| Lifecycle State | Visual Treatment | Meaning & Invariant |
| :--- | :--- | :--- |
| **DRAFT** | Neutral `#F4F2EC` background, `#575D65` text, dashed border | Incomplete or working consultation notes; strictly excluded from external EHR exports. |
| **AI_GENERATED** | Blush `#FCE7F3` background, `#9D174D` text, dashed border | Machine-drafted clinical assessment. Strictly advisory; requires human sign-off before persistence. |
| **PHYSICIAN_REVIEW_REQUIRED** | Canary `#FEF08A` background, `#854D0E` text, padlock icon | Critical safety gate. Highlights clinical drafts awaiting physician attestation. |
| **PHYSICIAN_APPROVED** | Emerald `#ECFDF5` background, `#065F46` text, solid border, shield icon | Authenticated physician approval with SHA-256 tamper digest binding. FHIR committed. |
| **AMENDED** | Blue `#EFF6FF` background, `#1E40AF` text, edit audit icon | Post-approval modification by physician with immutable audit history trace. |
| **VOIDED** | Slate `#F3F4F6` background, `#6B7280` text, strike-through icon | Nullified record retained solely for legal and tamper-evident audit inspection. |

---

## 3. Typography Scale & Hierarchy

- **Primary Font Family:** `"Source Sans 3 Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Display & Wordmark:** `"Plus Jakarta Sans", "Source Sans 3 Variable", sans-serif`
- **Clinical Numerics & Tabular:** `"JetBrains Mono", "SF Mono", ui-monospace, monospace` with `font-variant-numeric: tabular-nums`

```
Display:         2.00rem (32px) / 2.50rem Line Height / ExtraBold 800
Page Heading:    1.50rem (24px) / 2.00rem Line Height / Bold 700
Section Heading: 1.125rem (18px)/ 1.50rem Line Height / Bold 700
Card Heading:    0.875rem (14px)/ 1.25rem Line Height / Bold 700
Body:            0.875rem (14px)/ 1.25rem Line Height / Regular 400
Body Small:      0.750rem (12px)/ 1.00rem Line Height / Regular 400
Caption:         0.6875rem (11px)/ 0.875rem Line Height / Medium 500
Metadata / Tag:  0.625rem (10px)/ 0.750rem Line Height / SemiBold 600
Clinical Label:  0.625rem (10px)/ 0.750rem Line Height / Bold 700 Uppercase
```

---

## 4. Spacing, Radii, Elevation & Motion

### 4.1 Spacing Scale (4px Baseline)
`space-1 (4px)`, `space-2 (8px)`, `space-3 (12px)`, `space-4 (16px)`, `space-5 (20px)`, `space-6 (24px)`, `space-8 (32px)`, `space-10 (40px)`, `space-12 (48px)`, `space-16 (64px)`.

### 4.2 Radii Hierarchy
- **Micro-controls / Code tags (`sm`):** `6px` (`rounded-md`)
- **Inputs / Sub-controls (`md`):** `8px` (`rounded-lg`)
- **Buttons / Small cards (`lg`):** `12px` (`rounded-xl`)
- **Drawers / Dialog surfaces (`xl`):** `16px` (`rounded-2xl`)
- **Master workspace cards & panels (`2xl`):** `24px` (`rounded-3xl`)
- **Badges / Search pills / Actions (`pill`):** `9999px` (`rounded-full`)

### 4.3 Elevation & Shadows
- **Flat:** `none`
- **Subtle:** `0 1px 2px 0 rgba(0, 0, 0, 0.03)`
- **Card:** `0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)`
- **Elevated:** `0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)`
- **Modal / Floating:** `0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)`

### 4.4 Motion & Accessibility
- **Micro Interactions:** `120ms cubic-bezier(0.16, 1, 0.3, 1)`
- **Workspace Transitions:** `200ms cubic-bezier(0.16, 1, 0.3, 1)`
- **Reduced Motion:** When `prefers-reduced-motion: reduce` is detected, animations immediately fall back to `0ms linear`.

---

## 5. Master Component System Architecture

All components are located under [`apps/web/src/design-system/`](file:///Users/abhidinkale/Downloads/proton/apps/web/src/design-system/) and re-exported via [`apps/web/src/design-system/index.ts`](file:///Users/abhidinkale/Downloads/proton/apps/web/src/design-system/index.ts):

```
apps/web/src/design-system/
├── core/
│   ├── Button.tsx
│   ├── IconButton.tsx
│   ├── Input.tsx
│   ├── Textarea.tsx
│   ├── Select.tsx
│   ├── Checkbox.tsx
│   ├── Radio.tsx
│   ├── Toggle.tsx
│   ├── Badge.tsx
│   ├── Avatar.tsx
│   ├── Tooltip.tsx
│   ├── Dropdown.tsx
│   ├── Tabs.tsx
│   ├── Breadcrumb.tsx
│   └── Pagination.tsx
├── layout/
│   ├── AppShell.tsx
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   ├── PageHeader.tsx
│   ├── Section.tsx
│   ├── Panel.tsx
│   ├── Card.tsx
│   ├── SplitPane.tsx
│   ├── Drawer.tsx
│   └── Modal.tsx
├── clinical/
│   ├── PatientIdentity.tsx
│   ├── PatientStatus.tsx
│   ├── ClinicalBadge.tsx
│   ├── VitalCard.tsx
│   ├── LabValue.tsx
│   ├── MedicationItem.tsx
│   ├── AllergyItem.tsx
│   ├── ClinicalTimeline.tsx
│   ├── EncounterCard.tsx
│   ├── DiagnosisItem.tsx
│   ├── DocumentCard.tsx
│   └── PhysicianApprovalIndicator.tsx
├── ai/
│   ├── AIStatus.tsx
│   ├── AIGeneratedContent.tsx
│   ├── AIConfidenceIndicator.tsx
│   ├── AIWarning.tsx
│   ├── AIRecommendation.tsx
│   ├── AIAction.tsx
│   ├── AIProcessingState.tsx
│   └── AIReviewRequired.tsx
└── index.ts
```

---

## 6. Representative Canonical Screen: Dashboard

The primary canonical screen [`apps/web/src/pages/Dashboard.tsx`](file:///Users/abhidinkale/Downloads/proton/apps/web/src/pages/Dashboard.tsx) was refactored to directly use the Proton Design System:
- **Header:** Structured `PageHeader` with title, greeting subtitle, `AIStatus` badge (`Proton Jev 2.0 Active`), and action buttons (`Patients Directory`, `Resume Active Encounter`).
- **Clinical Priority Hero:** `Card` (variant `white`) displaying the next queued patient with room assignment, complaint, critical allergy indicator (`Badge`), tabular vitals, and `Button` action.
- **Attention Queue Panel:** `Card` (variant `subtle`) detailing prioritized escalations (lab alerts, safety intercept locks, unsigned notes).
- **Metric Cards:** 4 pastel cards (`canary`, `rose`, `olive`, `periwinkle`) rendering patient census, visit duration curve, cohort stability, and session metrics.
- **Queue Navigation:** `Tabs` primitive cleanly switching patient cohorts (`Waiting`, `In Room`, `Review`, `Done`) with live appointment counts.
- **Action Buttons:** Standardized `Button` and `IconButton` across calendar, timeline, and consultation actions.

---

## 7. Compliance Checklist

- [x] Centralized design tokens defined in `domain/theme/tokens.ts`
- [x] Tailwind CSS v4 `@theme` variables synchronized in `index.css`
- [x] Standardized AppShell, Sidebar, TopBar, and PageHeader
- [x] Core primitives implemented (Button, IconButton, Input, Textarea, Select, Checkbox, Radio, Toggle, Badge, Avatar, Tooltip, Dropdown, Tabs, Breadcrumb, Pagination)
- [x] Clinical primitives implemented (PatientIdentity, PatientStatus, ClinicalBadge, VitalCard, LabValue, MedicationItem, AllergyItem, ClinicalTimeline, EncounterCard, DiagnosisItem, DocumentCard, PhysicianApprovalIndicator)
- [x] AI intelligence & safety primitives implemented (AIStatus, AIGeneratedContent, AIConfidenceIndicator, AIWarning, AIRecommendation, AIAction, AIProcessingState, AIReviewRequired)
- [x] AI provenance explicit and visually distinct from approved clinical truth
- [x] Representative Dashboard screen migrated and fully functional
- [x] Zero regressions across Milestones 1–6 (130/130 passing)
- [x] Web build (`tsc -b && vite build`) and lint (`oxlint`) pass with 0 errors
- [x] Android tests (`./gradlew test`) pass with 0 errors
