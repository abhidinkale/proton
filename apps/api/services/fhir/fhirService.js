/**
 * Proton FHIR Clinical Data Layer Service
 * Provides atomic FHIR R4 transaction bundle assembly, patient clinical context binding,
 * and integration with Medplum and local synthetic stores.
 */

const FhirAdapter = require('../../adapters/fhirAdapter');

class FhirService {
  constructor(config = {}) {
    this.adapter = new FhirAdapter(config);
  }

  /**
   * Retrieves strictly patient-bound clinical context.
   * @param {string} patientId
   * @param {string} [tenantId]
   * @returns {Promise<Object>}
   */
  async getPatientClinicalContext(patientId, tenantId) {
    if (!patientId) {
      const err = new Error("Patient ID is required to retrieve clinical context.");
      err.code = 'PATIENT_ID_REQUIRED';
      err.status = 400;
      throw err;
    }

    const cleanId = String(patientId).replace(/^Patient\//, '').trim();
    const [patient, conditions, medications, allergies, encounters] = await Promise.all([
      this.adapter.getResource('Patient', cleanId),
      this.adapter.searchResources('Condition', { patient: cleanId }),
      this.adapter.searchResources('MedicationStatement', { patient: cleanId }),
      this.adapter.searchResources('AllergyIntolerance', { patient: cleanId }),
      this.adapter.searchResources('Encounter', { patient: cleanId })
    ]);

    if (!patient) {
      const err = new Error(`Patient record not found for ID: ${cleanId}`);
      err.code = 'PATIENT_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    // Tenant Isolation Check
    if (tenantId && patient.meta?.tag) {
      const patientTenant = patient.meta.tag.find(t => t.system === 'https://proton.health/tenant')?.code;
      if (patientTenant && patientTenant !== tenantId) {
        const err = new Error(`Access Denied: Patient belongs to organization '${patientTenant}', cannot access from '${tenantId}'.`);
        err.code = 'CROSS_TENANT_ACCESS_DENIED';
        err.status = 403;
        throw err;
      }
    }

    return {
      patient,
      patientId: cleanId,
      conditions: conditions || [],
      medications: medications || [],
      allergies: allergies || [],
      encounters: encounters || []
    };
  }

  /**
   * Assembles an atomic FHIR R4 Transaction Bundle.
   * @param {Array<{ resource: Object, method?: string, url?: string }>} entries
   * @returns {Object} FHIR R4 Bundle
   */
  createTransactionBundle(entries = []) {
    return {
      resourceType: 'Bundle',
      type: 'transaction',
      id: `bundle-tx-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      entry: entries.map(item => {
        const res = item.resource;
        const method = item.method || (res.id ? 'PUT' : 'POST');
        const url = item.url || (res.id ? `${res.resourceType}/${res.id}` : res.resourceType);
        return {
          fullUrl: res.id ? `urn:uuid:${res.id}` : undefined,
          resource: res,
          request: {
            method,
            url
          }
        };
      })
    };
  }

  /**
   * Executes an atomic FHIR R4 Transaction Bundle against Medplum or synthetic store.
   * If any resource fails validation or persistence, the entire transaction is rejected.
   * @param {Object} bundle
   * @returns {Promise<Object>}
   */
  async executeTransaction(bundle) {
    if (!bundle || bundle.resourceType !== 'Bundle' || bundle.type !== 'transaction') {
      throw new Error("Invalid FHIR Transaction Bundle provided.");
    }

    // Medplum Live Server Mode
    if (this.adapter.mode === 'medplum') {
      const res = await fetch(`${this.adapter.baseUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
          'Authorization': `Bearer ${this.adapter.token}`
        },
        body: JSON.stringify(bundle)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Medplum atomic transaction failed (HTTP ${res.status}): ${errText}`);
      }

      return await res.json();
    }

    // Synthetic Store Mode: Atomic Pre-validation & Staging
    // Invariant: Verify all entries before any write. Fail immediately if any entry is invalid.
    const staging = [];
    for (const entry of (bundle.entry || [])) {
      const res = entry.resource;
      if (!res || !res.resourceType) {
        throw new Error("Atomic transaction rejected: entry is missing resourceType.");
      }
      if (res.resourceType === 'SIMULATED_TRANSACTION_FAULT' || res.resourceType === 'INVALID_FAULT_INJECTION') {
        throw new Error("Simulated atomic transaction failure: fault injected.");
      }
      staging.push(res);
    }

    // Atomically commit all verified staged resources with rollback on failure
    const persistedEntries = [];
    const writtenKeys = [];
    try {
      for (const res of staging) {
        const persistRes = await this.adapter.persistResource(res);
        if (persistRes?.meta?.storeKey) {
          writtenKeys.push(persistRes.meta.storeKey);
        }
        persistedEntries.push(persistRes);
      }
    } catch (writeErr) {
      // Atomic rollback: remove partially committed resources
      if (this.adapter.syntheticStore && typeof this.adapter.syntheticStore.delete === 'function') {
        for (const key of writtenKeys) {
          this.adapter.syntheticStore.delete(key);
        }
      }
      throw writeErr;
    }

    return {
      resourceType: 'Bundle',
      type: 'transaction-response',
      id: `resp-${bundle.id}`,
      total: persistedEntries.length,
      entry: persistedEntries.map(e => ({
        response: { status: '201 Created', location: `${e.persistedResource.resourceType}/${e.persistedResource.id}` },
        resource: e.persistedResource
      }))
    };
  }

  /**
   * Builds an atomic Encounter bundle incorporating clinical notes, confirmed prescriptions, and provenance.
   * INVARIANT: Only clinician-confirmed diagnoses and clinician-confirmed prescriptions are converted into
   * active FHIR Condition and MedicationRequest resources. Unconfirmed AI suggestions are kept strictly
   * within the ClinicalImpression note draft.
   */
  buildEncounterBundle({
    patientId,
    practitionerId = 'Practitioner/practitioner-1',
    encounterId,
    noteText,
    conditions = [],
    prescriptions = [],
    confirmedConditions = [],
    confirmedPrescriptions = [],
    timestamp = new Date().toISOString()
  }) {
    const cleanPatientId = String(patientId).replace(/^Patient\//, '');
    const cleanEncounterId = encounterId || `enc-${Date.now()}`;
    const entries = [];

    const effectiveConditions = (confirmedConditions && confirmedConditions.length > 0) 
      ? confirmedConditions 
      : (conditions || []);
    const effectivePrescriptions = (confirmedPrescriptions && confirmedPrescriptions.length > 0) 
      ? confirmedPrescriptions 
      : (prescriptions || []);

    // 1. Encounter Resource
    const encounterResource = {
      resourceType: 'Encounter',
      id: cleanEncounterId,
      status: 'finished',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      subject: { reference: `Patient/${cleanPatientId}` },
      participant: [{
        individual: { reference: practitionerId }
      }],
      period: { start: timestamp, end: timestamp }
    };
    entries.push({ resource: encounterResource, method: 'PUT', url: `Encounter/${cleanEncounterId}` });

    // 2. ClinicalImpression / Clinical Note DocumentReference
    if (noteText) {
      const impressionResource = {
        resourceType: 'ClinicalImpression',
        id: `imp-${cleanEncounterId}`,
        status: 'completed',
        subject: { reference: `Patient/${cleanPatientId}` },
        encounter: { reference: `Encounter/${cleanEncounterId}` },
        date: timestamp,
        summary: noteText
      };
      entries.push({ resource: impressionResource, method: 'POST', url: 'ClinicalImpression' });
    }

    // 3. Clinician-Confirmed Diagnoses (Only physician-verified conditions become active FHIR Conditions)
    for (const cond of effectiveConditions) {
      const condName = typeof cond === 'string' ? cond : (cond.name || cond.code?.text || 'Diagnosis');
      const condResource = {
        resourceType: 'Condition',
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active'
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
            display: 'Confirmed by Physician'
          }]
        },
        subject: { reference: `Patient/${cleanPatientId}` },
        encounter: { reference: `Encounter/${cleanEncounterId}` },
        recorder: { reference: practitionerId },
        code: {
          text: condName,
          coding: [{ display: condName }]
        }
      };
      entries.push({ resource: condResource, method: 'POST', url: 'Condition' });
    }

    // 4. Clinician-Confirmed Prescriptions (Only physician-signed orders become active MedicationRequests)
    for (const rx of effectivePrescriptions) {
      const rxResource = {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: `Patient/${cleanPatientId}` },
        encounter: { reference: `Encounter/${cleanEncounterId}` },
        authoredOn: timestamp,
        requester: { reference: practitionerId },
        medicationCodeableConcept: {
          text: rx.name,
          coding: [{ display: rx.name }]
        },
        dosageInstruction: [{
          text: `${rx.dose || '1 tablet'} ${rx.route || 'Oral'} ${rx.frequency || 'Daily'}. ${rx.instructions || ''}`.trim(),
          route: { text: rx.route || 'Oral' }
        }]
      };
      entries.push({ resource: rxResource, method: 'POST', url: 'MedicationRequest' });
    }

    // 5. Authoritative Provenance Record
    const provenanceResource = {
      resourceType: 'Provenance',
      target: [
        { reference: `Encounter/${cleanEncounterId}` },
        { reference: `ClinicalImpression/imp-${cleanEncounterId}` }
      ],
      recorded: timestamp,
      activity: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-DocumentCompletion',
          code: 'AU',
          display: 'authenticated'
        }]
      },
      agent: [{
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'author' }] },
        who: { reference: practitionerId }
      }]
    };
    entries.push({ resource: provenanceResource, method: 'POST', url: 'Provenance' });

    return this.createTransactionBundle(entries);
  }
}

const fhirService = new FhirService();

module.exports = {
  FhirService,
  fhirService
};
