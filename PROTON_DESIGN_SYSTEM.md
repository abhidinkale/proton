# PROTON DESIGN SYSTEM SPECIFICATION (PDS-1)
**High-Performance Reference-Driven Clinical Workspace**
*Version: 1.0.0 | Date: 2026-10-18 | Target: Web & Desktop OS*

---

## 1. Design Principles

1. **Clarity Over Clutter ("5-Second Comprehension"):**
   * A clinician must grasp a patient's trajectory, acuity, and pending tasks in 5 to 10 seconds.
   * Information is layered with progressive disclosure, generous card padding (`20px-24px`), and distinct visual grouping.

2. **Calm, Human Clinical Atmosphere:**
   * Replaces cold hospital blue/gray with a warm off-white canvas (`#F9F8F5`), grounded by a high-contrast charcoal navigation rail (`#151619`) and soft pastel semantic cards.

3. **Multimodal Clinical Status (Safety Invariant):**
   * **Color is NEVER the sole indicator of clinical state.**
   * Every status token is accompanied by a standard medical icon, explicit textual label, and optional severity rating to guarantee full accessibility (WCAG AA) and eliminate ambiguity.

4. **Rigorous AI Demarcation:**
   * AI-generated content (notes, summaries, coding recommendations) is styled with distinct dark or violet containers with mandatory `AI DRAFT` or `AI COPILOT SUGGESTION` badges and explicit clinician approval gates before committing to FHIR.

---

## 2. Token Architecture

### 2.1 Color Tokens
```css
:root {
  /* Canvas & Foundations */
  --p-canvas: #F9F8F5;
  --p-rail: #151619;
  --p-rail-border: #23252B;
  --p-surface: #FFFFFF;
  --p-surface-subtle: #F4F2EC;
  --p-border: #E8E5DC;
  --p-border-strong: #D6D2C4;

  /* Typography Colors */
  --p-text-primary: #151719;
  --p-text-secondary: #575D65;
  --p-text-muted: #88909A;
  --p-text-inverse: #FFFFFF;

  /* Pastel Semantic Grouping (Reference-Aligned) */
  --p-canary-bg: #FEF08A;
  --p-canary-text: #854D0E;
  --p-canary-border: #FDE047;

  --p-rose-bg: #FCE7F3;
  --p-rose-text: #9D174D;
  --p-rose-border: #FBCFE8;

  --p-olive-bg: #DCFCE7;
  --p-olive-text: #166534;
  --p-olive-border: #BBF7D0;

  --p-periwinkle-bg: #E0E7FF;
  --p-periwinkle-text: #1E40AF;
  --p-periwinkle-border: #C7D2FE;

  /* AI Copilot Surfaces */
  --p-ai-surface: #18191D;
  --p-ai-text: #F3F4F6;
  --p-ai-accent: #F472B6;
  --p-ai-glow: rgba(244, 114, 182, 0.15);
}
```

### 2.2 Geometry & Radius
* **Master Card:** `rounded-3xl` (`24px` / `1.5rem`)
* **Sub-Card / Metric:** `rounded-2xl` (`16px` / `1rem`)
* **Interactive Pills & Search:** `rounded-full` (`9999px`)
* **Controls & Inputs:** `rounded-xl` (`12px` / `0.75rem`)

### 2.3 Typography Scale
* **Display / Greetings:** `text-2xl` to `text-3xl` (`24px-30px`), Font-weight: `700` (`font-bold`), Tracking: `-0.02em`
* **Card Headings (H2/H3):** `text-base` to `text-lg` (`16px-18px`), Font-weight: `600` (`font-semibold`)
* **Body Text:** `text-sm` (`14px`), Line-height: `1.5`, Font-weight: `400` / `500`
* **Clinical Labels & Units:** `text-xs` (`11px-12px`), Font-weight: `600`, Uppercase tracking: `0.05em`
* **Tabular Numbers:** Tabular figures font feature (`tabular-nums`) for lab values, vitals, time rails, and billing amounts.

---

## 3. Core Component Library

1. **`ProtonCard`**: Rounded-3xl container with border and background variants (`white`, `canary`, `rose`, `olive`, `periwinkle`, `ai-dark`).
2. **`ProtonBadge`**: Clinical status chip with icon + text + severity.
3. **`ProtonButton`**: Pill-shaped action buttons (`primary-dark`, `secondary-outline`, `accent-rose`, `ghost`).
4. **`ProtonSearchPill`**: Unified search bar with embedded scope pills (`In: Patients | Prescriptions | Test results | Education`).
5. **`ProtonTimeRail`**: Vertical schedule marker with live time indicator line (`07:21`).
6. **`ProtonStatusChip`**: Connectivity and offline status indicator with live sync badge.
