/**
 * Proton Desktop Offline FHIR Store
 * Manages local, resilient, disk-persisted FHIR R4 resources in the Electron userData partition.
 * Invariant: Works with zero active internet or remote server connectivity.
 */

const fs = require('fs');
const path = require('path');

class LocalFhirStore {
  constructor(storageDir) {
    this.storageDir = storageDir;
    this.filePath = path.join(storageDir, 'proton-fhir-store.json');
    this.audioDir = path.join(storageDir, 'consultation-recordings');
    this.store = new Map();
    this._init();
  }

  _init() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      if (!fs.existsSync(this.audioDir)) {
        fs.mkdirSync(this.audioDir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        for (const [key, val] of Object.entries(parsed)) {
          this.store.set(key, val);
        }
      } else {
        this._seedInitialData();
        this._save();
      }
    } catch (e) {
      console.warn('[LocalFhirStore] Failed to load local storage, starting clean:', e.message);
      this._seedInitialData();
    }
  }

  _seedInitialData() {
    // Seed Eleanor Vance (pat-1)
    const pat1 = {
      resourceType: 'Patient',
      id: 'pat-1',
      name: [{ use: 'official', family: 'Vance', given: ['Eleanor'] }],
      gender: 'female',
      birthDate: '1972-04-18',
      telecom: [{ system: 'phone', value: '+1 (555) 234-8901' }]
    };
    this.store.set('Patient/pat-1', pat1);

    // Prior episode from 11 months ago
    const cond1 = {
      resourceType: 'Condition',
      id: 'cond-eleanor-prior',
      subject: { reference: 'Patient/pat-1', display: 'Eleanor Vance' },
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'resolved' }] },
      code: { text: 'Acute pharyngitis', coding: [{ system: 'ICD-10', code: 'J02.9', display: 'Acute pharyngitis, unspecified' }] },
      recordedDate: '2025-11-03'
    };
    this.store.set('Condition/cond-eleanor-prior', cond1);

    // Prior medication
    const med1 = {
      resourceType: 'MedicationStatement',
      id: 'med-eleanor-prior',
      subject: { reference: 'Patient/pat-1', display: 'Eleanor Vance' },
      status: 'completed',
      medicationCodeableConcept: { text: 'Amoxicillin 500mg capsule' },
      effectivePeriod: { start: '2025-11-03', end: '2025-11-07' }
    };
    this.store.set('MedicationStatement/med-eleanor-prior', med1);

    // HbA1c observations showing temporal escalation (7.1% -> 8.2%)
    const obs1 = {
      resourceType: 'Observation',
      id: 'obs-eleanor-hba1c-1',
      subject: { reference: 'Patient/pat-1' },
      code: { text: 'Hemoglobin A1c', coding: [{ system: 'LOINC', code: '4548-4' }] },
      valueQuantity: { value: 7.1, unit: '%' },
      effectiveDateTime: '2025-05-10'
    };
    const obs2 = {
      resourceType: 'Observation',
      id: 'obs-eleanor-hba1c-2',
      subject: { reference: 'Patient/pat-1' },
      code: { text: 'Hemoglobin A1c', coding: [{ system: 'LOINC', code: '4548-4' }] },
      valueQuantity: { value: 8.2, unit: '%' },
      effectiveDateTime: '2026-10-15'
    };
    this.store.set('Observation/obs-eleanor-hba1c-1', obs1);
    this.store.set('Observation/obs-eleanor-hba1c-2', obs2);

    // Known allergy to penicillin
    const alg1 = {
      resourceType: 'AllergyIntolerance',
      id: 'alg-eleanor-penicillin',
      patient: { reference: 'Patient/pat-1', display: 'Eleanor Vance' },
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] },
      code: { text: 'Penicillin' }
    };
    this.store.set('AllergyIntolerance/alg-eleanor-penicillin', alg1);
  }

  _save() {
    try {
      const obj = {};
      for (const [k, v] of this.store.entries()) {
        obj[k] = v;
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      console.error('[LocalFhirStore] Failed to write local store:', e.message);
    }
  }

  storeResource(resource) {
    if (!resource || !resource.resourceType) {
      throw new Error('Resource must have a valid resourceType');
    }
    const id = resource.id || `${resource.resourceType.toLowerCase()}-${Date.now().toString(36)}`;
    resource.id = id;
    const key = `${resource.resourceType}/${id}`;
    this.store.set(key, resource);
    this._save();
    return resource;
  }

  readResource(resourceType, id) {
    const key = `${resourceType}/${id}`;
    return this.store.get(key) || null;
  }

  searchResources(resourceType, params = {}) {
    const results = [];
    for (const [key, val] of this.store.entries()) {
      if (!key.startsWith(`${resourceType}/`)) continue;

      let match = true;
      if (params.patient) {
        const cleanPat = String(params.patient).replace(/^Patient\//, '');
        const subjRef = val.subject?.reference || val.patient?.reference || '';
        if (!subjRef.includes(cleanPat)) {
          match = false;
        }
      }
      if (match && params.status) {
        if (val.status !== params.status && val.clinicalStatus?.coding?.[0]?.code !== params.status) {
          match = false;
        }
      }

      if (match) {
        results.push(val);
      }
    }
    return results;
  }

  executeBatch(bundle) {
    if (!bundle || bundle.resourceType !== 'Bundle') {
      throw new Error('Input must be a FHIR Bundle');
    }

    const responseBundle = {
      resourceType: 'Bundle',
      type: 'transaction-response',
      id: `resp-${Date.now()}`,
      entry: []
    };

    const staged = [];
    for (const entry of (bundle.entry || [])) {
      const res = entry.resource;
      if (!res || !res.resourceType) {
        throw new Error('Invalid bundle entry: missing resourceType');
      }
      staged.push(res);
    }

    // Atomic commit
    for (const res of staged) {
      const committed = this.storeResource(res);
      responseBundle.entry.push({
        response: {
          status: '201 Created',
          location: `${committed.resourceType}/${committed.id}`
        },
        resource: committed
      });
    }

    return responseBundle;
  }

  saveConsultationAudio(encounterId, base64OrBuffer) {
    const cleanId = String(encounterId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const audioPath = path.join(this.audioDir, `${cleanId}.webm`);
    const buf = Buffer.isBuffer(base64OrBuffer) ? base64OrBuffer : Buffer.from(base64OrBuffer, 'base64');
    fs.writeFileSync(audioPath, buf);
    return {
      success: true,
      audioPath,
      bytes: buf.length,
      binaryUri: `file://${audioPath}`
    };
  }

  getConsultationAudio(encounterId) {
    const cleanId = String(encounterId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const audioPath = path.join(this.audioDir, `${cleanId}.webm`);
    if (fs.existsSync(audioPath)) {
      return {
        exists: true,
        audioPath,
        binaryUri: `file://${audioPath}`
      };
    }
    return { exists: false };
  }
}

module.exports = {
  LocalFhirStore
};
