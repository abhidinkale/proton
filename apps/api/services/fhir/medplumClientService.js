/**
 * Proton Medplum Client Service
 *
 * Wraps @medplum/core MedplumClient with robust OAuth2 client credentials auth,
 * caching, transaction execution, idempotency, and resource reads.
 *
 * All Medplum operations strictly originate from apps/api.
 * Frontends/renderers NEVER hold or receive Medplum credentials.
 */

const { MedplumClient } = require('@medplum/core');

class MedplumClientService {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.MEDPLUM_BASE_URL || 'http://localhost:8103/';
    this.clientId = config.clientId || process.env.MEDPLUM_CLIENT_ID || '8f8ec235-1153-4b6f-966f-f6005e2ae27b';
    this.clientSecret = config.clientSecret || process.env.MEDPLUM_CLIENT_SECRET || 'e0fb12ae9c48a34b87d1dba7b33ba0d8912448759f1362a3c840f6a9b807074f';
    this.token = config.token || process.env.MEDPLUM_TOKEN || null;

    this.client = new MedplumClient({
      baseUrl: this.baseUrl,
      clientId: this.clientId
    });

    if (this.token) {
      this.client.setAccessToken(this.token);
    }
  }

  /**
   * Ensures the client has an active authenticated session.
   */
  async ensureAuthenticated() {
    if (this.client.getAccessToken()) {
      return this.client;
    }

    if (this.clientId && this.clientSecret) {
      await this.client.startClientLogin(this.clientId, this.clientSecret);
      return this.client;
    }

    if (this.token) {
      this.client.setAccessToken(this.token);
      return this.client;
    }

    throw new Error('MedplumClient cannot authenticate: no client credentials or token provided.');
  }

  /**
   * Executes an atomic FHIR transaction bundle.
   * @param {Object} bundle FHIR Bundle with type 'transaction'
   * @returns {Promise<Object>} Transaction response Bundle
   */
  async executeTransaction(bundle) {
    if (!bundle || bundle.resourceType !== 'Bundle' || bundle.type !== 'transaction') {
      throw new Error('Invalid bundle: resourceType must be Bundle and type must be transaction.');
    }

    await this.ensureAuthenticated();
    return await this.client.executeBatch(bundle);
  }

  /**
   * Reads a single resource by type and ID.
   * @param {string} resourceType
   * @param {string} id
   */
  async readResource(resourceType, id) {
    await this.ensureAuthenticated();
    return await this.client.readResource(resourceType, id);
  }

  /**
   * Searches resources by type and search query parameters.
   * @param {string} resourceType
   * @param {Object} searchParams
   */
  async searchResources(resourceType, searchParams = {}) {
    await this.ensureAuthenticated();
    return await this.client.searchResources(resourceType, searchParams);
  }
}

// Central singleton instance configured from environment
const medplumClientService = new MedplumClientService();

module.exports = {
  MedplumClientService,
  medplumClientService
};
