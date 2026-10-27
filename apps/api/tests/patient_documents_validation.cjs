/**
 * Patient document upload validation.
 *
 * Proves the one path that carries a patient's own paperwork into the clinic:
 * the bytes land inside the storage root, the database row points at them, the
 * owner can read them back, another patient cannot, and a retry does not leave
 * two copies.
 *
 * Security checks are first-class here, not an afterthought — a document store
 * that can be walked to another patient's scan is worse than no document store.
 *
 * Covers:
 *   - unauthenticated upload and download are rejected
 *   - an upload is stored inside the root, hashed, and indexed
 *   - the owner can download the exact bytes; another patient gets 404
 *   - a replay with the same local id does not store a second copy
 *   - a non-PDF/image type is refused (415)
 *   - a path-shaped filename is reduced to a name, never a path
 *   - an oversize file is refused before it is written (413)
 *   - pull carries the document to its owner only
 *   - a clinician sees it with the patient name; another tenant sees nothing
 *   - retracting hides it without destroying the audit row
 *
 * Requires PostgreSQL (same skip policy as the other durability suites).
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { prepareSuite } = require('./helpers/postgresTestHarness.cjs');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PROTON_SYNTHETIC_MODE = 'true';

// A throwaway root per run: the suite asserts on the real filesystem, so it must
// not share a directory with a developer's running API.
const documentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'proton-patient-docs-'));
process.env.PROTON_DOCUMENT_DIR = documentRoot;

let passCount = 0;
let failCount = 0;

async function testAsync(name, fn) {
  try {
    await fn();
    passCount++;
    console.log(`✓ [PASS] ${name}`);
  } catch (err) {
    failCount++;
    console.error(`✗ [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');

async function run() {
  const target = await prepareSuite({
    suiteFile: 'patient_documents_validation.cjs',
    testDbName: process.env.PROTON_TEST_DOCS_DB || 'proton_ops_docs_test'
  });
  if (!target) process.exit(0);

  const { runPostgresMigrations, closePostgresPool } = require('../storage/postgresDb');
  await runPostgresMigrations();

  const app = require('../app');
  const repo = require('../storage/postgres/workflowRepository');
  const { createSessionToken } = require('../middleware/authService');
  const { stopWorkflowRuntime } = require('../services/workflow/runtime');

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = (requestPath, { method = 'GET', body, headers = {} } = {}) =>
    fetch(`${baseUrl}${requestPath}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

  const devPatientToken = async (patientId) => {
    const res = await request('/api/patient/auth/dev-session', {
      method: 'POST',
      body: { patientId }
    });
    const parsed = await res.json();
    assert.ok(parsed.token, `dev-session failed for ${patientId}: ${res.status}`);
    return { Authorization: `Bearer ${parsed.token}` };
  };

  const clinician = (overrides = {}) => {
    const token = createSessionToken({
      actorId: 'usr-md-lin-01',
      actorRole: 'physician',
      actorName: 'Dr. Sarah Lin, MD',
      tenantId: 'org-default',
      npi: '1928374650',
      ...overrides
    });
    return { Authorization: `Bearer ${token}` };
  };

  /** Multipart upload. The token header only — fetch must set the boundary. */
  const uploadDocument = async ({
    headers,
    bytes = PDF_BYTES,
    fileName = 'cbc-report.pdf',
    type = 'application/pdf',
    fields = {}
  }) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), fileName);
    for (const [key, value] of Object.entries(fields)) form.append(key, String(value));

    const res = await fetch(`${baseUrl}/api/patient/sync/documents`, {
      method: 'POST',
      headers,
      body: form
    });
    const body = await res.json().catch(() => null);
    return { res, body };
  };

  const patientA = await devPatientToken('pat-synthetic-a');
  const patientB = await devPatientToken('pat-synthetic-b');
  const doctor = clinician();
  const otherTenantDoctor = clinician({ tenantId: 'org-other', actorId: 'usr-other-01' });

  let documentId = null;

  await testAsync('an unauthenticated upload is rejected', async () => {
    const { res } = await uploadDocument({ headers: {} });
    assert.strictEqual(res.status, 401);
  });

  await testAsync('an unauthenticated download is rejected', async () => {
    const res = await fetch(`${baseUrl}/api/patient/sync/documents/anything/file`);
    assert.strictEqual(res.status, 401);
  });

  await testAsync('a PDF is stored, hashed and indexed', async () => {
    const { res, body } = await uploadDocument({
      headers: patientA,
      fields: {
        title: 'Complete blood count',
        category: 'LAB_REPORT',
        localDocumentId: 'local-doc-1'
      }
    });

    assert.strictEqual(res.status, 201, body && body.error);
    assert.ok(body.document && body.document.id, 'the response must carry the document');
    documentId = body.document.id;

    assert.strictEqual(body.document.title, 'Complete blood count');
    assert.strictEqual(body.document.category, 'LAB_REPORT');
    assert.strictEqual(body.document.contentType, 'application/pdf');
    assert.strictEqual(body.document.byteSize, PDF_BYTES.length);
    assert.strictEqual(
      body.document.sha256,
      crypto.createHash('sha256').update(PDF_BYTES).digest('hex')
    );
    // The storage path is an implementation detail; leaking it would invite a
    // client to construct file URLs that bypass the authenticated route.
    assert.strictEqual(body.document.storagePath, undefined);
  });

  await testAsync('the bytes are on disk inside the storage root', async () => {
    const row = await repo.getPatientDocument({ tenantId: 'org-default', documentId });
    assert.ok(row, 'the row must exist');
    const absolute = path.resolve(documentRoot, row.storage_path);
    assert.ok(
      absolute.startsWith(path.resolve(documentRoot) + path.sep),
      `storage path escaped the root: ${absolute}`
    );
    const written = fs.readFileSync(absolute);
    assert.deepStrictEqual(written, PDF_BYTES);
  });

  await testAsync('the owner downloads the exact bytes', async () => {
    const res = await fetch(`${baseUrl}/api/patient/sync/documents/${documentId}/file`, {
      headers: patientA
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    const downloaded = Buffer.from(await res.arrayBuffer());
    assert.deepStrictEqual(downloaded, PDF_BYTES);
  });

  await testAsync('another patient cannot download it', async () => {
    const res = await fetch(`${baseUrl}/api/patient/sync/documents/${documentId}/file`, {
      headers: patientB
    });
    assert.strictEqual(res.status, 404);
  });

  await testAsync('a replay with the same local id does not store a second copy', async () => {
    const { res, body } = await uploadDocument({
      headers: { ...patientA, 'Idempotency-Key': 'doc-replay-key-2' },
      fields: { title: 'Complete blood count', category: 'LAB_REPORT', localDocumentId: 'local-doc-1' }
    });

    assert.ok(res.status === 200 || res.status === 201, `unexpected status ${res.status}`);
    assert.strictEqual(body.document.id, documentId, 'the retry must map to the same document');

    const rows = await repo.listPatientDocuments({ tenantId: 'org-default', patientId: 'pat-synthetic-a' });
    assert.strictEqual(rows.length, 1, `expected one document, found ${rows.length}`);
  });

  await testAsync('a text file is refused', async () => {
    const { res, body } = await uploadDocument({
      headers: patientA,
      bytes: Buffer.from('not a document'),
      fileName: 'notes.txt',
      type: 'text/plain'
    });
    assert.strictEqual(res.status, 415);
    assert.strictEqual(body.code, 'DOCUMENT_TYPE_UNSUPPORTED');
  });

  await testAsync('a path-shaped filename is reduced to a name', async () => {
    const { res, body } = await uploadDocument({
      headers: patientA,
      fileName: '../../evil.pdf',
      fields: { title: 'Imported', category: 'OTHER', localDocumentId: 'local-doc-traversal' }
    });
    assert.strictEqual(res.status, 201, body && body.error);

    const row = await repo.getPatientDocument({ tenantId: 'org-default', documentId: body.document.id });
    assert.strictEqual(row.original_name, 'evil.pdf');
    assert.ok(
      !row.storage_path.includes('..') && !row.storage_path.includes('evil'),
      `the file name must not reach the path: ${row.storage_path}`
    );
    assert.ok(
      path.resolve(documentRoot, row.storage_path).startsWith(path.resolve(documentRoot) + path.sep)
    );
  });

  await testAsync('the document reaches its owner through pull, and no one else', async () => {
    const pullA = await (await request('/api/patient/sync/pull', { headers: patientA })).json();
    assert.ok(
      pullA.documents.some((doc) => doc.id === documentId),
      'the owner must see the document in their pull'
    );

    const pullB = await (await request('/api/patient/sync/pull', { headers: patientB })).json();
    assert.ok(
      !pullB.documents.some((doc) => doc.id === documentId),
      'another patient must never receive this document'
    );
  });

  await testAsync('a clinician sees it with the patient name', async () => {
    const res = await request('/api/clinic/live/documents', { headers: doctor });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    const found = body.documents.find((doc) => doc.id === documentId);
    assert.ok(found, 'the clinician must see the uploaded document');
    assert.ok(found.patientName, 'the list must carry the patient name');
  });

  await testAsync('a clinician downloads the patient document', async () => {
    const res = await fetch(`${baseUrl}/api/clinic/live/documents/${documentId}/file`, {
      headers: doctor
    });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(Buffer.from(await res.arrayBuffer()), PDF_BYTES);
  });

  await testAsync('another tenant sees nothing and cannot download', async () => {
    const list = await (await request('/api/clinic/live/documents', { headers: otherTenantDoctor })).json();
    assert.strictEqual(list.documents.length, 0, 'another tenant must see an empty list');

    const res = await fetch(`${baseUrl}/api/clinic/live/documents/${documentId}/file`, {
      headers: otherTenantDoctor
    });
    assert.strictEqual(res.status, 404);
  });

  await testAsync('retracting hides the document without destroying the audit row', async () => {
    const res = await request(`/api/patient/sync/documents/${documentId}`, {
      method: 'DELETE',
      headers: patientA
    });
    assert.strictEqual(res.status, 200);

    const download = await fetch(`${baseUrl}/api/patient/sync/documents/${documentId}/file`, {
      headers: patientA
    });
    assert.strictEqual(download.status, 404);

    const pull = await (await request('/api/patient/sync/pull', { headers: patientA })).json();
    assert.ok(!pull.documents.some((doc) => doc.id === documentId), 'pull must hide it');

    const row = await repo.getPatientDocument({ tenantId: 'org-default', documentId });
    assert.ok(row && row.deleted_at, 'the row must survive with deleted_at set');
  });

  await testAsync('a file over the ceiling is refused before it is written', async () => {
    const oversize = Buffer.alloc(16 * 1024 * 1024, 0x41);
    const { res, body } = await uploadDocument({
      headers: patientA,
      bytes: oversize,
      fileName: 'huge.pdf',
      fields: { title: 'Too big', category: 'OTHER', localDocumentId: 'local-doc-huge' }
    });
    assert.strictEqual(res.status, 413);
    assert.strictEqual(body.code, 'DOCUMENT_TOO_LARGE');
  });

  console.log(`\n${'='.repeat(68)}`);
  console.log(`   PATIENT DOCUMENTS VALIDATION: ${passCount}/${passCount + failCount} passed`);
  console.log(`${'='.repeat(68)}\n`);

  await new Promise((resolve) => server.close(resolve));
  await stopWorkflowRuntime().catch(() => {});
  await closePostgresPool().catch(() => {});
  fs.rmSync(documentRoot, { recursive: true, force: true });

  if (failCount > 0) process.exit(1);
}

run().catch((err) => {
  console.error('[patient-documents-validation] crashed:', err);
  process.exit(1);
});
