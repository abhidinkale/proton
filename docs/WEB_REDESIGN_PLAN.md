# Web Redesign — the plan

**Status:** Pass 0–2 shipped 2026-10-28 (tokens, six palettes, picker, new shell chrome,
new dashboard). Passes 3–5 (one encounter UI, lists, accessibility pass) still open.

### Shipped in this pass

| Change | Where |
| --- | --- |
| Six palettes (Dawn, Clinic, Daylight, Sage, Midnight, Ink) as one token contract | `apps/web/src/styles/palettes.css` |
| Palette state, persistence, boot-without-flash, light⇄dark shortcut | `apps/web/src/design-system/theme/palettes.ts` |
| Switcher in the top bar — six options, swatches, saved per device | `apps/web/src/design-system/theme/PaletteSwitcher.tsx` |
| 2,909 hardcoded colour classes across 104 files → semantic tokens; `bg-white` ×515 → `bg-paper` | repo-wide codemod |
| CI guard that fails on any new hex colour class | `apps/web/scripts/check-design-tokens.mjs` |
| Dashboard rebuilt as the day sheet (1,211 → ~420 lines) | `apps/web/src/pages/Dashboard.tsx` |

Measured before → after: arbitrary hex classes in `.tsx` **1,653 → 0**; palette-aware
surfaces **0 → 100%** of the app's colour classes.
**Scope:** the clinician web app (`apps/web`). No API changes, no new clinical capability.
**Goal:** a doctor can use it for an hour without wondering which product they are in, and can tell at a
glance what needs them next.

---

## 1. What is actually wrong (measured, not felt)

### 1.1 There are three products in one app

| Surface | Language | Evidence |
| --- | --- | --- |
| **Care Loop**, **Patients**, **Schedule**, **Clinic desk**, **Settings** | Warm paper, Fraunces, hairline rules, black pills | `#F9F8F5` canvas, `#A63A4E` / `#B07A2A` / `#4C7A45` signal colours |
| **Dashboard** | Cool white, blue, gradient wash, KPI cards | `#2563eb`-family accents, mint→white page gradient, indigo "Open notes →" pill |
| **Consultation** | Dark cockpit, mint/emerald chips, blue links, 3 columns | dark `#0B0F14`-ish pills, emerald recommendation chips, `text-blue` links |

A clinician moves Dashboard → Care Loop → Consultation and the product changes identity twice. That,
more than any single ugly screen, is why it reads as untrustworthy. A clinical tool that looks
unfinished is a clinical tool a doctor will not put a signature on.

### 1.2 The design system exists on paper and not in the code

```
distinct hardcoded hex values in src/     385
total hardcoded hex occurrences          4,251
palettes declared in index.css @theme      3   (brand-*, clinical-*, proton-*)
```

Four off-whites doing the same job — `#F9F8F5`, `#FAF9F6`, `#FAFAF9`, `#F4F4F5` — and three near-blacks
`#111315`, `#151619`, `#151719`, within 3 RGB points of each other. Nobody chose those; they accumulated.
Ten border radii, including one-off `[6px]`, `[22px]`, `[28px]`.

### 1.3 Two weights of the same job

```
tsx files                     138
tsx lines                  42,134
three encounter UIs  6,711 lines  (2,576 + 2,177 + 1,958)
```

Three components render a consultation. `pages/Consultation.tsx` still routes to the legacy one. This
is the single largest source of visual drift, because each was designed by a different person with a
different idea of the product.

### 1.4 The voice is a guest in its own product

```
font-mono occurrences     472
font-editorial             16
```

Fraunces appears sixteen times. Monospace appears four hundred and seventy-two. The typographic idea that
makes this product distinctive — a clinical document, set like a document — was implemented once, in the
Care Loop, and then not used anywhere else. Everything else defaults to small tracked mono labels, which
is the most generic move available.

### 1.5 It doesn't look useful because the front door is the least useful screen

The Dashboard is 1,211 lines and opens with a greeting and four KPI cards: *On the books 11 · Waiting 8 ·
To review 2 · Signature rate 9%*. A clinician at 8am does not need "9% signature rate". They need the next
patient, and the note that is blocking their signature.

Meanwhile the most useful screen in the product — **Schedule**, a real day spine with per-row actions and
semantic colour — is buried behind one nav click.

This is the part of your complaint that is not cosmetic. The information architecture is inverted.

---

## 2. Screen-by-screen verdict

| Screen | Verdict | Main problems |
| --- | --- | --- |
| Dashboard | **Rebuild** | Wrong language; KPI card kit; vanity metric; duplicated queue; never says "do this next" |
| Care Loop | **Keep the language, tighten** | Best screen. Too much mono; `LIVE / CARE LOOP / POSTGRES` meta-string; the "day" strip is empty and decorative |
| Schedule | **Keep, simplify** | Three chips per row (FOLLOW-UP + URGENT + status); six pastel row tints; "Day checklist" card is filler |
| Patients | **Change the form** | 11 identical cards = the SaaS-card kit. A patient list is a *list*; card grids don't sort, scan or compare |
| Consultation | **Rebuild onto one UI** | Third language; 3 columns of 12 type treatments; impressive in a demo, exhausting in hour three |
| Settings / Education / Billing | **Defer** | Not on the pilot path; give them the tokens, touch nothing else |
| Clinic desk (new) | **Keep** | Written in the warm language already; only needs the token pass |

---

## 3. The direction: clinical paper

One metaphor, borrowed from the thing already on the doctor's desk: **a well-set day sheet.**

Not a dashboard of widgets. Not a cockpit of instruments. A page you can read top-to-bottom, where
structure comes from typographic hierarchy and rules, and where colour means something clinical or is
absent.

**Why this direction and not another:**
- It is already the strongest thing in the product (Care Loop, Schedule) — we are finishing an idea, not
  importing one.
- It is genuinely different from every hospital dashboard, which is a wall of chrome and pastel cards.
  Differentiation for a design-partner pitch is the point.
- It scales to dense clinical content, which cards do not.

**The one memorable element:** the signature gate is the only black object on any page. Everything else is
paper and ink. One black element per screen, used for the one act that cannot be undone.

**What we remove, deliberately:**
- gradient page washes and gradient text
- the four-up KPI card kit
- pastel row tints (more than one tint per screen is noise)
- chip piles — one status per row, not three
- `→` appended to every button and `↗` on every link
- tracked ALL-CAPS eyebrow labels above sections (the meta-string `A / B / C` tell)
- emoji-scale icons standing in for structure

---

## 4. Tokens (this is the actual code)

```css
@theme {
  /* Surface — four, no more. */
  --color-canvas:      #F9F8F5;
  --color-paper:       #FFFFFF;
  --color-rule:        #E4E0D4;
  --color-rule-strong: #CFC9B8;

  /* Ink — three. */
  --color-ink:   #14161A;
  --color-ink-2: #5C6167;
  --color-ink-3: #8A8578;

  /* Signal — only these, only when it means something. */
  --color-critical:  #A63A4E;  --color-critical-wash: #FAF1F2;
  --color-caution:   #B07A2A;  --color-caution-wash:  #FBF5E9;
  --color-settled:   #4C7A45;  --color-settled-wash:  #F2F7F0;

  --font-display: 'Fraunces', Georgia, serif;
  --font-sans:    'Instrument Sans', system-ui, sans-serif;
  --font-mono:    'IBM Plex Mono', ui-monospace, monospace;

  --radius-control: 9px;
  --radius-card:    12px;
}
```

| Token | Use it for | Never use it for |
| --- | --- | --- |
| `font-display` | page titles, patient names in a list, the one number that matters | body copy, labels, buttons |
| `font-sans` | everything you read | — |
| `font-mono` | times, IDs (MRN/LOINC/RxNorm/NPI), codes, counts in a column | prose, section labels, buttons |
| `critical` / `caution` / `settled` | clinical state, and only that | decoration, charts, "info" |
| `radius-card` | containers that hold a *thing* | rows in a list, page sections |
| no shadow | — | cards, dropdowns, modals (use rule + paper) |

**The rule that keeps it true:** no hex literal in `src/**/*.tsx`. Enforced by a build check, exactly like
`check:api-client` — which already proved this team will keep that kind of gate green.

---

## 5. Wireframes

### Dashboard — "the day sheet"

```
┌────────────┬──────────────────────────────────────────────────────────────┐
│ proton     │  Wednesday, 28 October            ● Live   ⌘K    [ Dr. Lin ] │
│            ├──────────────────────────────────────────────────────────────┤
│ Clinical   │  Three things need you before 11:00.                         │
│  Day    ◀  │  ──────────────────────────────────────────────────────────  │
│  Care Loop │  09:30  Arthur Pendelton   ready for review          Open    │
│  Patients  │         chest tightness · 12 min · 3 abnormal labs           │
│  Schedule  │  10:00  Priya Patel        waiting                   Start   │
│            │  10:30  Harold Bailey      waiting                   Start   │
│ Tools      │                                                              │
│  Clinic    │  ██ 1 note awaiting your signature ................. Sign ██ │
│  Settings  │  ── The rest of the day ───────────────────────────────────  │
│            │  11:00  Robert Hayes       waiting                   Start   │
│            │  11:30  Marcus Chen        waiting                   Start   │
└────────────┴──────────────────────────────────────────────────────────────┘
```

No KPI cards. No calendar takeover. One queue, the same component Care Loop and Schedule use. The single
black object is the signature bar.

### Patients — a list, not a grid

```
Patient            Age  Problem                        Last      Flags      Next
Arthur Pendelton    58  Essential hypertension         09:30     3 labs     Review
Beatrice Gomez      71  Heart failure (I50.9)          12:00     —          Waiting
Clara Hughes        34  Mild intermittent asthma      09:00     —          Waiting
```

Sortable columns, one line per patient, flags as text not chips. Scan 40 patients without scrolling a
screen and a half.

### Consultation — a document with a margin

```
┌──────────────────────────────────────────────────────────────┬─────────────┐
│ Arthur Pendelton · 58 · M · AP-5510                  LIVE     │ ORDERS      │
│ ⚠ Sulfa drugs                                                   │  HbA1c      │
│ ────────────────────────────────────────────────────────────  │  BMP        │
│ 09:12  Dr. Lin      How has your breathing been…              │  ECG  STAT  │
│ 09:12  Patient      For two weeks, worse on stairs…           │             │
│ 09:13  Dr. Lin      Any chest pain?                           │  Metformin   │
│                                                               │  Empa        │
│ ── Assessment, drafted ──────────────────────────────────────  │             │
│ Type 2 diabetes, suboptimal control            HIGH 84%       │             │
│  · home glucose 185–210 mg/dL        ADA 2026 (PMID 38118032) │             │
│                                                               │             │
│ ┌──────────────────────────────────────────────────────────┐  │             │
│ │ ██ Sign and commit — nothing is released until signed ██ │  │             │
│ └──────────────────────────────────────────────────────────┘  │             │
└──────────────────────────────────────────────────────────────┴─────────────┘
```

Transcript is the page; orders live in the margin; the signature is the only black bar.

---

## 6. The passes

Each pass ships on its own. Nothing is a rewrite of the backend.

### Pass 1 — Guardrails and the shell · 1.5 d
- Replace the three `@theme` palettes with the token block in §4. Delete `brand-*`, keep `proton-*` only as
  an alias if something would break.
- `scripts/check-design-tokens.mjs`: fails on a raw hex in `src/**/*.tsx`, with a shrinking allowlist.
  Wire into CI next to `check:api-client`.
- AppShell: remove the page gradient, unify the top bar (search · live status · actions), reduce nav
  chrome, replace the mono ALL-CAPS section labels with sentence-case.
- **Exit:** `npm run check:design-tokens` green; app compiles; no visual change beyond the shell.

### Pass 2 — The dashboard becomes the day sheet · 2 d
- Rebuild `pages/Dashboard.tsx` (1,211 lines) into: *Now* (next 3) → *Signature gate* → *Rest of the day*.
- Delete the KPI card kit, the calendar takeover, the "patient flow" bar chart and the signature-rate metric.
- Reuse the Care Loop queue row and the Schedule status tokens. One component, three callers.
- **Exit:** dashboard and Care Loop read as one product in a side-by-side screenshot.

### Pass 3 — One encounter UI · 3 d
- Delete `LegacyEncounterWorkspace.tsx` (2,177) and `DoctorGuidedEncounter.tsx` (2,576); `Consultation.tsx`
  routes to `DoctorDeskEncounter`.
- Split the survivor (1,958) into `transcript/`, `note/`, `orders/`, `safety/`, `signoff/` — each under 400
  lines.
- Replace gradient chips and dark pills with paper, rules and the three signal colours.
- **Exit:** one route, one component tree, no file over 500 lines in `features/encounter`.

### Pass 4 — Lists that scale · 2 d
- Patients: card grid → sortable list (name, age, problem, flags, next).
- Schedule: one status per row; drop the "Day checklist" filler; keep the day spine.
- One empty state per list, in the product's voice.
- **Exit:** 40 patients scannable without horizontal scroll; every row has exactly one action.

### Pass 5 — Polish and accessibility · 1.5 d
- Focus rings on every interactive element; 200% font scale; reduced-motion respected.
- Loading and error states that say what happened and what to do.
- Screenshot diff at 1280 / 1024 / 390 px, before/after committed to `docs/`.
- **Exit:** keyboard-only walk of Dashboard → Schedule → Encounter → Sign.

**Total: ~10 focused days.** The visible transformation lands at the end of Pass 2 (3.5 days).

---

## 7. What gets deleted

| Delete | Lines | Replaced by |
| --- | --- | --- |
| `components/LegacyEncounterWorkspace.tsx` | 2,177 | `DoctorDeskEncounter` |
| `components/DoctorGuidedEncounter.tsx` | 2,576 | folded into `DoctorDeskEncounter` |
| Dashboard KPI cards + calendar + flow chart | ~400 | the day sheet |
| `brand-*` and `clinical-*` palettes | ~40 | one token block |
| Patient card grid | ~300 | one sortable list |

Net: roughly 6,700 lines removed, ~1,200 added.

---

## 8. How it stops drifting again

1. **`check:design-tokens`** — a raw hex fails CI. Same enforcement style the repo already trusts.
2. **One `PageHeader`** — every route uses it; no page hand-rolls a masthead.
3. **One status vocabulary** — `critical | caution | settled | neutral`, no local synonyms.
4. **Screenshot diff per PR** for the four pilot routes, three widths.
5. **Rule of one black element per screen.** If a page has two, one is wrong.

---

## 9. Decisions I need from you

1. **Direction:** commit to *clinical paper*, and retire the blue/indigo dashboard and the cockpit
   consultation? (Recommended: yes. It is the only one of the three that is already good and that a
   hospital has not seen a hundred times.)
2. **Order:** the full ten days, or Pass 1–2 first so the front door looks right before the encounter
   rebuild?
3. **Fraunces:** keep. It is the one thing making this product look like itself. I would not swap it.
4. **Tablet:** is a clinic terminal a 1024-wide touchscreen? That changes Pass 1's shell work from
   "nice to have" to "must".
