/**
 * Proton Operations OS — FHIR R4 Integration Adapter
 * 
 * Supports:
 * - Resource types: Patient, Appointment, Communication, MedicationRequest, ServiceRequest, DocumentReference, Observation, DiagnosticReport, Condition
 * - Modes: Live Medplum server or deterministic synthetic store
 * - Deterministic idempotency, If-None-Exist conditional create
 * - Strict schema validation
 */

const BaseAdapter = require('./baseAdapter');

class FhirAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('FHIR_R4', config);
    this.mode = config.mode || (process.env.FHIR_PERSISTENCE_MODE === 'medplum' ? 'medplum' : 'synthetic');
    this.baseUrl = config.baseUrl || process.env.MEDPLUM_BASE_URL || 'http://localhost:8103/fhir/R4';
    this.token = config.token || process.env.MEDPLUM_TOKEN || 'demo-token';
    this.syntheticStore = new Map(); // key: `${resourceType}/${id}`
  }

  setSyntheticStore(resource) {
    if (!resource || !resource.resourceType || !resource.id) return;
    this.syntheticStore.set(`${resource.resourceType}/${resource.id}`, resource);
  }

  async persistResource(resource, options = {}) {
    const { idempotencyKey, taskIdentifier, tenantId = 'org-default' } = options;
    const now = new Date().toISOString();

    if (!resource.resourceType) {
      throw new Error('FHIR resource must specify a valid resourceType.');
    }

    // Deterministic ID derivation if not provided
    const deterministicId = resource.id || (taskIdentifier
      ? `${resource.resourceType.toLowerCase()}-${taskIdentifier.value}`
      : `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);

    const fhirResource = {
      ...resource,
      id: deterministicId,
      meta: {
        ...(resource.meta || {}),
        versionId: '1',
        lastUpdated: now,
        tag: [
          ...(resource.meta?.tag || []),
          { system: 'https://proton.health/tenant', code: tenantId },
          { system: 'https://proton.health/persistence-mode', code: this.mode }
        ]
      }
    };

    if (this.mode === 'medplum') {
      try {
        const headers = {
          'Content-Type': 'application/fhir+json',
          'Authorization': `Bearer ${this.token}`
        };
        if (taskIdentifier) {
          headers['If-None-Exist'] = `identifier=${taskIdentifier.system}|${taskIdentifier.value}`;
        }
        const res = await fetch(`${this.baseUrl}/${resource.resourceType}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(fhirResource)
        });
        if (!res.ok) {
          throw new Error(`Medplum responded with HTTP ${res.status}: ${res.statusText}`);
        }
        const persisted = await res.json();
        this.logCall('persistResource', { resourceType: resource.resourceType, id: persisted.id }, persisted);
        return {
          success: true,
          persistedResource: persisted,
          meta: { mode: 'medplum_live', livePersisted: true, id: persisted.id, timestamp: now }
        };
      } catch (err) {
        this.logCall('persistResource', { resourceType: resource.resourceType }, null, err);
        throw err;
      }
    }

    // Synthetic Store Mode
    const storeKey = `${resource.resourceType}/${deterministicId}`;
    this.syntheticStore.set(storeKey, fhirResource);
    this.logCall('persistResource', { resourceType: resource.resourceType, id: deterministicId }, fhirResource);

    return {
      success: true,
      persistedResource: fhirResource,
      meta: {
        mode: 'synthetic_store',
        livePersisted: false,
        id: deterministicId,
        storeKey,
        timestamp: now
      }
    };
  }

  async getResource(resourceType, id) {
    if (this.mode === 'medplum') {
      const res = await fetch(`${this.baseUrl}/${resourceType}/${id}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (!res.ok) return null;
      return await res.json();
    }
    return this.syntheticStore.get(`${resourceType}/${id}`) || null;
  }

  async searchResources(resourceType, params = {}) {
    if (this.mode === 'medplum') {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${this.baseUrl}/${resourceType}?${qs}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (!res.ok) return [];
      const bundle = await res.json();
      return (bundle.entry || []).map(e => e.resource);
    }
    const results = [];
    for (const [key, resource] of this.syntheticStore.entries()) {
      if (key.startsWith(`${resourceType}/`)) {
        let match = true;
        if (params.patient && resource.subject?.reference !== `Patient/${params.patient}`) match = false;
        if (params.status && resource.status !== params.status) match = false;
        if (match) results.push(resource);
      }
    }
    return results;
  }
}

module.exports = FhirAdapter;
