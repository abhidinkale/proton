/**
 * Proton Healthcare Operations OS — Repository Factory
 * 
 * Provides runtime driver abstraction allowing the platform to seamlessly run on
 * SQLite (for synthetic local/test development) or PostgreSQL (for distributed private beta).
 */

const sqliteTaskRepo = require('./taskRepository');
const sqliteAuditRepo = require('./auditRepository');
const sqliteJobRepo = require('./jobRepository');
const sqliteAgentRunRepo = require('./agentRunRepository');
const sqliteIdempotencyRepo = require('./idempotencyRepository');

const pgTaskRepo = require('./postgres/taskRepositoryPg');
const pgAuditRepo = require('./postgres/auditRepositoryPg');
const pgJobRepo = require('./postgres/jobRepositoryPg');

let forcedDriver = null;

function getActiveDriver() {
  if (forcedDriver) return forcedDriver;
  return process.env.PROTON_DB_DRIVER === 'postgres' ? 'postgres' : 'sqlite';
}

function setActiveDriver(driver) {
  if (driver !== 'sqlite' && driver !== 'postgres' && driver !== null) {
    throw new Error(`Invalid repository driver: ${driver}. Must be 'sqlite' or 'postgres'.`);
  }
  forcedDriver = driver;
}

function getTaskRepository() {
  return getActiveDriver() === 'postgres' ? pgTaskRepo : sqliteTaskRepo;
}

function getAuditRepository() {
  return getActiveDriver() === 'postgres' ? pgAuditRepo : sqliteAuditRepo;
}

function getJobRepository() {
  return getActiveDriver() === 'postgres' ? pgJobRepo : sqliteJobRepo;
}

function getAgentRunRepository() {
  return sqliteAgentRunRepo;
}

function getIdempotencyRepository() {
  return sqliteIdempotencyRepo;
}

module.exports = {
  getActiveDriver,
  setActiveDriver,
  getTaskRepository,
  getAuditRepository,
  getJobRepository,
  getAgentRunRepository,
  getIdempotencyRepository
};
