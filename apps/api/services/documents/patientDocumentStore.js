/**
 * Patient document store — the bytes half of `patient_documents`.
 *
 * The database row is the index; this module owns the file. Keeping them
 * separate means a workflow dump stays small, and a document can be replaced
 * or moved to object storage later without a migration of the clinical table.
 *
 * Layout:  <root>/<tenant>/<patient>/<documentId>.<ext>
 *
 * Three properties this module must hold:
 *
 *  1. **The client never names the path.** The filename on disk is derived from
 *     the document id we generated, never from `file.originalname`. Traversal
 *     (`../../etc/passwd`), empty names and Unicode trickery cannot escape the
 *     root because the name is not an input.
 *  2. **Reading re-checks containment.** A `storage_path` is data from the
 *     database, which is more trusted than a request but still not allowed to
 *     point outside the root. `resolve()` + prefix check on every read.
 *  3. **A failed write leaves nothing behind.** `put` writes to a temp name and
 *     renames, so a torn upload cannot be served as a document.
 *
 * Production note: this is a single-node disk store. The `$0` pilot runs one
 * VM with the database beside it, which is why it is acceptable. Multi-instance
 * deployment must swap `read`/`put` for object storage (R2/S3) — the interface
 * here is deliberately small enough for that to be a one-file change.
 */

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const DEFAULT_ROOT = path.join(__dirname, '../../var/patient-documents');
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — a photographed 10-page report
const ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const TENANT_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Allowed types, mapped to the extension we store.
 *
 * The list is an allowlist, not a denylist: it is a clinical document store,
 * and an upload must be something a clinician can open. HEIC is included
 * because it is what an iPhone camera produces; the browser may not preview it,
 * but refusing it would make the feature useless for a large share of patients.
 */
const ALLOWED_TYPES = Object.freeze({
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heic'
});

/** Categories the app can send. Must match the CHECK in migration v7. */
const CATEGORIES = Object.freeze([
  'LAB_REPORT',
  'PRESCRIPTION',
  'DISCHARGE_SUMMARY',
  'IMAGING_REPORT',
  'REFERRAL',
  'INSURANCE',
  'OTHER'
]);

class DocumentStoreError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'DocumentStoreError';
    this.code = code;
    this.status = status;
  }
}

function rootDir(env = process.env) {
  const configured = env.PROTON_DOCUMENT_DIR;
  return configured ? path.resolve(configured) : DEFAULT_ROOT;
}

function isInsideRoot(candidate, root = rootDir()) {
  const resolvedRoot = path.resolve(root) + path.sep;
  const resolved = path.resolve(candidate);
  return resolved === path.resolve(root) || resolved.startsWith(resolvedRoot);
}

function extensionFor(mimeType) {
  const normalized = String(mimeType || '').toLowerCase().split(';')[0].trim();
  return ALLOWED_TYPES[normalized] || null;
}

function assertSafeId(value, label) {
  if (!ID_PATTERN.test(String(value || ''))) {
    throw new DocumentStoreError(
      'DOCUMENT_ID_INVALID',
      `${label} is not a valid identifier.`,
      400
    );
  }
}

/**
 * Writes one document and returns what the database row needs to point at it.
 *
 * `buffer` is used rather than a stream because the route already has the whole
 * file in memory from multer and hashing needs a second pass over it anyway;
 * for a 15 MB ceiling a stream would add complexity without buying anything.
 */
async function put({ tenantId, patientId, documentId, buffer, mimeType, env = process.env }) {
  assertSafeId(tenantId, 'Tenant');
  assertSafeId(patientId, 'Patient');
  assertSafeId(documentId, 'Document');

  const extension = extensionFor(mimeType);
  if (!extension) {
    throw new DocumentStoreError(
      'DOCUMENT_TYPE_UNSUPPORTED',
      'Only PDF and image files can be attached. Please export the report as PDF or take a photo of it.',
      415
    );
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new DocumentStoreError('DOCUMENT_EMPTY', 'The file was empty.', 400);
  }
  if (buffer.length > MAX_BYTES) {
    throw new DocumentStoreError(
      'DOCUMENT_TOO_LARGE',
      'That file is larger than 15 MB. Please split it or compress the scan.',
      413
    );
  }

  const root = rootDir(env);
  const directory = path.join(root, tenantId, patientId);
  const fileName = `${documentId}${extension}`;
  const absolute = path.join(directory, fileName);

  // Belt and braces: ids are validated above, but a future caller might pass a
  // path-shaped id that still matches the pattern (dots are legal).
  if (!isInsideRoot(absolute, root)) {
    throw new DocumentStoreError('DOCUMENT_PATH_INVALID', 'Invalid document location.', 400);
  }

  await fsp.mkdir(directory, { recursive: true });

  // Write beside the target and rename, so a crash mid-write cannot leave a
  // half-file that a later read would serve as a valid document.
  const temp = `${absolute}.part-${crypto.randomUUID()}`;
  try {
    await fsp.writeFile(temp, buffer, { mode: 0o600 });
    await fsp.rename(temp, absolute);
  } catch (err) {
    await fsp.unlink(temp).catch(() => {});
    throw new DocumentStoreError(
      'DOCUMENT_WRITE_FAILED',
      'The document could not be stored. Please try again.',
      500
    );
  }

  return {
    storagePath: path.relative(root, absolute),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    byteSize: buffer.length,
    mimeType: Object.keys(ALLOWED_TYPES).find((type) => ALLOWED_TYPES[type] === extension),
    extension
  };
}

/**
 * Opens a stored document for streaming.
 *
 * Returns `{ stream, byteSize }` so the caller can set a Content-Length before
 * piping; a missing file is a 404, not a 500, because the row existing while
 * the file does not means the store was restored from a database backup alone.
 */
async function read({ storagePath, env = process.env }) {
  const relative = String(storagePath || '');
  if (!relative) {
    throw new DocumentStoreError('DOCUMENT_MISSING', 'That document is no longer stored.', 404);
  }

  const root = rootDir(env);
  const absolute = path.resolve(root, relative);
  if (!isInsideRoot(absolute, root)) {
    throw new DocumentStoreError('DOCUMENT_PATH_INVALID', 'Invalid document location.', 400);
  }

  let stat;
  try {
    stat = await fsp.stat(absolute);
  } catch {
    throw new DocumentStoreError('DOCUMENT_MISSING', 'That document is no longer stored.', 404);
  }
  if (!stat.isFile()) {
    throw new DocumentStoreError('DOCUMENT_MISSING', 'That document is no longer stored.', 404);
  }

  return { stream: fs.createReadStream(absolute), byteSize: stat.size };
}

/** Best-effort removal, used when the database insert fails after a write. */
async function remove({ storagePath, env = process.env }) {
  const relative = String(storagePath || '');
  if (!relative) return;
  const root = rootDir(env);
  const absolute = path.resolve(root, relative);
  if (!isInsideRoot(absolute, root)) return;
  await fsp.unlink(absolute).catch(() => {});
}

module.exports = {
  DocumentStoreError,
  ALLOWED_TYPES,
  CATEGORIES,
  MAX_BYTES,
  rootDir,
  isInsideRoot,
  extensionFor,
  put,
  read,
  remove
};
