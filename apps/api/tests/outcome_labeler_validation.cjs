/**
 * label_v1 — precedence table.
 *
 * The cases are copied from docs/moat/outcome-label-v1.md §9. The one that
 * matters for the demo: a 48-hour "better" is `improved`, never `resolved`.
 */

const assert = require('assert');
const { labelV1 } = require('../services/clinical/outcomeLabeler');

const cases = [
  ['resolved: 30d complete, last better, no return, no escalation', { responses: ['better'], windowComplete: true }, 'resolved', null],
  ['early better: 48h better, window incomplete', { responses: ['better'], windowComplete: false }, 'improved', null],
  ['better then return: 30d complete, same-condition return', { responses: ['better'], windowComplete: true, returnVisit: true }, 'improved', null],
  ['worse: any worse in the window', { responses: ['better', 'worse'], windowComplete: true }, 'worsened', null],
  ['escalated: no response, escalation', { responses: [], windowComplete: true, escalated: true }, 'worsened', null],
  ['unchanged: 30d complete, same', { responses: ['same'], windowComplete: true }, 'unchanged', null],
  ['unchanged is not claimed early: 48h same', { responses: ['same'], windowComplete: false }, 'unknown', 'window_not_elapsed'],
  ['no contact: 30d complete, no response', { responses: [], windowComplete: true }, 'unknown', 'no_contact'],
  ['pending: 30d not elapsed', { responses: [], windowComplete: false }, 'unknown', 'window_not_elapsed']
];

let pass = 0;
let fail = 0;
for (const [name, input, expectedLabel, expectedReason] of cases) {
  const result = labelV1(input);
  try {
    assert.strictEqual(result.label, expectedLabel, `label ${result.label} !== ${expectedLabel}`);
    assert.strictEqual(result.nonResponseReason, expectedReason);
    assert.strictEqual(
      (result.label === 'unknown') === (result.nonResponseReason !== null),
      true,
      'unknown must carry exactly one reason, and only unknown may'
    );
    pass += 1;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    fail += 1;
    console.error(`✗ [FAIL] ${name}\n         ${err.message}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
