/**
 * Proton Medplum Outbox / Retry Queue Worker
 *
 * Scans for signed encounters or outbox items with status 'PENDING' / 'FAILED'
 * and syncs them to Medplum with exponential backoff and idempotency.
 * On success, transitions encounter to 'COMMITTED_TO_FHIR' or updates sync receipt.
 */

const { medplumClientService } = require('./medplumClientService');
const { fhirService } = require('./fhirService');

class MedplumQueueWorker {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 5;
    this.initialBackoffMs = options.initialBackoffMs || 1000;
  }

  /**
   * Commits an encounter's clinical bundle directly to Medplum.
   * Enforces idempotency via deterministic identifiers & If-None-Exist / Conditional update.
   */
  async commitEncounterToFhir({ encounterId, patientId, practitionerId, note, conditions = [], prescriptions = [], serviceRequests = [], tenantId = 'org-default' }) {
    const bundle = fhirService.buildEncounterBundle({
      patientId,
      practitionerId,
      encounterId,
      noteText: typeof note === 'string' ? note : note?.content,
      confirmedConditions: conditions,
      confirmedPrescriptions: prescriptions,
      confirmedServiceRequests: serviceRequests,
      status: 'active'
    });

    const txResult = await medplumClientService.executeTransaction(bundle);

    return {
      success: true,
      transactionId: txResult.id || bundle.id,
      entriesCount: txResult.entry ? txResult.entry.length : 0,
      bundle: txResult
    };
  }

  /**
   * Dispatches an outbox sync row with retry backoff.
   */
  async processOutboxEntry(entry, commitFn) {
    let attempt = 0;
    let lastErr = null;

    while (attempt < this.maxAttempts) {
      attempt++;
      try {
        const result = await commitFn(entry);
        return {
          status: 'COMMITTED',
          attempts: attempt,
          result
        };
      } catch (err) {
        lastErr = err;
        const delay = this.initialBackoffMs * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, Math.min(delay, 10000)));
      }
    }

    return {
      status: 'RETRY_EXHAUSTED',
      attempts: attempt,
      error: lastErr?.message
    };
  }
}

const medplumQueueWorker = new MedplumQueueWorker();

module.exports = {
  MedplumQueueWorker,
  medplumQueueWorker
};
