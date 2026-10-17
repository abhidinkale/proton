/**
 * Proton Clinician Clinical Confirmation Service
 *
 * Enforces the clinician-in-the-loop clinical authority boundary across all clinical modalities:
 * 1. AI output is strictly decision support. Zero autonomous active Conditions or MedicationRequests.
 * 2. Only authenticated physicians/practitioners can confirm, reject, or modify AI clinical drafts.
 * 3. Original AI outputs remain immutable.
 * 4. Clinician modifications are separately recorded with full FHIR Provenance.
 * 5. Atomic FHIR persistence commits active Condition or MedicationRequest ONLY upon explicit clinician confirmation.
 * 6. Cryptographically audits all clinician decisions with zero secret leakage.
 */

const crypto = require('crypto');
const { fhirService } = require('../fhir/fhirService');
const { safetyService } = require('../safety/safetyService');
const { auditService } = require('../audit/auditService');

class ClinicianConfirmationError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'ClinicianConfirmationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class ClinicianConfirmationService {
  constructor(options = {}) {
    this.fhir = options.fhirService || fhirService;
    this.safety = options.safetyService || safetyService;
    this.audit = options.auditService || auditService;
    this._confirmationRegistry = new Map();
  }

  /**
   * Validates actor authorization for clinical confirmation actions.
   */
  _validateClinicianActor(actor, operation) {
    if (!actor || typeof actor !== 'object') {
      throw new ClinicianConfirmationError('UNAUTHENTICATED', 'Authenticated clinician actor required.', 401);
    }

    const role = actor.actorRole || actor.role || '';
    if (role !== 'physician' && role !== 'practitioner') {
      throw new ClinicianConfirmationError(
        'CLINICIAN_AUTHORIZATION_REQUIRED',
        `Forbidden: Role '${role}' cannot authorize ${operation}. Attending physician authorization required.`,
        403
      );
    }
  }

  /**
   * Clinician confirmation workflow for an AI-suggested diagnosis.
   */
  async confirmDiagnosis({
    encounterId,
    patientId,
    actor,
    action,
    diagnosis,
    modification = null,
    notes = null,
    aiDraftId = null
  }) {
    this._validateClinicianActor(actor, 'diagnosis confirmation');

    if (!patientId) {
      throw new ClinicianConfirmationError('PATIENT_ID_REQUIRED', 'patientId is required.', 400);
    }

    const cleanPatientId = String(patientId).replace(/^Patient\//, '').trim();
    const cleanAction = String(action || '').toUpperCase();
    if (!['ACCEPT', 'REJECT', 'MODIFY'].includes(cleanAction)) {
      throw new ClinicianConfirmationError('INVALID_ACTION', "action must be 'ACCEPT', 'REJECT', or 'MODIFY'.", 400);
    }

    if (cleanAction === 'MODIFY' && (!modification || !String(modification).trim())) {
      throw new ClinicianConfirmationError('MODIFICATION_REQUIRED', 'modification text is required for MODIFY action.', 400);
    }

    const tenantId = actor.tenantId || 'org-default';

    // Verify patient existence and tenant isolation
    const patientContext = await this.fhir.getPatientClinicalContext(cleanPatientId, tenantId);

    const conditionDisplay = cleanAction === 'MODIFY'
      ? String(modification).trim()
      : (typeof diagnosis === 'object' ? (diagnosis.display || diagnosis.name || diagnosis.condition) : String(diagnosis || ''));

    if (!conditionDisplay) {
      throw new ClinicianConfirmationError('DIAGNOSIS_REQUIRED', 'Valid diagnosis details required.', 400);
    }

    // Idempotency: Prevent duplicate Condition resources on network retry or double-click
    const dedupKey = `${tenantId}:${cleanPatientId}:${encounterId || 'encounter-global'}:diag:${conditionDisplay}:${cleanAction}`;
    if (this._confirmationRegistry.has(dedupKey)) {
      const existing = this._confirmationRegistry.get(dedupKey);
      return {
        ...existing,
        isDuplicate: true,
        status: 'IDEMPOTENT_CONFIRMATION'
      };
    }

    let fhirCondition = null;
    let fhirProvenance = null;

    if (cleanAction === 'ACCEPT' || cleanAction === 'MODIFY') {
      const conditionId = `cond-conf-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      fhirCondition = {
        resourceType: 'Condition',
        id: conditionId,
        clinicalStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: 'active',
            display: 'Active'
          }]
        },
        verificationStatus: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
            display: 'Confirmed'
          }]
        },
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'encounter-diagnosis',
            display: 'Encounter Diagnosis'
          }]
        }],
        code: {
          text: conditionDisplay,
          coding: diagnosis?.code ? [{
            system: 'http://snomed.info/sct',
            code: String(diagnosis.code),
            display: conditionDisplay
          }] : undefined
        },
        subject: { reference: `Patient/${cleanPatientId}` },
        encounter: encounterId ? { reference: `Encounter/${String(encounterId).replace(/^Encounter\//, '')}` } : undefined,
        recordedDate: new Date().toISOString(),
        asserter: {
          reference: `Practitioner/${actor.actorId || 'physician'}`,
          display: actor.actorName || 'Attending Physician'
        },
        note: notes ? [{ text: notes }] : undefined
      };

      const provId = `prov-diag-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      fhirProvenance = {
        resourceType: 'Provenance',
        id: provId,
        target: [{ reference: `Condition/${conditionId}` }],
        recorded: new Date().toISOString(),
        activity: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
            code: cleanAction === 'MODIFY' ? 'REVISE' : 'CREATE',
            display: cleanAction === 'MODIFY' ? 'Revise Diagnosis' : 'Confirm Diagnosis'
          }]
        },
        agent: [{
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
              code: 'attester',
              display: 'Attester'
            }]
          },
          who: {
            reference: `Practitioner/${actor.actorId || 'physician'}`,
            display: actor.actorName || 'Attending Physician'
          }
        }]
      };

      if (aiDraftId) {
        fhirProvenance.entity = [{
          role: 'derivation',
          what: { reference: `AIAnalysis/${aiDraftId}` }
        }];
      }

      // Atomic persistence
      const bundle = this.fhir.createTransactionBundle([
        { resource: fhirCondition, method: 'PUT', url: `Condition/${conditionId}` },
        { resource: fhirProvenance, method: 'POST', url: 'Provenance' }
      ]);
      await this.fhir.executeTransaction(bundle);
    }

    // Audit record
    const auditRecord = this.audit.recordPipelineStage({
      stage: 'CLINICIAN_DIAGNOSIS_REVIEWED',
      patientId: cleanPatientId,
      actorId: actor.actorId || 'physician',
      actorRole: actor.actorRole || 'physician',
      actorName: actor.actorName || 'Attending Physician',
      status: 'SUCCESS',
      summary: `Clinician ${cleanAction} diagnosis '${conditionDisplay}'. Active Condition created: ${cleanAction !== 'REJECT'}`,
      resultingState: cleanAction === 'REJECT' ? 'DIAGNOSIS_REJECTED' : 'DIAGNOSIS_CONFIRMED',
      tenantId
    });

    const responsePayload = {
      success: true,
      action: cleanAction,
      patientId: cleanPatientId,
      tenantId,
      conditionDisplay,
      activeCondition: fhirCondition,
      provenance: fhirProvenance,
      auditProvenance: {
        auditId: auditRecord.eventId || auditRecord.id,
        currentHash: auditRecord.currentHash
      }
    };

    this._confirmationRegistry.set(dedupKey, responsePayload);
    return responsePayload;
  }

  /**
   * Clinician confirmation workflow for an AI-suggested medication order.
   */
  async confirmMedication({
    encounterId,
    patientId,
    actor,
    action,
    medication,
    modification = null,
    notes = null,
    aiDraftId = null,
    physicianDirective = null
  }) {
    this._validateClinicianActor(actor, 'medication order confirmation');

    if (!patientId) {
      throw new ClinicianConfirmationError('PATIENT_ID_REQUIRED', 'patientId is required.', 400);
    }

    const cleanPatientId = String(patientId).replace(/^Patient\//, '').trim();
    const cleanAction = String(action || '').toUpperCase();
    if (!['CONFIRM', 'ACCEPT', 'REJECT', 'MODIFY'].includes(cleanAction)) {
      throw new ClinicianConfirmationError('INVALID_ACTION', "action must be 'CONFIRM', 'ACCEPT', 'REJECT', or 'MODIFY'.", 400);
    }

    const isApprove = cleanAction === 'CONFIRM' || cleanAction === 'ACCEPT' || cleanAction === 'MODIFY';
    const tenantId = actor.tenantId || 'org-default';

    // Retrieve patient clinical context for safety check
    const patientContext = await this.fhir.getPatientClinicalContext(cleanPatientId, tenantId);

    const medName = cleanAction === 'MODIFY' && modification?.name
      ? modification.name
      : (typeof medication === 'object' ? (medication.name || medication.drugName) : String(medication || ''));

    const medDose = cleanAction === 'MODIFY' && modification?.dose ? modification.dose : medication?.dose || '';
    const medFreq = cleanAction === 'MODIFY' && modification?.frequency ? modification.frequency : medication?.frequency || 'daily';
    const medRoute = cleanAction === 'MODIFY' && modification?.route ? modification.route : medication?.route || 'oral';

    if (!medName) {
      throw new ClinicianConfirmationError('MEDICATION_NAME_REQUIRED', 'medication name is required.', 400);
    }

    // Idempotency: Prevent duplicate MedicationRequest resources on network retry or double-click
    const dedupKey = `${tenantId}:${cleanPatientId}:${encounterId || 'encounter-global'}:med:${medName}:${cleanAction}`;
    if (this._confirmationRegistry.has(dedupKey)) {
      const existing = this._confirmationRegistry.get(dedupKey);
      return {
        ...existing,
        isDuplicate: true,
        status: 'IDEMPOTENT_CONFIRMATION'
      };
    }

    let fhirMedicationRequest = null;
    let fhirProvenance = null;

    if (isApprove) {
      // Deterministic Safety Check BEFORE persistence
      const safetyReport = this.safety.evaluatePrescriptionSafety({
        prescriptions: [{
          name: medName,
          dosage: medDose,
          route: medRoute,
          frequency: medFreq
        }],
        allergies: patientContext.allergies || [],
        activeMedications: patientContext.medications || []
      });

      if (safetyReport.hardStop && !physicianDirective) {
        throw new ClinicianConfirmationError(
          'CONTRAINDICATION_HARD_STOP',
          `Cannot confirm medication '${medName}': violates critical safety contraindication. Physician directive required.`,
          422,
          { safetyReport }
        );
      }

      const medReqId = `medrx-conf-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      fhirMedicationRequest = {
        resourceType: 'MedicationRequest',
        id: medReqId,
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          text: `${medName} ${medDose}`.trim(),
          coding: [{
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            display: medName
          }]
        },
        subject: { reference: `Patient/${cleanPatientId}` },
        encounter: encounterId ? { reference: `Encounter/${String(encounterId).replace(/^Encounter\//, '')}` } : undefined,
        authoredOn: new Date().toISOString(),
        requester: {
          reference: `Practitioner/${actor.actorId || 'physician'}`,
          display: actor.actorName || 'Attending Physician'
        },
        dosageInstruction: [{
          text: `${medDose} ${medRoute} ${medFreq}`.trim(),
          route: { text: medRoute }
        }],
        note: notes ? [{ text: notes }] : undefined
      };

      const provId = `prov-medrx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      fhirProvenance = {
        resourceType: 'Provenance',
        id: provId,
        target: [{ reference: `MedicationRequest/${medReqId}` }],
        recorded: new Date().toISOString(),
        activity: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
            code: cleanAction === 'MODIFY' ? 'REVISE' : 'CREATE',
            display: cleanAction === 'MODIFY' ? 'Revise Prescription' : 'Order Prescription'
          }]
        },
        agent: [{
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
              code: 'attester',
              display: 'Attester'
            }]
          },
          who: {
            reference: `Practitioner/${actor.actorId || 'physician'}`,
            display: actor.actorName || 'Attending Physician'
          }
        }]
      };

      const bundle = this.fhir.createTransactionBundle([
        { resource: fhirMedicationRequest, method: 'PUT', url: `MedicationRequest/${medReqId}` },
        { resource: fhirProvenance, method: 'POST', url: 'Provenance' }
      ]);
      await this.fhir.executeTransaction(bundle);
    }

    // Audit record
    const auditRecord = this.audit.recordPipelineStage({
      stage: 'CLINICIAN_MEDICATION_REVIEWED',
      patientId: cleanPatientId,
      actorId: actor.actorId || 'physician',
      actorRole: actor.actorRole || 'physician',
      actorName: actor.actorName || 'Attending Physician',
      status: 'SUCCESS',
      summary: `Clinician ${cleanAction} medication '${medName}'. Active MedicationRequest created: ${isApprove}`,
      resultingState: isApprove ? 'MEDICATION_ORDERED' : 'MEDICATION_REJECTED',
      tenantId
    });

    const responsePayload = {
      success: true,
      action: cleanAction,
      patientId: cleanPatientId,
      tenantId,
      medicationName: medName,
      activeMedicationRequest: fhirMedicationRequest,
      provenance: fhirProvenance,
      auditProvenance: {
        auditId: auditRecord.eventId || auditRecord.id,
        currentHash: auditRecord.currentHash
      }
    };

    this._confirmationRegistry.set(dedupKey, responsePayload);
    return responsePayload;
  }
}

const clinicianConfirmationService = new ClinicianConfirmationService();

module.exports = {
  ClinicianConfirmationService,
  clinicianConfirmationService,
  ClinicianConfirmationError
};
