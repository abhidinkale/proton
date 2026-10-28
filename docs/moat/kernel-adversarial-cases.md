# Kernel adversarial cases — from four bypasses to a gated suite

**Status:** the four bypasses are fixed in `kernel_v2`; the cases are now a
gated regression suite.
**Probe:** [`apps/api/scripts/probe-kernel-gaps.js`](../../apps/api/scripts/probe-kernel-gaps.js)
**Gated suite:** [`apps/api/tests/kernel_safety_v2_validation.cjs`](../../apps/api/tests/kernel_safety_v2_validation.cjs) — 14 checks
**Implementation:** [`apps/api/services/safety/safetyService.js`](../../apps/api/services/safety/safetyService.js), [`safetyGate.js`](../../apps/api/services/safety/safetyGate.js)

Run the diagnostic probe:

```bash
cd apps/api && node scripts/probe-kernel-gaps.js
```

Current summary: `designedToPassAndDid: 0`, `controlsHeld: 2`,
`controlsFailed: 0`.

Run the gate:

```bash
cd apps/api && node tests/kernel_safety_v2_validation.cjs
```

---

## 1. Why this list exists

"Zero unsafe passes on N adversarial cases" is only meaningful if the cases were
constructed adversarially. The construction rule is:

> For every kernel rule, write a case that is **designed to pass** and should
> not, plus a control that must block for the same rule.

A suite of random prescriptions measures the pass rate. A suite of crafted
near-misses measures the rule. Publish the case list, not just the number.

The construction discipline found four bypasses in `kernel_v1`. They are listed
below with the status after the fix. The controls stay in the suite so it cannot
pass by blocking everything.

---

## 2. Results, before and after

| Case | `kernel_v1` | `kernel_v2` | Rule |
|---|---|---|---|
| `acetaminophen_q4h` — 1000 mg q4h = 6000 mg/day | `VERIFIED` | `CONTRAINDICATION_HARD_STOP` | `RULE_MAX_DOSE_EXCEEDED` |
| `acetaminophen_two_tablets_qid` — 2 × 500 mg qid = 4000 mg/day | `VERIFIED` | `REVIEW_REQUIRED` | `RULE_DOSE_ABOVE_USUAL_MAX` |
| `duplicate_amoxicillin` — same ingredient twice | `VERIFIED` | `CONTRAINDICATION_HARD_STOP` | `RULE_DUPLICATE_INGREDIENT` |
| `metformin_egfr_12` — eGFR 12 | `VERIFIED` | `CONTRAINDICATION_HARD_STOP` | `RULE_METFORMIN_EGFR_LT30` |
| `control_penicillin_allergy` | `block` | `block` | `RULE_ALLERGY_PEN_AMOX` |
| `control_warfarin_nsaid` — HIGH DDI | `VERIFIED` (finding recorded, then cleared) | `REVIEW_REQUIRED` | `DDI_WARFARIN_NSAID` |

The two controls matter: without them, the suite would be a list of failures
with no evidence that the kernel works at all.

The `q4h` case was the sharpest because the input is ordinary clinical
shorthand, not a malformed order. A doctor writing `q4h` is not attacking the
system.

---

## 3. What was wrong in `kernel_v1`

### 3.1 Frequency parsing was a whitelist

`services/safety/safetyService.js` computed:

```js
let dailyFrequencyMultiplier = 1;
if (freq.includes('four') || freq.includes('qid') || freq.includes('every 6 hours')) multiplier = 4;
else if (freq.includes('three') || freq.includes('tid') || freq.includes('every 8 hours')) multiplier = 3;
else if (freq.includes('twice') || freq.includes('bid') || freq.includes('every 12 hours')) multiplier = 2;
```

Anything not on that list became `1`. `q4h`, `q6h`, `Q6H`, `every 4 hours`,
`4 times daily`, and `2 tablets` were all silently counted as one dose per day.
For a dose-ceiling rule, the default must be **refuse**, not `1`.

### 3.2 Tablet count was ignored

`dose: "500 mg"` plus `frequency: "2 tablets four times daily"` was parsed as
500 mg × 4 = 2000 mg/day. The actual exposure was 4000 mg/day.

### 3.3 There was no duplicate-order rule

`evaluatePrescriptionSafety` iterated prescriptions independently. Two identical
amoxicillin orders produced two clean evaluations and `passed: true`.

### 3.4 Renal function never reached the kernel

`SafetyGate.verifyMedicationGate` called:

```js
this.safetyService.evaluatePrescriptionSafety({ prescriptions, allergies, activeMedications })
```

`eGFR`, weight, and age were not parameters. A patient with eGFR 12 on metformin
was `VERIFIED`.

### 3.5 `HIGH` was not `cleared`

`SafetyGate` computed `hasCriticalHardStop` from `severity === 'CRITICAL'` only.
A `HIGH` DDI was in `violations`, but `status` stayed `VERIFIED` and `cleared`
was true. The same code ignored `safetyService.passed`, which was false whenever
any contraindication existed. Two verdict fields disagreed.

---

## 4. What changed in `kernel_v2`

1. **Frequency parser with a refusal path.**
   - Explicit daily counts first (`qid`/`tid`/`bid`, `four times daily`, `2x/day`),
     then intervals (`q4h`, `every 4 hours`, `every 4-6 hours` uses the shorter
     interval), then `PRN`.
   - `Every 4 hours (four times daily)` reads as four doses, not six; `q4h`
     alone reads as six. The explicit count is the prescribed daily frequency.
   - An unparseable frequency on a ceiling drug is `DOSE_CEILING_UNVERIFIABLE`
     (HIGH, review required), not a default of 1.
   - `PRN` uses one dose for the ceiling and emits an explicit
     `PRN_DOSE_UNBOUNDED` warning.
2. **Units per dose.** `2 tablets`, `1-2 capsules`, and `5 mL` are parsed; the
   maximum of a range is used because the ceiling is a safety max. Liquid
   concentrations (`500 mg/5 mL`) are handled when the administered volume is
   present.
3. **Duplicate ingredient rule.** Brand/generic/combination names resolve through
   the pharmacology graph; the same active ingredient twice in one proposal is
   `RULE_DUPLICATE_INGREDIENT` (CRITICAL).
4. **Renal context is passed.** `SafetyGate` forwards `eGFR`, `weightKg`, and
   `age`. Metformin at eGFR < 30 is CRITICAL; 30–44 is HIGH/review; missing eGFR
   is a warning, because a refill may carry a lab elsewhere. NSAIDs at eGFR < 30
   are HIGH/review; 30–59 is a warning.
5. **HIGH is review-required, not cleared.** `status: 'REVIEW_REQUIRED'`,
   `cleared: false`, `requiresReview: true`. A physician can clear it only with
   a documented rationale of at least 10 characters (`DIRECTIVE_OVERRIDE`). The
   response now carries `kernelVersion: 'kernel_v2'`.
6. **One verdict.** `cleared` is the only field a caller should use to proceed;
   it is false for any CRITICAL or HIGH finding. `blocked` remains the
   CRITICAL-only hard stop.
7. **Gated tests.** The 14-check suite asserts each case and both controls; it
   runs in the deterministic suite, so a regression fails CI.
8. **The verdict is binding at the write.** `clinicalPipeline` refuses to build
   a signable output when `cleared` is false. The clinic `signNote` re-runs the
   gate over the prescriptions being signed, refuses a HIGH or CRITICAL finding
   without a physician directive, and stores the verdict in the signature. The
   workflow `sign` route is the remaining boundary; it is P0.2's target.
   Covered by [`sign_safety_boundary_validation.cjs`](../../apps/api/tests/sign_safety_boundary_validation.cjs) (8 checks).

---

## 5. What is still not covered

The fix is a rule engine, not a clinical pharmacology database. Known limits:

- **Adult dose in a child without `mg/kg`.** A 12 kg child ordered 500 mg
  amoxicillin is not flagged; the kernel has no weight-based paediatric range
  table. It does flag a `mg/kg` order when the weight is missing.
- **Duplicate against active medications is not time-aware.** The rule catches
  duplicates within one proposal; it does not know whether a home prescription
  was stopped.
- **PRN maximum doses are unknown.** The ceiling assumes one dose and warns.
- **Renal thresholds are first rules.** Metformin and NSAIDs only; no full
  KDIGO dosing table, no hepatic or pregnancy adjustment.
- **The parser covers common forms, not all.** `one and a half tablets`,
  `2 puffs` on a mg-ceiling drug, and unusual tapering schedules need cases
  before they can be trusted.
- **`DOSE_LIMIT_WARNING` is now HIGH** when the daily total is above the usual
  maximum but below the absolute ceiling. That is a deliberate behavior change;
  it is review-required, not a hard stop.

These are P1.4 coverage work, not P0.7 regressions. The P0.7 acceptance is that
the published cases block and the controls hold, not that the kernel is complete.

---

## 6. The adversarial suite, not the pass rate

The suite is organized by rule, not by drug:

| Rule | Designed-to-pass case | Control |
|---|---|---|
| daily ceiling | 1000 mg q4h; 2 × 500 mg qid; `Q6H`; `every 4 hours` | 2000 mg q4h (8000 mg/day) |
| duplicate | same ingredient twice in one proposal; brand + generic | two different antibiotics |
| allergy | brand alias (`Amoxil` + penicillin); class cross-reactivity | no allergy |
| renal | metformin eGFR 12; NSAID eGFR 20 | eGFR 90 |
| paediatric | `mg/kg` order with no weight | weight-appropriate adult order |
| missing context | no allergies documented; no eGFR for metformin | complete context |
| severity | HIGH DDI must not clear | no interaction |

Publish the list with the result. A reader can then see whether the suite is
testing the rule or testing the demo.

---

## 7. Acceptance

Met:

- the four `designedTo: pass` cases block or require review;
- both controls hold;
- the fix is a parser/rule, not a whitelisted `q4h` string (`q3h` is blocked by
  the same rule);
- the suite is in CI;
- `kernel_v2` is recorded on every gate result.

Not yet met:

- every drug with a ceiling has a parser test;
- the gaps in §5 have cases;
- the kernel verdict is stored on every proposal (P0.2/P1.4 wiring).
