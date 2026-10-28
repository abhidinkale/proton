/**
 * Proton Structured Clinical Note — note_v1
 *
 * The schema is the contract between the cockpit, the attestation hash, the
 * knowledge base citations, and every later consumer (compare visits, graph
 * extraction, coding). It is intentionally small: a core clinical set plus a
 * lossless `narrative`. It grows by version, not by migration.
 *
 * Two rules are deliberate:
 *
 * 1. Decimal measurements are strings. "38.4" is a value with a unit; 38.4 is a
 *    float that a JSON canonicalizer may format differently. Integers remain
 *    numbers because they are exact.
 *
 * 2. Every object is strict. An unknown field is a validation error, not a
 *    silent drop. If a writer needs a new field, the schema version changes.
 */

const { z } = require('zod');

const MEASUREMENT_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const measurement = (label) =>
  z
    .string()
    .max(40)
    .regex(MEASUREMENT_RE, `${label} must be a decimal string such as "38.4" or "128"`);

const shortText = (max = 200) => z.string().min(1).max(max);
const optionalShortText = (max = 200) => z.string().max(max).nullable();
const stringList = (max = 20) => z.array(z.string().min(1).max(200)).max(max);

const ChiefComplaint = z.strictObject({
  text: shortText(500),
  onset: optionalShortText(80),
  duration: optionalShortText(80),
  severity: z.number().int().min(1).max(10).nullable()
});

const HpiEntry = z.strictObject({
  symptom: shortText(200),
  onset: optionalShortText(80),
  character: optionalShortText(120),
  aggravating: stringList(10),
  relieving: stringList(10),
  associated: stringList(20)
});

const PastCondition = z.strictObject({
  condition: shortText(200),
  code: optionalShortText(64),
  since: optionalShortText(40)
});

const HistoricalMedication = z.strictObject({
  name: shortText(200),
  dose: optionalShortText(80),
  frequency: optionalShortText(80)
});

const Allergy = z.strictObject({
  substance: shortText(200),
  reaction: optionalShortText(300),
  severity: z.enum(['mild', 'moderate', 'severe', 'unknown'])
});

const Subjective = z.strictObject({
  chief_complaint: ChiefComplaint,
  hpi: z.array(HpiEntry).max(50),
  pmh: z.array(PastCondition).max(100),
  medications: z.array(HistoricalMedication).max(100),
  allergies: z.array(Allergy).max(100),
  narrative: z.string().max(50000)
});

const Vitals = z.strictObject({
  temperature_c: measurement('temperature_c').nullable(),
  heart_rate_bpm: measurement('heart_rate_bpm').nullable(),
  systolic_bp_mmhg: measurement('systolic_bp_mmhg').nullable(),
  diastolic_bp_mmhg: measurement('diastolic_bp_mmhg').nullable(),
  respiratory_rate_bpm: measurement('respiratory_rate_bpm').nullable(),
  spo2_pct: measurement('spo2_pct').nullable(),
  weight_kg: measurement('weight_kg').nullable(),
  height_cm: measurement('height_cm').nullable()
});

const ExamFinding = z.strictObject({
  system: shortText(80),
  finding: shortText(500),
  laterality: z.enum(['left', 'right', 'bilateral', 'midline', 'not_applicable']).nullable()
});

const LabResult = z.strictObject({
  test: shortText(120),
  value: z.string().min(1).max(60),
  unit: z.string().min(1).max(40),
  reference_range: optionalShortText(80),
  flag: z.enum(['low', 'normal', 'high', 'critical_low', 'critical_high', 'unknown']).nullable()
});

const Objective = z.strictObject({
  vitals: Vitals,
  exam: z.array(ExamFinding).max(100),
  labs: z.array(LabResult).max(200)
});

const DifferentialEntry = z.strictObject({
  condition: shortText(300),
  band: z.enum(['supported', 'weak', 'insufficient']),
  for: stringList(20),
  against: stringList(20),
  guideline_ref: optionalShortText(200)
});

const Assessment = z.strictObject({
  differential: z.array(DifferentialEntry).max(20),
  primary: z.strictObject({
    condition: shortText(300),
    basis: z.string().min(1).max(2000)
  })
});

const PlanMedication = z.strictObject({
  drug: shortText(200),
  dose: z.string().min(1).max(120),
  route: z.string().min(1).max(60),
  frequency: z.string().min(1).max(120),
  duration_days: z.number().int().min(1).max(365).nullable(),
  rationale: z.string().min(1).max(1000)
});

const Order = z.strictObject({
  type: shortText(80),
  detail: shortText(500),
  rationale: z.string().min(1).max(1000)
});

const FollowUp = z.strictObject({
  interval: z.string().min(1).max(80),
  method: z.string().min(1).max(80),
  triggers: stringList(10)
});

const Education = z.strictObject({
  topic: shortText(200),
  material_id: optionalShortText(128)
});

const Plan = z.strictObject({
  medications: z.array(PlanMedication).max(50),
  orders: z.array(Order).max(50),
  follow_up: FollowUp,
  education: z.array(Education).max(50)
});

const Provenance = z.strictObject({
  source: z.enum(['transcript', 'record', 'ai', 'clinician']),
  ref: z.string().min(1).max(500)
});

const NoteV1 = z.strictObject({
  schema_version: z.literal('note_v1'),
  subjective: Subjective,
  objective: Objective,
  assessment: Assessment,
  plan: Plan,
  provenance: z.record(z.string(), Provenance).optional()
});

/**
 * Format a Zod issue path as a field path a UI can focus:
 *   ['plan', 'medications', 0, 'dose'] -> 'plan.medications[0].dose'
 */
function formatPath(path = []) {
  return path.reduce((acc, part) => {
    if (typeof part === 'number') return `${acc}[${part}]`;
    return acc ? `${acc}.${part}` : String(part);
  }, '');
}

/**
 * Validate a note. Returns structured errors, not a thrown exception, because
 * the signing endpoint must return the failing field to the cockpit.
 */
function validateNote(input) {
  const result = NoteV1.safeParse(input);
  if (result.success) {
    return { valid: true, errors: [], data: result.data };
  }
  return {
    valid: false,
    errors: result.error.issues.map((issue) => {
      // Zod reports strict-object failures at the object, with the offending
      // key in `keys`. Surface the field itself so the cockpit can focus it.
      const path =
        issue.code === 'unrecognized_keys' && Array.isArray(issue.keys) && issue.keys.length > 0
          ? formatPath([...issue.path, issue.keys[0]])
          : formatPath(issue.path);
      return { path, code: issue.code, message: issue.message };
    })
  };
}

function toJsonSchema() {
  const schema = z.toJSONSchema(NoteV1, { target: 'draft-2020-12', io: 'input' });
  return {
    $id: 'https://proton.health/schemas/note_v1.schema.json',
    title: 'Proton Structured Clinical Note v1',
    description:
      'note_v1: core structured clinical note. Decimal measurements are strings; integers are numbers. Unknown fields are rejected.',
    ...schema
  };
}

module.exports = {
  NoteV1,
  validateNote,
  toJsonSchema,
  formatPath,
  MEASUREMENT_RE
};
