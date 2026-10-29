# Outcome labeler — `label_v1`

**Status:** implemented. `label_v1` is a pure function in
[`apps/api/services/clinical/outcomeLabeler.js`](../../apps/api/services/clinical/outcomeLabeler.js);
the write path is [`apps/api/services/clinical/outcomeWriter.js`](../../apps/api/services/clinical/outcomeWriter.js),
called inside the follow-up transaction. The precedence table is tested by
`apps/api/tests/outcome_labeler_validation.cjs` (9 cases). The 30-day final job
in §7 is **not** implemented — a 48-hour answer writes `improved`/`worsened`,
never `resolved`; `resolved` can only come from a completed-window row, which
currently must be written by an explicit job or an import.
**Scope:** one condition cohort at a time. The first cohort should be a
condition with a short, standardized natural history (pharyngitis, UTI, or low
back pain), not "all encounters."

The outcome label is the asset the rest of the plan exists to produce. It is
also the easiest thing to inflate. This document pins the rules so the number
means something.

---

## 1. What is being labeled

An **index encounter** is an encounter that:

1. reached `SIGNED` or later (`REPORTED`, `FOLLOW_UP_DUE`, `CLOSED`);
2. has at least one diagnosis in the cohort's condition set;
3. has a follow-up scheduled (the `outcomes` / `outcome_cohort` row is created
   at scheduling time, not at response time).

A **mature cohort row** is an `outcome_cohort` row whose
`scheduled_at + window_days` is in the past. The denominator is mature rows.
An immature row is reported separately as "pending"; it is not silently
counted as a success or a failure.

The label is per **(encounter, condition)**. A visit with two conditions
produces two cohort rows and two labels. "Visit resolved" is not a label; it is
a roll-up that must state its rule.

---

## 2. Inputs

| Input | Source | Notes |
|---|---|---|
| Follow-up response | patient app `FollowUpScreen` / API | `better` / `same` / `worse`, wave 48h/72h/7d/30d |
| Side effects | patient app | recorded, not part of the label in v1 |
| Needs to be seen | patient app | triggers escalation; label input |
| Escalation | `encounters.state = 'ESCALATED'` or escalation event | any time in window |
| Return visit | another encounter with the same coded condition inside the window | within-network only |
| Adherence | medication events | recorded separately; not in `label_v1` |
| Non-response reason | scheduler / contact attempt | required when the label is `unknown` |

`patient_reported` is the patient's own report. It is not a clinical
assessment. The label is a **signal with a documented bias**, not ground truth.

---

## 3. Label rules, in precedence order

Evaluate top to bottom. The first match wins.

| # | Label | Condition |
|---|---|---|
| 1 | `worsened` | Any response `worse` in the window, **or** an escalation at any point in the window. |
| 2 | `resolved` | `window_complete = true` **and** latest response `better` **and** no same-condition return visit **and** no escalation. |
| 3 | `improved` | Latest response `better`, but either the window is incomplete **or** a same-condition return visit occurred. |
| 4 | `unchanged` | `window_complete = true` **and** latest response `same`. A return visit does not change this. |
| 5 | `unknown` | No usable response at close, or conflicting data that no earlier rule resolves. |

`window_complete` means the 30-day window has elapsed and the follow-up
scheduler has run its final attempt. A 48-hour "better" is **not** `resolved`;
it is `improved` with `window_complete = false`. This is the single most
important rule against early-success inflation.

### `unknown` reasons

`label = 'unknown'` always carries exactly one `non_response_reason`:

| Reason | Meaning | Counts as |
|---|---|---|
| `no_contact` | window closed; no response after the final attempt | documented non-response |
| `declined` | patient explicitly declined follow-up | documented non-response |
| `wrong_number` | contact details invalid | documented non-response |
| `app_uninstalled` | delivery failed because the app is gone | documented non-response |
| `window_not_elapsed` | row is not mature yet | pending, excluded from mature denominator |
| `insufficient_data` | a response exists but cannot be interpreted (e.g. conflicting waves with no later value) | documented non-response |

The database check enforces `(label = 'unknown') = (non_response_reason IS NOT NULL)`.
A known label cannot carry a non-response reason.

---

## 4. The denominator and the three numbers

Report three numbers from day one. One number will drift.

Let `M` = mature cohort rows for the cohort and `label_version`.

```text
positive_pct            = count(latest label = 'resolved') / M
documented_non_response = count(latest label = 'unknown'
                                with reason in ('no_contact','declined','wrong_number','app_uninstalled')) / M
lost_to_follow_up_pct   = count(mature rows with no outcome label row) / M
```

Plus, always:

```text
response_rate = count(mature rows with at least one patient_reported value) / M
pending_pct   = count(immature rows) / (mature + immature)
```

Why `lost_to_follow_up_pct` is separate from `documented_non_response`: if the
labeler job fails, or a cohort row is created without a scheduler, no `unknown`
row exists. That is not a patient non-response; it is an operational gap. The
first number hides it; the third exposes it.

Why `positive_pct` is not "X% with an outcome": `unknown` is an outcome label.
Counting it as coverage is exactly the inflation trap. The headline is
`resolved / mature`, with `documented_non_response` and `lost` beside it.

### Reporting by version

Every row stores `label_version`. A report must state:

- cohort definition (condition codes, date range);
- `label_version`;
- `M`, `positive_pct`, `documented_non_response`, `lost_to_follow_up_pct`,
  `response_rate`;
- whether early labels (`improved`, `window_complete=false`) were included;
- the same-condition return-visit source (this system only, unless a hospital
  feed exists).

A number without those six items is not quotable.

---

## 5. Versioning and history

- `label_v1` is a rule set, not a column default. A rule change is
  `label_v2`, a new check constraint, and a new row.
- **Never recompute a historical label in place.** A correction is a new row
  with `supersedes_id` pointing at the old one. The old row stays; a report by
  `label_v1` remains reproducible.
- The latest label for a cohort row is the one with the greatest `assessed_at`
  for that `label_version` (ties broken by `created_at`). The 30-day headline
  uses only `window_days = 30` and the latest `label_version`.
- A label computed under `label_v1` and one under `label_v2` are not comparable.
  The report must not aggregate across versions.

---

## 6. Data model

`outcomes` is append-only:

```sql
CREATE TABLE outcomes (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  patient_id           TEXT NOT NULL REFERENCES patients(id),
  encounter_id         TEXT NOT NULL REFERENCES encounters(id),
  condition_code       TEXT NOT NULL,
  condition_code_system TEXT,
  assessed_at          TIMESTAMPTZ NOT NULL,
  window_days          INTEGER NOT NULL CHECK (window_days IN (2, 3, 7, 30)),
  follow_up_wave       TEXT NOT NULL CHECK (follow_up_wave IN ('48h', '72h', '7d', '30d')),
  patient_reported     TEXT CHECK (patient_reported IN ('better', 'same', 'worse', 'unknown')),
  label                TEXT NOT NULL CHECK (label IN ('resolved', 'improved', 'unchanged', 'worsened', 'unknown')),
  label_version        TEXT NOT NULL CHECK (label_version = 'label_v1'),
  window_complete      BOOLEAN NOT NULL DEFAULT FALSE,
  non_response_reason  TEXT,
  source               TEXT NOT NULL CHECK (source IN ('patient_app', 'clinician', 'import')),
  supersedes_id        TEXT REFERENCES outcomes(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (label <> 'resolved' OR window_complete),
  CHECK ((label = 'unknown') = (non_response_reason IS NOT NULL))
);
```

`outcome_cohort` is the denominator and the operational state:

```sql
CREATE TABLE outcome_cohort (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  patient_id           TEXT NOT NULL REFERENCES patients(id),
  encounter_id         TEXT NOT NULL REFERENCES encounters(id),
  condition_code       TEXT NOT NULL,
  condition_code_system TEXT,
  scheduled_at         TIMESTAMPTZ NOT NULL,
  window_days          INTEGER NOT NULL DEFAULT 30 CHECK (window_days IN (2, 3, 7, 30)),
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'responded', 'closed')),
  closed_at            TIMESTAMPTZ,
  UNIQUE (tenant_id, encounter_id, condition_code, window_days)
);
```

---

## 7. Labeler flow

```text
on encounter SIGNED (or REPORTED):
  for each confirmed diagnosis in the cohort set:
    insert outcome_cohort(pending, scheduled_at = now)
    schedule final label job at now + 30d

on follow-up response:
  insert outcomes(label = label_v1(inputs, window_complete = false), ...)
  update outcome_cohort.status = 'responded'

at now + 30d (final job):
  gather responses, escalation, return visit
  insert outcomes(label = label_v1(inputs, window_complete = true), ...)
  update outcome_cohort.status = 'closed', closed_at = now

if the final job cannot run:
  do not insert a guessed label
  leave the cohort row pending
  lost_to_follow_up_pct will rise; that is the intended signal
```

The labeler is deterministic. No LLM. An LLM may summarize a cohort for a
report, but it may not assign a label.

---

## 8. Bias disclosure (put this next to the number)

- **Response bias.** Patients who feel better are more likely to answer.
  `response_rate` is the first caveat, not a footnote.
- **Natural history.** Many conditions resolve without treatment. A `resolved`
  label is not evidence that the treatment worked.
- **Within-network returns only.** A patient who went to an emergency
  department or another clinic is not a return visit in this data.
- **Adherence is self-report.** It is not in `label_v1` for this reason.
- **Window choice.** 30 days is a convention; a chronic condition needs a
  different window and a different label set.

The correct claim from `label_v1` is: "in this cohort, X% of mature encounters
were labeled resolved at 30 days, with a Y% response rate." It is not: "the
treatment worked X% of the time."

---

## 9. Acceptance tests

Fixtures, one per row:

| Case | Inputs | Expected |
|---|---|---|
| resolved | 30d complete, last `better`, no return, no escalation | `resolved` |
| early better | 48h `better`, window incomplete | `improved`, `window_complete=false` |
| better then return | 30d complete, `better`, same-condition return | `improved` |
| worse | any `worse` | `worsened` |
| escalated | no response, escalation | `worsened` |
| unchanged | 30d complete, `same` | `unchanged` |
| no contact | 30d complete, no response | `unknown` + `no_contact` |
| declined | patient declined | `unknown` + `declined` |
| pending | 30d not elapsed | `unknown` + `window_not_elapsed`, excluded from mature |
| relabel | v1 row exists, v2 rule corrects it | new row with `supersedes_id`; v1 unchanged |

Also assert: `resolved` without `window_complete` is rejected by the check;
`unknown` without a reason is rejected; a known label with a reason is rejected.

The current SQL suite proves the schema and the join from treatment to outcome.
The labeler tests are not written yet; they are the next cut, not a claim.
