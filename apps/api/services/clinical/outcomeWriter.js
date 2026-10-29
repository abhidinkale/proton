/**
 * Outcome writer — the closing half of the loop.
 *
 * A follow-up answer is not a message with a `recovery` field; it is an
 * append-only outcome label over a cohort row that was created when the
 * encounter was signed. The message stays too (a clinician must be able to read
 * what the patient said), but the label is what makes the loop countable.
 *
 * Takes a transaction client. The message, the label, and the cohort status
 * commit together or not at all.
 */

const crypto = require('node:crypto');
const { labelV1, waveOf } = require('./outcomeLabeler');

/**
 * Which follow-up wave is this? Derived from the encounter, not from a client
 * field: a phone cannot be trusted to say how many days have passed, and a
 * 7-day check-in mislabeled as 48h would corrupt the window comparison.
 */
function deriveWave(startedAt, assessedAt) {
  const days = (new Date(assessedAt).getTime() - new Date(startedAt).getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return '48h';
  if (days <= 3) return '48h';
  if (days <= 4) return '72h';
  if (days <= 14) return '7d';
  return '30d';
}

/** Confirmed primary diagnoses on the encounter, one cohort row per condition. */
async function recordFollowUpOutcome(client, input) {
  const {
    tenantId,
    patientId,
    encounterId,
    recovery, // 'better' | 'same' | 'worse'
    wave: requestedWave,
    escalated = false,
    assessedAt = new Date().toISOString()
  } = input;

  const { rows: encounterRows } = await client.query(
    `SELECT created_at FROM encounters WHERE id = $1 AND tenant_id = $2;`,
    [encounterId, tenantId]
  );
  if (!encounterRows.length) return [];

  const wave = requestedWave || deriveWave(encounterRows[0].created_at, assessedAt);
  const { windowDays, label: waveKey } = waveOf(wave);
  const { label, nonResponseReason } = labelV1({
    responses: [recovery],
    windowComplete: false, // a check-in is never the final 30-day job
    escalated
  });

  const { rows: conditions } = await client.query(
    `SELECT code_system, code FROM diagnoses
      WHERE tenant_id = $1 AND encounter_id = $2
        AND certainty = 'CONFIRMED' AND is_primary
      ORDER BY id;`,
    [tenantId, encounterId]
  );
  if (!conditions.length) return [];

  const recorded = [];
  for (const condition of conditions) {
    // The denominator is the 30-day cohort row, created at signature. A 48-hour
    // answer flips it to `responded` but does not create a second denominator:
    // the wave is a property of the outcome row, not of the cohort.
    await client.query(
      `INSERT INTO outcome_cohort
         (id, tenant_id, patient_id, encounter_id, condition_code,
          condition_code_system, scheduled_at, window_days, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 30, 'responded')
       ON CONFLICT (tenant_id, encounter_id, condition_code, window_days)
       DO UPDATE SET status = 'responded';`,
      [
        `coh-${crypto.randomUUID()}`,
        tenantId,
        patientId,
        encounterId,
        condition.code,
        condition.code_system,
        assessedAt
      ]
    );

    const previous = (
      await client.query(
        `SELECT id FROM outcomes
          WHERE tenant_id = $1 AND encounter_id = $2 AND condition_code = $3
            AND window_days = $4
          ORDER BY assessed_at DESC LIMIT 1;`,
        [tenantId, encounterId, condition.code, windowDays]
      )
    ).rows[0];

    const { rows } = await client.query(
      `INSERT INTO outcomes
         (id, tenant_id, patient_id, encounter_id, condition_code,
          condition_code_system, assessed_at, window_days, follow_up_wave,
          patient_reported, label, label_version, window_complete,
          non_response_reason, source, supersedes_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'label_v1',
               FALSE, $12, 'patient_app', $13)
       RETURNING id, label, non_response_reason, window_days, follow_up_wave;`,
      [
        `out-${crypto.randomUUID()}`,
        tenantId,
        patientId,
        encounterId,
        condition.code,
        condition.code_system,
        assessedAt,
        windowDays,
        waveKey,
        recovery.toLowerCase(),
        label,
        nonResponseReason,
        previous?.id ?? null
      ]
    );
    recorded.push(rows[0]);
  }
  return recorded;
}

/**
 * Sign-time half: create the denominator for each confirmed primary diagnosis.
 * Called inside the sign transaction so a signed encounter with a cohort
 * condition is never missing from the denominator.
 */
async function scheduleOutcomeCohort(client, { tenantId, encounterId }) {
  await client.query(
    `INSERT INTO outcome_cohort
       (id, tenant_id, patient_id, encounter_id, condition_code,
        condition_code_system, scheduled_at, window_days, status)
     SELECT 'coh-' || md5(random()::text || clock_timestamp()::text || d.id),
            d.tenant_id, e.patient_id, d.encounter_id, d.code, d.code_system,
            NOW(), 30, 'pending'
       FROM diagnoses d
       JOIN encounters e ON e.id = d.encounter_id
      WHERE d.tenant_id = $1 AND d.encounter_id = $2
        AND d.certainty = 'CONFIRMED' AND d.is_primary
     ON CONFLICT (tenant_id, encounter_id, condition_code, window_days) DO NOTHING;`,
    [tenantId, encounterId]
  );
}

module.exports = { recordFollowUpOutcome, scheduleOutcomeCohort };
