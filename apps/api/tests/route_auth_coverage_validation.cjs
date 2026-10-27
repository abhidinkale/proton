/**
 * Route Authentication Coverage Validation
 *
 * WHY THIS EXISTS
 * ---------------
 * `app.js` protects most surfaces with a single path-prefix mount:
 *
 *     app.use(['/api/clinical', '/api/ai', ...], resolveActorMiddleware);
 *
 * That is efficient, but it fails silently in the worst possible direction: add a
 * new route under a prefix that was never added to the mount array and it is
 * live on the public internet with no authentication, and every existing test
 * still passes. Express does not warn. Nothing in the type system catches it.
 *
 * This suite makes that failure loud. It enumerates every route registered in
 * `app.js` and asserts each one is either:
 *   (a) covered by an authenticated prefix mount, or
 *   (b) on the explicit exemption list below, with a written reason.
 *
 * The exemption list is the product's public attack surface. It is intentionally
 * small and every entry is justified. Growing it should require a code review
 * that consciously accepts the risk.
 *
 * It also verifies the patient surface specifically: patient routes carry no
 * clinician session, so they must each carry `requirePatientAuth` and must never
 * take identity from the request body.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, '..', 'app.js');

/**
 * Route prefixes that are deliberately public, with the reason.
 * Matching is by prefix, so '/api/patient/' covers everything beneath it.
 */
const EXEMPTIONS = [
  {
    prefix: '/health',
    reason: 'Liveness/readiness probes. Must answer before sessions exist; contains no PHI.'
  },
  {
    prefix: '/api/health',
    reason: 'Liveness/readiness probes. Must answer before sessions exist; contains no PHI.'
  },
  {
    prefix: '/api/auth/',
    reason: 'Clinician login/logout/session bootstrap. Cannot require a session to create one.'
  },
  {
    prefix: '/api/patient/auth/',
    reason: 'Patient OTP bootstrap. Cannot require a session to create one.'
  },
  {
    prefix: '/api/patient/',
    reason:
      'Patient surface: has no clinician session. Every route here MUST additionally carry ' +
      'requirePatientAuth — enforced by check 3 below.'
  },
  {
    prefix: '/api/capture/',
    reason:
      'Mobile capture handoff. Authenticated by a single-use per-session pairing token issued ' +
      'by an authenticated clinician request, not by an actor session.'
  },
  {
    prefix: '/api/smart/',
    reason: 'SMART on FHIR OAuth discovery + token exchange, which is the authentication mechanism itself.'
  }
];

/** Middleware that constitutes a real authentication decision. */
const AUTH_MIDDLEWARE = ['resolveActorMiddleware', 'requirePatientAuth'];

/** Routes that are patient-facing and must therefore require patient auth. */
function isPatientRoute(routePath) {
  return routePath.startsWith('/api/patient/') && !routePath.startsWith('/api/patient/auth/');
}

function readAppSource() {
  return fs.readFileSync(APP_JS, 'utf8');
}

/** Extract every path prefix protected by a resolveActorMiddleware mount. */
function parseAuthenticatedPrefixes(src) {
  // There is more than one such mount: the main block near the top of the file,
  // plus narrower ones declared immediately above the routes they protect (e.g.
  // `/api/intake`). Parsing only the first would misreport those routes as
  // public — a false positive that would erode trust in this gate.
  //
  // The argument is captured by a tempered scan that refuses to cross another
  // `app.use(`. A naive `\[[\s\S]*?\]` is not safe here: a comment inside the
  // main mount contains `['/api/pilot/feedback', ...]`, and an unrelated
  // `app.use([...], someRouter)` earlier in the file used to make the match jump
  // ~1,500 lines forward to the *intake* mount, silently dropping `/api/intake`
  // from the protected set. That is exactly the false positive this suite exists
  // to prevent, so the parser must not depend on bracket luck.
  const mounts = [];
  const pattern =
    /app\.use\(((?:(?!app\.use\()[\s\S]){0,12000}?),\s*resolveActorMiddleware\s*\)/g;

  let match;
  while ((match = pattern.exec(src))) {
    const prefixes = [...match[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2]);
    mounts.push(...prefixes);
  }
  return mounts.length > 0 ? [...new Set(mounts)] : null;
}

/**
 * Extract every app.METHOD(...) registration with its middleware chain.
 * The chain is the text between the path argument and the handler signature,
 * which is where Express receives any guards.
 */
function parseRoutes(src) {
  const pattern =
    /app\.(get|post|put|patch|delete)\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*")\s*,([\s\S]{0,800}?)\((?:req|_req|request)\b/g;

  const routes = [];
  let match;
  while ((match = pattern.exec(src))) {
    const paths = [...match[2].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] || m[2]);
    routes.push({
      method: match[1].toUpperCase(),
      paths,
      chain: match[3],
      line: src.slice(0, match.index).split('\n').length
    });
  }
  return routes;
}

function findExemption(routePath) {
  return EXEMPTIONS.find((entry) => routePath.startsWith(entry.prefix));
}

function runRouteAuthCoverageValidation() {
  const src = readAppSource();
  const routes = parseRoutes(src);
  const prefixes = parseAuthenticatedPrefixes(src);

  let passed = 0;
  const total = 6;

  // ---------------------------------------------------------------- 1
  // The mount must exist. If someone restructures app.js and drops it, every
  // clinician route silently becomes public — so this is the most important
  // assertion in the file.
  assert.ok(
    prefixes && prefixes.length > 0,
    'The global authenticated prefix mount (app.use([...], resolveActorMiddleware)) is missing from app.js. ' +
      'Without it every clinician route is public.'
  );
  passed += 1;
  console.log(`  ✓ authenticated prefix mount found (${prefixes.length} prefixes)`);

  // ---------------------------------------------------------------- 2
  // Route enumeration must actually find routes. A parser regression that
  // silently matches nothing would make this suite vacuously green.
  assert.ok(routes.length >= 100, `Only ${routes.length} routes parsed from app.js; expected 100+. The parser has drifted.`);
  passed += 1;
  console.log(`  ✓ parsed ${routes.length} route registrations`);

  // ---------------------------------------------------------------- 3
  // Every patient route must carry requirePatientAuth.
  const patientRoutes = routes.filter((route) => route.paths.some(isPatientRoute));
  assert.ok(patientRoutes.length > 0, 'No patient routes found; the patient surface should exist.');

  const unguardedPatient = patientRoutes.filter(
    (route) => !route.chain.includes('requirePatientAuth')
  );
  if (unguardedPatient.length > 0) {
    const detail = unguardedPatient
      .map((r) => `      line ${r.line}: ${r.method} ${r.paths.join(' | ')}`)
      .join('\n');
    assert.fail(
      `\n  ${unguardedPatient.length} patient route(s) accept unauthenticated caller-supplied identity:\n${detail}\n` +
        '  These read patientId/tenantId from the request body. Anyone can read or write any patient.\n' +
        '  Fix: add requirePatientAuth to the middleware chain and derive identity from req.patient.'
    );
  }
  passed += 1;
  console.log(`  ✓ all ${patientRoutes.length} patient routes require patient auth`);

  // ---------------------------------------------------------------- 4
  // Patient routes must never fall back to a caller-supplied tenant identity.
  const dangerouslyDefaulted = [...src.matchAll(/tenantId\s*:\s*(?:[A-Za-z_$][\w$]*\.)?body\.tenantId\s*\|\|/g)];
  if (dangerouslyDefaulted.length > 0) {
    const lines = dangerouslyDefaulted.map((m) => src.slice(0, m.index).split('\n').length);
    assert.fail(
      `\n  ${dangerouslyDefaulted.length} tenant fallback(s) to a request-body value at line(s) ${lines.join(', ')}.\n` +
        '  Tenant identity must come from the authenticated session, never from the client.'
    );
  }
  passed += 1;
  console.log('  ✓ no route derives tenant identity from the request body');

  // ---------------------------------------------------------------- 5
  // Every route is either covered by an authenticated prefix mount, carries an
  // auth middleware inline, or is explicitly exempt.
  const uncovered = [];
  for (const route of routes) {
    const hasInlineAuth = AUTH_MIDDLEWARE.some((guard) => route.chain.includes(guard));
    if (hasInlineAuth) continue;

    for (const routePath of route.paths) {
      const coveredByMount = prefixes.some((prefix) => routePath.startsWith(prefix));
      if (!coveredByMount && !findExemption(routePath)) {
        uncovered.push({ ...route, routePath });
      }
    }
  }

  if (uncovered.length > 0) {
    const detail = uncovered
      .map((r) => `      line ${r.line}: ${r.method} ${r.routePath}`)
      .join('\n');
    assert.fail(
      `\n  ${uncovered.length} route(s) are neither authenticated nor explicitly exempt:\n${detail}\n\n` +
        '  These are reachable by anyone who can reach the server.\n' +
        '  Fix one of:\n' +
        '    a) add the prefix to the app.use([...], resolveActorMiddleware) array, or\n' +
        '    b) add it to EXEMPTIONS in this file with a written reason and a reviewer who agreed.'
    );
  }
  passed += 1;
  console.log(`  ✓ every route is authenticated or explicitly exempt (${routes.length} routes)`);

  // ---------------------------------------------------------------- 6
  // Exemptions must stay small and must each carry a reason. This is a soft
  // budget: if it trips, the reviewer is forced to look at the growth.
  const EXEMPTION_BUDGET = 8;
  assert.ok(
    EXEMPTIONS.length <= EXEMPTION_BUDGET,
    `Exemption list has grown to ${EXEMPTIONS.length} entries (budget ${EXEMPTION_BUDGET}). ` +
      'Every addition is public attack surface — review each one.'
  );
  const reasonless = EXEMPTIONS.filter((e) => !e.reason || e.reason.length < 20);
  assert.deepStrictEqual(reasonless, [], 'Every exemption needs a substantive written reason.');
  passed += 1;
  console.log(`  ✓ exemption list within budget (${EXEMPTIONS.length}/${EXEMPTION_BUDGET}) and documented`);

  // ---------------------------------------------------------------- report
  console.log('\n  Public surface (deliberate, must stay small):');
  for (const entry of EXEMPTIONS) {
    const count = routes.filter((r) => r.paths.some((p) => p.startsWith(entry.prefix))).length;
    console.log(`    ${entry.prefix.padEnd(24)} ${String(count).padStart(3)} route(s)`);
  }

  console.log(`\n✅ ${passed}/${total} route auth coverage checks passed`);
}

try {
  runRouteAuthCoverageValidation();
} catch (err) {
  console.error(`\n❌ Route auth coverage validation failed:\n${err.message}\n`);
  process.exit(1);
}
