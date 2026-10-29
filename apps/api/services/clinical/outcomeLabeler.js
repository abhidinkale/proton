/**
 * Outcome labeler — `label_v1`.
 *
 * Pure and deterministic: no LLM, no clock, no I/O. The rules are pinned in
 * docs/moat/outcome-label-v1.md §3 and evaluated in precedence order, first
 * match wins. Keeping it a pure function is what lets the same inputs produce
 * the same label in a test, a backfill, and a Python verifier.
 *
 * The one rule that matters most: a 48-hour "better" is `improved`, never
 * `resolved`. `resolved` requires the 30-day window to have elapsed and no
 * same-condition return visit.
 */

const WAVES = Object.freeze({
  '48h': { windowDays: 2, label: '48h' },
  '72h': { windowDays: 3, label: '72h' },
  '7d': { windowDays: 7, label: '7d' },
  '30d': { windowDays: 30, label: '30d' }
});

const USABLE = new Set(['better', 'same', 'worse']);

/**
 * @param {object} input
 * @param {string[]} input.responses  patient reports, oldest first
 * @param {boolean} input.windowComplete  30-day window elapsed and final attempt ran
 * @param {boolean} [input.returnVisit]  same-condition encounter inside the window
 * @param {boolean} [input.escalated]  any escalation inside the window
 * @returns {{ label: 'worsened'|'resolved'|'improved'|'unchanged'|'unknown',
 *             nonResponseReason: string|null }}
 */
function labelV1({ responses = [], windowComplete = false, returnVisit = false, escalated = false }) {
  const seen = responses.map((r) => String(r || '').toLowerCase()).filter((r) => USABLE.has(r));
  const latest = seen[seen.length - 1];

  if (escalated || seen.includes('worse')) {
    return { label: 'worsened', nonResponseReason: null };
  }
  if (latest === 'better') {
    return {
      label: windowComplete && !returnVisit ? 'resolved' : 'improved',
      nonResponseReason: null
    };
  }
  if (latest === 'same' && windowComplete) {
    return { label: 'unchanged', nonResponseReason: null };
  }
  // No label yet, or a response that cannot be interpreted at this window.
  // `window_not_elapsed` is the honest reason even when a response exists: the
  // cohort row is still pending and is excluded from the mature denominator.
  return {
    label: 'unknown',
    nonResponseReason: !windowComplete
      ? 'window_not_elapsed'
      : latest
        ? 'insufficient_data'
        : 'no_contact'
  };
}

/** Validate a wave key and return the DB constants it maps to. */
function waveOf(wave) {
  const entry = WAVES[wave];
  if (!entry) {
    const error = new Error(`Unknown follow-up wave '${wave}'. Expected one of ${Object.keys(WAVES).join(', ')}.`);
    error.status = 400;
    error.code = 'WAVE_INVALID';
    throw error;
  }
  return entry;
}

module.exports = { labelV1, waveOf, WAVES };
