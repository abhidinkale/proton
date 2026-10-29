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

/**
 * 30-day final job: evaluate mature outcome cohort rows and record finalized outcome labels.
 * Evaluates in precedence order per docs/moat/outcome-label-v1.md §7.
 */
async function closeMatureOutcomeCohort(client, { tenantId, asOfDate = new Date().toISOString() }) {
  const { rows: matureCohorts } = await client.query(
    `SELECT c.id, c.tenant_id, c.patient_id, c.encounter_id, c.condition_code,
            c.condition_code_system, c.scheduled_at, c.window_days, c.status
       FROM outcome_cohort c
      WHERE c.tenant_id = $1
        AND c.status IN ('pending', 'responded')
        AND (c.scheduled_at + (c.window_days || ' days')::interval) <= $2::timestamptz
      ORDER BY c.scheduled_at ASC;`,
    [tenantId, asOfDate]
  );

  const finalized = [];
  for (const cohort of matureCohorts) {
    const { rows: priorOutcomes } = await client.query(
      `SELECT id, patient_reported, label, assessed_at
         FROM outcomes
        WHERE tenant_id = $1
          AND encounter_id = $2
          AND condition_code = $3
        ORDER BY assessed_at ASC;`,
      [cohort.tenant_id, cohort.encounter_id, cohort.condition_code]
    );

    const responses = priorOutcomes
      .map((r) => r.patient_reported)
      .filter(Boolean);

    const { rows: encRows } = await client.query(
      `SELECT state FROM encounters WHERE id = $1 AND tenant_id = $2;`,
      [cohort.encounter_id, cohort.tenant_id]
    );
    const isEscalated =
      encRows[0]?.state === 'ESCALATED' ||
      priorOutcomes.some((r) => r.label === 'worsened');

    const { rows: returnVisits } = await client.query(
      `SELECT e.id
         FROM encounters e
         JOIN diagnoses d ON d.encounter_id = e.id AND d.tenant_id = e.tenant_id
        WHERE e.tenant_id = $1
          AND e.patient_id = $2
          AND e.id <> $3
          AND d.code = $4
          AND e.created_at > (SELECT created_at FROM encounters WHERE id = $3)
          AND e.created_at <= ($5::timestamptz + ($6 || ' days')::interval)
        LIMIT 1;`,
      [
        cohort.tenant_id,
        cohort.patient_id,
        cohort.encounter_id,
        cohort.condition_code,
        cohort.scheduled_at,
        cohort.window_days
      ]
    );
    const returnVisit = returnVisits.length > 0;

    const { label, nonResponseReason } = labelV1({
      responses,
      windowComplete: true,
      returnVisit,
      escalated: isEscalated
    });

    const previousId = priorOutcomes[priorOutcomes.length - 1]?.id || null;
    const outcomeId = `out-${crypto.randomUUID()}`;
    const assessedAt = asOfDate;

    const { rows: inserted } = await client.query(
      `INSERT INTO outcomes
         (id, tenant_id, patient_id, encounter_id, condition_code,
          condition_code_system, assessed_at, window_days, follow_up_wave,
          patient_reported, label, label_version, window_complete,
          non_response_reason, source, supersedes_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 30, '30d',
               $8, $9, 'label_v1', TRUE, $10, 'clinician', $11)
       RETURNING id, label, non_response_reason, window_days, follow_up_wave, window_complete;`,
      [
        outcomeId,
        cohort.tenant_id,
        cohort.patient_id,
        cohort.encounter_id,
        cohort.condition_code,
        cohort.condition_code_system,
        assessedAt,
        responses[responses.length - 1] || null,
        label,
        nonResponseReason,
        previousId
      ]
    );

    await client.query(
      `UPDATE outcome_cohort
          SET status = 'closed', closed_at = NOW()
        WHERE id = $1 AND tenant_id = $2;`,
      [cohort.id, cohort.tenant_id]
    );

    finalized.push(inserted[0]);
  }

  return finalized;
}

/**
 * Compute the 3 numbers and the cohort denominator per docs/moat/outcome-label-v1.md §4.
 */
async function getCohortMetrics(client, { tenantId, conditionCode = null }) {
  const params = [tenantId];
  let conditionFilter = '';
  if (conditionCode) {
    params.push(conditionCode);
    conditionFilter = `AND c.condition_code = $${params.length}`;
  }

  const { rows: cohortRows } = await client.query(
    `SELECT c.id, c.patient_id, c.encounter_id, c.condition_code,
            c.scheduled_at, c.window_days, c.status,
            ((c.scheduled_at + (c.window_days || ' days')::interval) <= NOW()) AS is_mature
       FROM outcome_cohort c
      WHERE c.tenant_id = $1 ${conditionFilter}
      ORDER BY c.scheduled_at DESC;`,
    params
  );

  const matureCohorts = cohortRows.filter((r) => r.is_mature);
  const pendingCohorts = cohortRows.filter((r) => !r.is_mature);
  const M = matureCohorts.length;
  const pendingCount = pendingCohorts.length;

  if (M === 0) {
    return {
      cohort_definition: {
        condition_code: conditionCode || 'ALL',
        label_version: 'label_v1'
      },
      counts: {
        mature: 0,
        pending: pendingCount,
        total: pendingCount,
        resolved: 0,
        improved: 0,
        unchanged: 0,
        worsened: 0,
        documented_non_response: 0,
        lost_to_follow_up: 0,
        responded: 0
      },
      rates: {
        positive_pct: 0,
        documented_non_response_pct: 0,
        lost_to_follow_up_pct: 0,
        response_rate: 0,
        pending_pct: pendingCount > 0 ? 100 : 0
      },
      bias_disclosure: [
        'Response bias: Patients who feel better are more likely to answer. Response rate is the primary context.',
        'Natural history: Many self-limiting conditions resolve without intervention; resolution is an outcome signal, not causal proof.',
        'Within-network only: Outside-network return visits or emergency department visits are not captured.',
        'Adherence is self-reported and excluded from label_v1 computation.'
      ]
    };
  }

  let resolvedCount = 0;
  let improvedCount = 0;
  let unchangedCount = 0;
  let worsenedCount = 0;
  let documentedNonResponseCount = 0;
  let lostToFollowUpCount = 0;
  let respondedCount = 0;

  for (const cohort of matureCohorts) {
    const { rows: outcomes } = await client.query(
      `SELECT id, patient_reported, label, non_response_reason, window_complete
         FROM outcomes
        WHERE tenant_id = $1
          AND encounter_id = $2
          AND condition_code = $3
          AND label_version = 'label_v1'
        ORDER BY assessed_at DESC, created_at DESC
        LIMIT 1;`,
      [tenantId, cohort.encounter_id, cohort.condition_code]
    );

    if (outcomes.length === 0) {
      lostToFollowUpCount++;
    } else {
      const latest = outcomes[0];
      if (latest.patient_reported) respondedCount++;

      if (latest.label === 'resolved') resolvedCount++;
      else if (latest.label === 'improved') improvedCount++;
      else if (latest.label === 'unchanged') unchangedCount++;
      else if (latest.label === 'worsened') worsenedCount++;
      else if (latest.label === 'unknown') {
        if (
          ['no_contact', 'declined', 'wrong_number', 'app_uninstalled', 'insufficient_data'].includes(
            latest.non_response_reason
          )
        ) {
          documentedNonResponseCount++;
        }
      }
    }
  }

  const positivePct = Number(((resolvedCount / M) * 100).toFixed(1));
  const documentedNonResponsePct = Number(((documentedNonResponseCount / M) * 100).toFixed(1));
  const lostToFollowUpPct = Number(((lostToFollowUpCount / M) * 100).toFixed(1));
  const responseRate = Number(((respondedCount / M) * 100).toFixed(1));
  const pendingPct = Number(((pendingCount / (M + pendingCount)) * 100).toFixed(1));

  return {
    cohort_definition: {
      condition_code: conditionCode || 'ALL',
      label_version: 'label_v1'
    },
    counts: {
      mature: M,
      pending: pendingCount,
      total: M + pendingCount,
      resolved: resolvedCount,
      improved: improvedCount,
      unchanged: unchangedCount,
      worsened: worsenedCount,
      documented_non_response: documentedNonResponseCount,
      lost_to_follow_up: lostToFollowUpCount,
      responded: respondedCount
    },
    rates: {
      positive_pct: positivePct,
      documented_non_response_pct: documentedNonResponsePct,
      lost_to_follow_up_pct: lostToFollowUpPct,
      response_rate: responseRate,
      pending_pct: pendingPct
    },
    bias_disclosure: [
      'Response bias: Patients who feel better are more likely to answer. Response rate is the primary context.',
      'Natural history: Many self-limiting conditions resolve without intervention; resolution is an outcome signal, not causal proof.',
      'Within-network only: Outside-network return visits or emergency department visits are not captured.',
      'Adherence is self-reported and excluded from label_v1 computation.'
    ]
  };
}

module.exports = {
  recordFollowUpOutcome,
  scheduleOutcomeCohort,
  closeMatureOutcomeCohort,
  getCohortMetrics
};
