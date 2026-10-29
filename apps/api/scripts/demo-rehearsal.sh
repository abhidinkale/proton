#!/usr/bin/env bash
# Demo rehearsal — the five beats, asserted.
#
# Run before every demo. It fails loudly on the first beat that would fail live.
#
#   ./scripts/demo-rehearsal.sh            # expects the API on :8791
#   PORT=9000 ./scripts/demo-rehearsal.sh
#
# Requires: curl, jq, psql, and the demo database from scripts/seed-demo.js.
set -euo pipefail

BASE="http://localhost:${PORT:-8791}"
DB="${DATABASE_URL:-postgres://localhost:5432/proton_demo}"
DOC='x-proton-dev-persona: physician-lin'
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; exit 1; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

step '0. seed'
DATABASE_URL="$DB" node "$(dirname "$0")/seed-demo.js" >/dev/null
ok 'patient, 2025 episode, and today’s draft note'

step '1. the clinic signs'
SIGN=$(curl -sS -X POST "$BASE/api/workflow/encounters/enc-demo-1/transitions" \
  -H 'content-type: application/json' -H "$DOC" \
  -d '{"action":"sign","attestation":true}')
[ "$(jq -r .encounter.state <<<"$SIGN")" = "SIGNED" ] || fail "state: $(jq -c . <<<"$SIGN")"
ATT=$(jq -r .attestation.id <<<"$SIGN")
[ "$ATT" != "null" ] || fail 'no attestation id'
ok "SIGNED, attestation $ATT"

step '2. the signature verifies from outside the app'
VERIFY=$(curl -sS "$BASE/api/workflow/encounters/enc-demo-1/attestation" -H "$DOC")
[ "$(jq -r .valid <<<"$VERIFY")" = "true" ] || fail "verify: $(jq -c . <<<"$VERIFY")"
HASH=$(jq -r .content_hash <<<"$VERIFY")
ok "valid, content_hash $HASH"

step '3. one changed character breaks it'
psql -q "$DB" -c "UPDATE clinical_attestations SET content_canonical =
  replace(content_canonical, '38.4', '38.5') WHERE id = '$ATT';"
TAMPERED=$(curl -sS "$BASE/api/workflow/attestations/$ATT/verify" -H "$DOC")
[ "$(jq -r .valid <<<"$TAMPERED")" = "false" ] || fail "tamper not detected: $(jq -c . <<<"$TAMPERED")"
ok "valid:false ($(jq -r '.errors[0].code' <<<"$TAMPERED"))"

step '4. restore, and it verifies again'
psql -q "$DB" -c "UPDATE clinical_attestations SET content_canonical =
  replace(content_canonical, '38.5', '38.4') WHERE id = '$ATT';"
RESTORED=$(curl -sS "$BASE/api/workflow/attestations/$ATT/verify" -H "$DOC")
[ "$(jq -r .valid <<<"$RESTORED")" = "true" ] || fail 'restore failed'
[ "$(jq -r .content_hash <<<"$RESTORED")" = "$HASH" ] || fail 'hash changed after restore'
ok 'valid, same hash'

step '5. the patient replies, and the loop closes'
TOKEN=$(curl -sS -X POST "$BASE/api/patient/auth/dev-session" \
  -H 'content-type: application/json' -d '{"patientId":"pat-demo-1"}' | jq -r .token)
CHECKIN=$(curl -sS -X POST "$BASE/api/patient/sync/follow-ups" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "idempotency-key: rehearsal-$(date +%s)" \
  -d '{"appointmentId":"appt-demo-1","recovery":"BETTER","hasSideEffects":false,
       "needsToBeSeen":false,"wave":"48h"}')
[ "$(jq -r .outcomeRecorded <<<"$CHECKIN")" = "true" ] || fail "no outcome: $(jq -c . <<<"$CHECKIN")"
LABEL=$(jq -r '.outcomes[0].label' <<<"$CHECKIN")
[ "$LABEL" = "improved" ] || fail "expected improved (48h is never resolved), got $LABEL"
ok "outcome $LABEL, window $(jq -r '.outcomes[0].window_days' <<<"$CHECKIN")d (not resolved)"

step '6. the recurrence is in the record'
PRIOR=$(psql -At -F'|' "$DB" -c "
  SELECT e.created_at::date, d.code, o.label, o.window_days
    FROM diagnoses d
    JOIN encounters e ON e.id = d.encounter_id
    LEFT JOIN outcomes o ON o.encounter_id = e.id AND o.condition_code = d.code
   WHERE e.patient_id = 'pat-demo-1' AND d.code = '43878008'
     AND e.id <> 'enc-demo-1'
   ORDER BY e.created_at DESC LIMIT 1;")
[ -n "$PRIOR" ] || fail 'no prior episode'
ok "prior episode $(cut -d'|' -f1 <<<"$PRIOR"), SNOMED $(cut -d'|' -f2 <<<"$PRIOR"), $(cut -d'|' -f3 <<<"$PRIOR") at $(cut -d'|' -f4 <<<"$PRIOR")d"

step '7. the denominator exists'
COHORT=$(psql -At "$DB" -c "
  SELECT status FROM outcome_cohort
   WHERE encounter_id = 'enc-demo-1' AND condition_code = '43878008';")
[ "$COHORT" = "responded" ] || fail "cohort status: $COHORT"
ok 'cohort row scheduled at signature, now responded'

printf '\n\033[32mAll beats pass.\033[0m Say "11 months", not "2 years".\n'
