/**
 * Attestation ledger store — P0.2.
 *
 * The ledger is the spine: a note is not "signed" because a boolean flipped, it
 * is signed because a row exists that carries the exact canonical bytes that
 * were signed, chained to the tenant's previous row.
 *
 * Two properties this file must never lose:
 *
 *  1. `append()` takes a transaction client. The attestation and the state
 *     transition commit together, or neither does.
 *  2. `verify()` recomputes from `content_canonical` alone. It never reads the
 *     note row, so a note edited in SQLite, Postgres, or by a DBA cannot make a
 *     stale signature look valid — it makes verification fail.
 *
 * The chain is per tenant. `pg_advisory_xact_lock` serializes appends for a
 * tenant, so two concurrent signings cannot mint the same `seq`.
 */

const crypto = require('node:crypto');
const att = require('./attestation');

const ROW_COLUMNS = `id, tenant_id, seq, encounter_id, patient_id, note_id,
  content_canonical, content_hash, prev_hash, chain_hash, attested_at,
  actor_id, actor_name, actor_role, actor_npi, decision,
  kernel_version, kernel_verdict_hash, created_at`;

const toRow = (row) =>
  row && {
    ...row,
    seq: Number(row.seq),
    attested_at: new Date(row.attested_at).toISOString(),
    created_at: new Date(row.created_at).toISOString()
  };

/**
 * Append one attestation to the tenant chain. Must be called inside a
 * transaction that also performs the sign transition.
 *
 * @returns {{ id, seq, content_hash, chain_hash, attested_at, content_canonical }}
 */
async function append(client, input) {
  const {
    tenantId,
    encounterId,
    patientId,
    note,
    diagnoses = [],
    prescriptions = [],
    proposals = [],
    kernel = null,
    actor,
    decision = 'SIGNED'
  } = input;

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1));', [`attest:${tenantId}`]);

  const head = (
    await client.query(
      `SELECT seq, chain_hash FROM clinical_attestations
        WHERE tenant_id = $1 ORDER BY seq DESC LIMIT 1;`,
      [tenantId]
    )
  ).rows[0];

  const attestedAt = new Date().toISOString();
  const content = att.buildAttestationContent({
    tenantId,
    encounterId,
    patientId,
    note,
    diagnoses,
    prescriptions,
    proposals,
    kernel,
    attestedBy: actor,
    attestedAt
  });

  const contentCanonical = att.canonicalize(content);
  const contentHash = att.computeContentHash(content);
  const seq = head ? Number(head.seq) + 1 : 1;
  const prevHash = head ? head.chain_hash : null;
  const chainHash = att.computeChainHash({
    seq,
    prevHash,
    contentHash,
    attestedAt,
    actorId: actor.actor_id
  });

  const { rows } = await client.query(
    `INSERT INTO clinical_attestations
       (id, tenant_id, seq, encounter_id, patient_id, note_id,
        content_canonical, content_hash, prev_hash, chain_hash, attested_at,
        actor_id, actor_name, actor_role, actor_npi, decision,
        kernel_version, kernel_verdict_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17, $18)
     RETURNING ${ROW_COLUMNS};`,
    [
      `att-${crypto.randomUUID()}`,
      tenantId,
      seq,
      encounterId,
      patientId,
      note.note_id,
      contentCanonical,
      contentHash,
      prevHash,
      chainHash,
      attestedAt,
      actor.actor_id,
      actor.actor_name,
      actor.role,
      actor.npi ?? null,
      decision,
      kernel?.version ?? null,
      kernel?.verdict_hash ?? null
    ]
  );

  return toRow(rows[0]);
}

/**
 * Verify one attestation and its link to the predecessor.
 * Reads only the ledger: the returned canonical content is what was signed.
 */
async function verifyById(db, tenantId, attestationId) {
  const row = (
    await db.query(
      `SELECT ${ROW_COLUMNS} FROM clinical_attestations
        WHERE id = $1 AND tenant_id = $2;`,
      [attestationId, tenantId]
    )
  ).rows[0];

  if (!row) return { found: false, valid: false, errors: [{ code: 'NOT_FOUND' }] };

  const current = toRow(row);
  const prev = current.seq > 1
    ? (
        await db.query(
          `SELECT seq, chain_hash FROM clinical_attestations
            WHERE tenant_id = $1 AND seq = $2;`,
          [tenantId, current.seq - 1]
        )
      ).rows[0]
    : null;

  const result = att.verifyAttestation(
    current,
    prev ? { seq: Number(prev.seq), chain_hash: prev.chain_hash } : null
  );

  return {
    found: true,
    valid: result.valid,
    errors: result.errors,
    attestation_id: current.id,
    seq: current.seq,
    encounter_id: current.encounter_id,
    note_id: current.note_id,
    content_hash: current.content_hash,
    chain_hash: current.chain_hash,
    attested_at: current.attested_at,
    content: JSON.parse(current.content_canonical)
  };
}

/** Verify a tenant's whole chain. Returns the first broken seq, if any. */
async function verifyTenantChain(db, tenantId) {
  const { rows } = await db.query(
    `SELECT ${ROW_COLUMNS} FROM clinical_attestations
      WHERE tenant_id = $1 ORDER BY seq ASC;`,
    [tenantId]
  );
  const result = att.verifyChain(rows.map(toRow));
  return { ...result, length: rows.length };
}

module.exports = { append, verifyById, verifyTenantChain };
