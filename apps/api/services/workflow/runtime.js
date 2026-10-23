/**
 * Proton Workflow Runtime
 *
 * Boots the durable half of the clinical loop:
 *   - runs the Postgres migrations (v1 operational + v2 workflow)
 *   - starts pg-boss on the same database (no Redis)
 *   - registers a recurring outbox-dispatch job
 *
 * Persistence resolution:
 *   WORKFLOW_PERSISTENCE=postgres  -> enabled
 *   WORKFLOW_PERSISTENCE=disabled  -> explicitly off (unit tests, UI-only dev)
 *   unset                          -> enabled iff DATABASE_URL is set
 *
 * This keeps `node index.js` working with zero configuration (SQLite/legacy
 * mode) while a deployment that provides DATABASE_URL gets durability.
 */

const { getPostgresConfig, runPostgresMigrations, closePostgresPool } = require('../../storage/postgresDb');
const { dispatchDueOutbox } = require('./outboxDispatcher');

const OUTBOX_QUEUE = 'workflow.outbox.dispatch';

let boss = null;
let started = false;
let startPromise = null;

function resolveWorkflowPersistence(env = process.env) {
  const explicit = (env.WORKFLOW_PERSISTENCE || '').toLowerCase();
  if (explicit === 'disabled' || explicit === 'memory' || explicit === 'off') return 'disabled';
  if (explicit === 'postgres' || explicit === 'true') return 'postgres';
  return env.DATABASE_URL ? 'postgres' : 'disabled';
}

function isWorkflowPersistenceEnabled(env = process.env) {
  return resolveWorkflowPersistence(env) === 'postgres';
}

async function startWorkflowRuntime({ runMigrations = true, startScheduler = null } = {}) {
  if (!isWorkflowPersistenceEnabled()) {
    return { enabled: false, reason: 'WORKFLOW_PERSISTENCE is disabled (no DATABASE_URL).' };
  }
  if (started) return { enabled: true, reused: true };

  // Guard against two concurrent boot calls in the same process.
  if (startPromise) return startPromise;

  startPromise = (async () => {
    if (runMigrations) {
      await runPostgresMigrations();
    }

    const PgBoss = require('pg-boss');
    boss = new PgBoss({
      connectionString: getPostgresConfig().connectionString,
      application_name: 'proton-workflow',
      max: 5,
      retryLimit: 5,
      retryDelay: 15,
      retryBackoff: true,
      expireInMinutes: 5,
      deleteAfterDays: 7
    });

    boss.on('error', (err) => {
      console.error('[workflow] pg-boss error:', err.message);
    });

    await boss.start();

    await boss.createQueue(OUTBOX_QUEUE, {
      policy: 'stately',
      retryLimit: 5,
      retryDelay: 15,
      retryBackoff: true
    });

    // Worker: drains due outbox rows. Handler receives an array of jobs in v10.
    await boss.work(OUTBOX_QUEUE, { batchSize: 1, pollingIntervalSeconds: 5 }, async () => {
      const summary = await dispatchDueOutbox({ limit: 25 });
      if (summary.claimed > 0) {
        console.log(
          `[workflow] outbox dispatch: claimed=${summary.claimed} dispatched=${summary.dispatched} ` +
            `failed=${summary.failed} simulated=${summary.simulated}`
        );
      }
      return summary;
    });

    // Safety net: even if a transition fails to wake the worker, a due row is
    // picked up within a minute. Schedule only when the scheduler is enabled
    // (the test suite calls the dispatcher directly).
    const schedulerEnabled = startScheduler === null
      ? (process.env.WORKFLOW_SCHEDULER || '').toLowerCase() !== 'off'
      : Boolean(startScheduler);

    if (schedulerEnabled) {
      await boss.schedule(OUTBOX_QUEUE, '* * * * *', { source: 'scheduler' });
    }

    started = true;
    return { enabled: true, queue: OUTBOX_QUEUE, scheduler: schedulerEnabled };
  })();

  try {
    return await startPromise;
  } catch (err) {
    startPromise = null;
    throw err;
  }
}

async function stopWorkflowRuntime() {
  if (boss) {
    try {
      await boss.stop({ graceful: true, wait: true, timeout: 5000 });
    } catch (err) {
      console.error('[workflow] error stopping pg-boss:', err.message);
    }
    boss = null;
  }
  started = false;
  startPromise = null;
}

function getBoss() {
  return boss;
}

async function closeRuntimeAndPool() {
  await stopWorkflowRuntime();
  await closePostgresPool();
}

module.exports = {
  OUTBOX_QUEUE,
  resolveWorkflowPersistence,
  isWorkflowPersistenceEnabled,
  startWorkflowRuntime,
  stopWorkflowRuntime,
  closeRuntimeAndPool,
  getBoss
};
