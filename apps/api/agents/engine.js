/**
 * Proton Operations OS — Agent Engine V2 & Task Orchestrator (Phase 1.4)
 * 
 * Implements:
 * - Durable Operational Storage (Task, Audit, Agent Runs, Idempotency Repositories)
 * - Scoped Clinical Brain Bridge with Minimum-Necessary Context & Real Provenance
 * - Durable Intent + FHIR Reconciliation (Non-silent failures, idempotent retries, zero 2PC pretense)
 * - Abstract Communication Gateway with Delivery State Machine
 * - Zero Chain-of-Thought Storage Invariant
 * - Tamper-Evident Append-Only Audit Trail (SHA-256 Hash Chained)
 * - Multi-Tenant Scoping (tenantId)
 */

const { processInboundTriage } = require('./triageAgent');
const { evaluateFollowUpPlan } = require('./schedulingAgent');
const { verifyRefillProposal, compileReferralPacket } = require('./refillReferralAgent');
const { evaluateCareGapsForPatient } = require('./careGapRules');
const { resolvePatientIdentity } = require('./identityResolver');
const { globalIdempotencyStore, IdempotencyConflictError } = require('./idempotency');
const { REGISTERED_TOOLS, executeInternalTool, ToolExecutionError } = require('./tools');
const { getProvider } = require('../providers/factory');
const { getScopedPatientContext } = require('./brainBridge');

const taskRepository = require('../storage/taskRepository');
const auditRepository = require('../storage/auditRepository');
const agentRunRepository = require('../storage/agentRunRepository');
const communicationGateway = require('../storage/communicationGateway');

class FhirPersistenceError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = 'FhirPersistenceError';
    this.statusCode = statusCode;
    this.code = 'FHIR_PERSISTENCE_FAILURE';
  }
}

/**
 * Initializes the durable synthetic cohort if storage is empty.
 * Preserves modifications across server restarts.
 */
function initializeSyntheticCohort(tenantId = 'org-default') {
  const existingTasks = taskRepository.listTasks({ tenantId });
  if (existingTasks.length > 0) {
    return; // Already initialized in durable database
  }

  const now = new Date();

  // 1. Scenario 1: Eleanor Vance — Inbound Triage (Elevated BP + Lightheadedness)
  const eleanorTriage = {
    id: 'task-ev-triage-01',
    category: 'triage',
    priority: 'urgent',
    status: 'requested',
    patientId: 'eleanor-vance',
    patientName: 'Eleanor Vance',
    patientAgeSex: '68F',
    title: 'Elevated Blood Pressure & Lightheadedness',
    summary: 'Reported home BP 152/94 mmHg with orthostatic lightheadedness. Inquiring about stopping Lisinopril.',
    sourceEvent: 'Portal Message',
    createdAt: new Date(now.getTime() - 28 * 60 * 1000).toISOString(),
    triageDetails: {
      id: 'tri-ev-01',
      patientId: 'eleanor-vance',
      patientName: 'Eleanor Vance',
      patientAgeSex: '68F',
      channel: 'portal',
      inboundMessage: 'Hello doctor, my home blood pressure was 152/94 this morning, and I felt slightly dizzy when I stood up. Should I stop taking my Lisinopril?',
      receivedAt: new Date(now.getTime() - 28 * 60 * 1000).toISOString(),
      priority: 'urgent',
      status: 'requested',
      communicationCategory: 'clinical',
      autonomousDispatchAllowed: false,
      risk: {
        riskLevel: 'HIGH',
        emergencyRedFlag: false,
        redFlagCategory: 'none',
        clinicalGatingReason: 'Symptomatic elevated blood pressure with lightheadedness reported. Physician review required.',
        deterministicViolations: ['HIGH_ACUITY_SYMPTOM_REPORTED']
      },
      aiDraftResponse: `Hello Eleanor, Dr. Lin's care team received your message. Please do not abruptly discontinue your Lisinopril without medical evaluation. Feeling lightheaded when standing can occur with blood pressure fluctuations. Please sit down, drink a glass of water, and repeat your blood pressure seated after resting for 2 hours. Dr. Lin is reviewing your chart. If your dizziness worsens, or you experience chest pain, shortness of breath, or fainting, please seek urgent medical attention immediately.`,
      relevantLongitudinalContext: [
        'Active Essential Hypertension (Baseline BP 146/88 mmHg)',
        'Confirmed Regimen: Lisinopril 20mg oral daily',
        'Recent Consultation finding: HbA1c escalated to 8.2% (+1.1%)',
        'Severe Documented Allergy: Penicillin (Beta-Lactam Cross-Reactivity Active)'
      ]
    }
  };

  // 2. Scenario 2: Eleanor Vance — Follow-Up & HbA1c Care Gap (Scheduling Agent)
  const eleanorScheduling = {
    id: 'task-ev-sched-01',
    category: 'scheduling',
    priority: 'routine',
    status: 'ready',
    patientId: 'eleanor-vance',
    patientName: 'Eleanor Vance',
    patientAgeSex: '68F',
    title: '3-Month Diabetic Follow-Up & Repeat HbA1c',
    summary: 'Discharge plan: 3-month follow-up required with repeat HbA1c to assess glycemic titration.',
    sourceEvent: 'Consultation Plan Extraction',
    createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    schedulingDetails: {
      id: 'sched-ev-01',
      patientId: 'eleanor-vance',
      patientName: 'Eleanor Vance',
      patientAgeSex: '68F',
      triggerType: 'consultation_follow_up',
      title: '3-Month Endocrine Follow-up',
      clinicalReason: 'Type 2 Diabetes Mellitus with HbA1c escalation (7.1% → 8.2%) and hypertension monitoring',
      targetTimeframe: '3 months',
      targetDateRange: {
        start: new Date(now.getTime() + 75 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
      },
      priority: 'routine',
      status: 'ready',
      appointmentStatus: 'proposed',
      careGapDetails: {
        testName: 'Glycated Hemoglobin (HbA1c)',
        lastDate: '2026-08-15',
        overdueDays: 0
      },
      proposedSlot: {
        slotId: 'slot-ev-nov18-0930',
        start: '2026-11-18T09:30:00Z',
        end: '2026-11-18T10:00:00Z',
        practitionerName: 'Dr. Sarah Lin, MD',
        location: 'Clinic Suite 400'
      },
      outreachDraft: `Hello Eleanor, following your consultation with Dr. Lin, we would like to schedule your 3-month follow-up visit and repeat HbA1c lab order. We have reserved an opening on Wednesday, November 18 at 9:30 AM with Dr. Lin. Please reply to confirm this time.`
    }
  };

  // 3. Scenario 3: Arthur Pendelton — DOAC Refill with Renal Drift (Refill Agent)
  const arthurRefill = {
    id: 'task-ap-refill-01',
    category: 'refill',
    priority: 'urgent',
    status: 'requested',
    patientId: 'arthur-pendelton',
    patientName: 'Arthur Pendelton',
    patientAgeSex: '74M',
    title: 'Apixaban (Eliquis) 5mg Refill Request • Renal Drift Advisory',
    summary: 'Electronic pharmacy request: Apixaban 5mg BID (90 days). eGFR declined 62 → 48 mL/min.',
    sourceEvent: 'Surescripts / Pharmacy Inbound',
    createdAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    refillDetails: {
      id: 'refill-ap-01',
      patientId: 'arthur-pendelton',
      patientName: 'Arthur Pendelton',
      patientAgeSex: '74M',
      medicationName: 'Apixaban (Eliquis)',
      requestedDose: '5mg',
      requestedFrequency: 'BID',
      daysSupply: 90,
      pharmacyName: 'CVS Pharmacy #4821',
      priorMedicationRequestId: 'mr-ap-eliquis-01',
      lastPrescribedDate: '2026-07-10',
      receivedAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      status: 'requested',
      safetyReport: {
        canApprove: true,
        allergyConflict: false,
        duplicateTherapy: false,
        renalDriftWarning: 'Renal Function Advisory: eGFR has drifted downward from 62 to 48 mL/min (-22.5%).',
        warnings: [
          'eGFR Downward Drift: 62 → 48 mL/min (< 50 mL/min guideline threshold).',
          'Age 74 with Creatinine 1.6 mg/dL: Review criteria for 2.5mg BID dose reduction.',
          'NSAID Class Hypersensitivity documented (confirmed safe with DOAC).'
        ],
        blockers: []
      },
      clinicalContext: {
        indication: 'Stroke Prevention in Nonvalvular Atrial Fibrillation (CHA2DS2-VASc = 3)',
        relevantLabSummary: 'Serum Creatinine: 1.6 mg/dL • eGFR: 48 mL/min (Baseline: 62 mL/min)',
        latestCreatinine: '1.6 mg/dL',
        latestEgfr: '48 mL/min',
        egfrBaseline: '62 mL/min'
      },
      physicianDecisionRequired: true,
      physicianAction: null
    }
  };

  // 4. Scenario 4: Arthur Pendelton — Nephrology Referral Loop (Referral Agent)
  const arthurReferral = {
    id: 'task-ap-referral-01',
    category: 'referral',
    priority: 'urgent',
    status: 'ready',
    patientId: 'arthur-pendelton',
    patientName: 'Arthur Pendelton',
    patientAgeSex: '74M',
    title: 'Nephrology Specialty Consultation',
    summary: 'Clinical consultation order: progressive renal decline in setting of DOAC anticoagulation.',
    sourceEvent: 'Consultation Plan Order',
    createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    referralDetails: {
      id: 'ref-ap-neph-01',
      patientId: 'arthur-pendelton',
      patientName: 'Arthur Pendelton',
      patientAgeSex: '74M',
      specialty: 'Nephrology',
      specialtyCode: '394589003',
      targetProviderOrClinic: 'Regional Nephrology Associates (Dr. M. Patel)',
      clinicalIndication: 'Evaluation of progressive eGFR decline (62 → 48 mL/min) and renal management on chronic DOAC',
      referralSummaryPacket: {
        hpiSummary: '74-year-old male with persistent nonvalvular atrial fibrillation and CKD Stage 3a exhibiting downward renal function drift over 6 months.',
        relevantLabs: [
          { name: 'Serum Creatinine', value: '1.6 mg/dL', date: '2026-09-28' },
          { name: 'eGFR (CKD-EPI)', value: '48 mL/min/1.73m²', date: '2026-09-28' },
          { name: 'Blood Urea Nitrogen (BUN)', value: '26 mg/dL', date: '2026-09-28' }
        ],
        currentMedications: [
          'Apixaban (Eliquis) 5mg BID',
          'Metoprolol Succinate 50mg daily'
        ],
        documentedAllergies: [
          'NSAID Class Hypersensitivity (Bronchospasm)'
        ],
        vitalsSummary: 'BP 138/84 mmHg, HR 78 bpm (irregularly irregular), BMI 26.8'
      },
      status: 'draft_prepared',
      priority: 'urgent',
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()
    }
  };

  // 5. Scenario 5: Administrative Inquiry (Hours & Logistics — Autonomous low-risk dispatch allowed)
  const adminInquiry = {
    id: 'task-admin-hours-01',
    category: 'triage',
    priority: 'routine',
    status: 'ready',
    patientId: 'arthur-pendelton',
    patientName: 'Arthur Pendelton',
    patientAgeSex: '74M',
    title: 'Clinic Hours & Parking Validation Inquiry',
    summary: 'Patient inquiring about Friday lab hours and visitor parking validation.',
    sourceEvent: 'Portal Message',
    createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
    triageDetails: {
      id: 'tri-admin-01',
      patientId: 'arthur-pendelton',
      patientName: 'Arthur Pendelton',
      patientAgeSex: '74M',
      channel: 'portal',
      inboundMessage: 'Hello, what time does the outpatient lab open on Friday, and do you validate parking?',
      receivedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      priority: 'routine',
      status: 'ready',
      communicationCategory: 'administrative',
      autonomousDispatchAllowed: true,
      risk: {
        riskLevel: 'LOW',
        emergencyRedFlag: false,
        redFlagCategory: 'none',
        clinicalGatingReason: 'Purely administrative inquiry. Low-risk autonomous dispatch policy permitted.',
        deterministicViolations: []
      },
      aiDraftResponse: 'Hello Arthur, our outpatient lab opens at 7:30 AM on Friday. We provide validated parking tickets for up to 2 hours at the main clinic reception desk.',
      relevantLongitudinalContext: []
    }
  };

  const tasksToSeed = [eleanorTriage, arthurRefill, eleanorScheduling, arthurReferral, adminInquiry];
  for (const t of tasksToSeed) {
    taskRepository.saveTask(t, tenantId);
  }

  // Seed initial audit trail
  auditRepository.recordAuditEvent({
    id: 'aud-seed-01',
    tenantId,
    timestamp: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    action: 'refill_safety_verified',
    actorId: 'agent-careflow',
    actorRole: 'agent',
    actorName: 'Proton CareFlow Agent',
    patientId: 'arthur-pendelton',
    summary: 'Refill verification executed for Apixaban 5mg. Renal advisory flag raised (eGFR 48 mL/min).'
  });

  auditRepository.recordAuditEvent({
    id: 'aud-seed-02',
    tenantId,
    timestamp: new Date(now.getTime() - 28 * 60 * 1000).toISOString(),
    action: 'agent_triage_evaluated',
    actorId: 'agent-connect',
    actorRole: 'agent',
    actorName: 'Proton Connect Agent',
    patientId: 'eleanor-vance',
    summary: 'Inbound message triaged. Non-emergency symptomatic BP escalation flagged for physician review.'
  });
}

// Ensure cohort is seeded on boot
initializeSyntheticCohort();

function getTasks({ status, category, patientId, tenantId = 'org-default' } = {}) {
  return taskRepository.listTasks({ status, category, patientId, tenantId });
}

function getSummary(tenantId = 'org-default') {
  return taskRepository.getSummary(tenantId);
}

// In-memory FHIR Idempotency Store: maps `${system}|${value}` -> persisted resource
const fhirIdempotencyStore = new Map();
const inflightFhirWrites = new Map();
const inflightTaskApprovals = new Map();

function clearFhirIdempotencyStore() {
  fhirIdempotencyStore.clear();
  inflightFhirWrites.clear();
  inflightTaskApprovals.clear();
}

/**
 * Persists a FHIR resource in accordance with PROTON_FHIR_PERSISTENCE_MODE.
 * Enforces immutable idempotency identifier (https://proton.health/ops/task|<immutable-op-id>)
 * and prevents duplicate resource creation across sequential or concurrent retries.
 */
async function persistFhirResource(resource) {
  const persistenceMode = process.env.PROTON_FHIR_PERSISTENCE_MODE || 'in_memory';
  const now = new Date().toISOString();

  // 1. Resolve immutable idempotency identifier
  const taskIdentifier = resource.identifier?.find(i => i.system === 'https://proton.health/ops/task');
  const idempotencyKey = taskIdentifier
    ? `${taskIdentifier.system}|${taskIdentifier.value}`
    : (resource.id ? `${resource.resourceType}|${resource.id}` : null);

  // 2. Return existing resource if already persisted (Idempotency Replay Guard)
  if (idempotencyKey && fhirIdempotencyStore.has(idempotencyKey)) {
    const existing = fhirIdempotencyStore.get(idempotencyKey);
    return {
      persistedResource: existing,
      persistenceMeta: {
        mode: persistenceMode === 'medplum' ? 'medplum_live' : 'in_memory_stub',
        livePersisted: persistenceMode === 'medplum',
        isReplay: true,
        idempotencyKey,
        endpoint: persistenceMode === 'medplum'
          ? (process.env.MEDPLUM_BASE_URL || 'http://localhost:8103/fhir/R4')
          : 'in-memory://synthetic-fhir-store',
        persistedAt: existing.meta?.lastUpdated || now
      }
    };
  }

  // 3. Concurrency Lock: Await in-flight write for the same idempotency key
  if (idempotencyKey && inflightFhirWrites.has(idempotencyKey)) {
    return await inflightFhirWrites.get(idempotencyKey);
  }

  const writeOperation = (async () => {
    if (persistenceMode === 'medplum') {
      const medplumUrl = process.env.MEDPLUM_BASE_URL || 'http://localhost:8103/fhir/R4';
      try {
        const headers = {
          'Content-Type': 'application/fhir+json',
          'Authorization': `Bearer ${process.env.MEDPLUM_TOKEN || 'demo-token'}`
        };
        // FHIR Conditional Create: Prevents duplicate resources on concurrent retries in Medplum
        if (taskIdentifier) {
          headers['If-None-Exist'] = `identifier=${taskIdentifier.system}|${taskIdentifier.value}`;
        }

        const response = await fetch(`${medplumUrl}/${resource.resourceType}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(resource)
        });
        if (!response.ok) {
          throw new Error(`Medplum server returned status ${response.status} ${response.statusText}`);
        }
        const persisted = await response.json();
        if (idempotencyKey) {
          fhirIdempotencyStore.set(idempotencyKey, persisted);
        }
        return {
          persistedResource: persisted,
          persistenceMeta: {
            mode: 'medplum_live',
            livePersisted: true,
            isReplay: false,
            idempotencyKey,
            endpoint: medplumUrl,
            persistedAt: now
          }
        };
      } catch (err) {
        throw new FhirPersistenceError(
          `Failed to persist ${resource.resourceType} to Medplum server at ${medplumUrl}: ${err.message}`,
          502
        );
      }
    }

    // Explicit in-memory stub mode (deterministic ID and stored in idempotency map)
    const deterministicId = resource.id || (taskIdentifier ? `${resource.resourceType.toLowerCase()}-${taskIdentifier.value}` : `mock-${resource.resourceType.toLowerCase()}-default`);
    const persistedResource = {
      ...resource,
      id: deterministicId,
      meta: {
        versionId: '1',
        lastUpdated: now,
        tag: [{ system: 'https://proton.health/persistence-mode', code: 'in_memory_stub' }]
      }
    };

    if (idempotencyKey) {
      fhirIdempotencyStore.set(idempotencyKey, persistedResource);
    }

    return {
      persistedResource,
      persistenceMeta: {
        mode: 'in_memory_stub',
        livePersisted: false,
        isReplay: false,
        idempotencyKey,
        endpoint: 'in-memory://synthetic-fhir-store',
        persistedAt: now
      }
    };
  })();

  if (idempotencyKey) {
    inflightFhirWrites.set(idempotencyKey, writeOperation);
  }

  try {
    return await writeOperation;
  } finally {
    if (idempotencyKey) {
      inflightFhirWrites.delete(idempotencyKey);
    }
  }
}

/**
 * Agent 1: Connect — Inbound Patient Triage with Scoped Clinical Brain Grounding
 */
async function handleInboundTriage({
  patientId,
  message,
  channel,
  mrn,
  phone,
  birthDate,
  patientContext,
  idempotencyKey,
  tenantId = 'org-default'
}) {
  const startTime = Date.now();

  // 1. Idempotency Check
  let payloadHash = null;
  if (idempotencyKey) {
    payloadHash = globalIdempotencyStore.computeHash({ patientId, message, channel, mrn, phone, birthDate });
    const cached = await globalIdempotencyStore.get(idempotencyKey, tenantId);
    if (cached) {
      if (cached.payloadHash !== payloadHash) {
        throw new IdempotencyConflictError(
          `Idempotency key '${idempotencyKey}' was previously used with a different request payload.`
        );
      }
      return { ...cached.result, isReplay: true };
    }
  }

  // 2. Patient Identity Resolution
  const identity = resolvePatientIdentity({ patientId, mrn, phone, birthDate });

  // 3. Scoped Clinical Brain Context
  const scopedBrain = getScopedPatientContext(identity.patientId, 'triage');
  const contextForTriage = patientContext || {
    name: identity.patientName,
    ageSex: identity.patientAgeSex,
    conditions: scopedBrain.conditions || [],
    medications: scopedBrain.medications || [],
    allergies: scopedBrain.allergies || []
  };

  // 4. Deterministic Red Flag Screening & Draft Generation
  const provider = getProvider();
  const triageResult = await processInboundTriage({
    patientId: identity.patientId,
    message,
    channel,
    patientContext: contextForTriage,
    provider
  });

  const taskId = `task-${identity.patientId}-triage-${Date.now()}`;
  const isUnassigned = identity.requiresManualResolution;

  const newTask = {
    id: taskId,
    tenantId,
    category: 'triage',
    priority: triageResult.risk.riskLevel === 'CRITICAL' ? 'emergency' : (isUnassigned ? 'urgent' : (triageResult.risk.riskLevel === 'HIGH' ? 'urgent' : 'routine')),
    status: 'requested',
    patientId: identity.patientId,
    patientName: identity.patientName,
    patientAgeSex: identity.patientAgeSex || 'Unknown',
    title: isUnassigned
      ? `UNASSIGNED: Triage Inquiry (${identity.tier})`
      : (triageResult.risk.emergencyRedFlag ? 'CRITICAL: Acute Red Flag Alert' : 'Inbound Patient Query'),
    summary: message.slice(0, 100),
    sourceEvent: channel === 'sms' ? 'SMS Message' : 'Portal Message',
    targetQueue: identity.targetQueue,
    requiresManualResolution: isUnassigned,
    identityResolution: {
      status: identity.status,
      tier: identity.tier,
      confidence: identity.confidence,
      candidateIds: identity.candidateIds || [],
      clinicalWarning: identity.clinicalWarning || null
    },
    createdAt: new Date().toISOString(),
    triageDetails: {
      id: `tri-${Date.now()}`,
      patientId: identity.patientId,
      patientName: identity.patientName,
      patientAgeSex: identity.patientAgeSex || 'Unknown',
      channel: channel || 'portal',
      inboundMessage: message,
      receivedAt: new Date().toISOString(),
      priority: triageResult.risk.riskLevel === 'CRITICAL' ? 'emergency' : 'urgent',
      status: 'requested',
      communicationCategory: triageResult.communicationCategory || 'clinical',
      autonomousDispatchAllowed: triageResult.autonomousDispatchAllowed ?? false,
      risk: triageResult.risk,
      aiDraftResponse: triageResult.aiDraft,
      relevantLongitudinalContext: contextForTriage.conditions || []
    }
  };

  // Save to durable repository
  taskRepository.saveTask(newTask, tenantId);

  // Authoritative Audit Event
  auditRepository.recordAuditEvent({
    tenantId,
    action: isUnassigned ? 'unassigned_patient_queued' : 'agent_triage_evaluated',
    actorId: 'agent-connect',
    actorRole: 'agent',
    actorName: 'Proton Connect Agent',
    patientId: identity.patientId,
    summary: `Inbound triage processed (${triageResult.risk.riskLevel} risk, Identity: ${identity.tier}). AI draft prepared.`
  });

  // Zero-CoT Agent Execution Run
  agentRunRepository.recordAgentRun({
    tenantId,
    taskId,
    agentName: 'Proton Connect Agent',
    modelProvider: provider?.name || 'gemini',
    modelVersion: 'gemini-2.5-flash',
    contextProvenanceIds: Object.keys(scopedBrain.provenanceMap || {}),
    policyChecks: {
      emergencyRedFlag: triageResult.risk.emergencyRedFlag,
      riskLevel: triageResult.risk.riskLevel,
      communicationCategory: triageResult.communicationCategory
    },
    toolCalls: ['screenRedFlags', 'classifyCommunication'],
    structuredOutput: triageResult.aiDraft,
    status: 'success',
    latencyMs: Date.now() - startTime,
    tokensConsumed: 120
  });

  const executionResult = {
    success: true,
    task: newTask,
    triageResult,
    isReplay: false
  };

  if (idempotencyKey) {
    await globalIdempotencyStore.set(idempotencyKey, { payloadHash, result: executionResult }, 86400, tenantId);
  }

  return executionResult;
}

/**
 * Agent 3: CareFlow — Refill Proposal Verification with Scoped Clinical Brain
 */
async function handleRefillVerification({
  patientId,
  patientName,
  patientAge,
  medicationName,
  requestedDose,
  requestedFrequency,
  daysSupply,
  allergies,
  activeMedications,
  latestCreatinine,
  latestEgfr,
  baselineEgfr,
  tenantId = 'org-default'
}) {
  const startTime = Date.now();
  const scopedBrain = getScopedPatientContext(patientId, 'refill');

  const verificationResult = verifyRefillProposal({
    patientId,
    patientName: patientName || scopedBrain.patientName,
    patientAge: patientAge || scopedBrain.patientAge,
    medicationName,
    requestedDose,
    requestedFrequency,
    daysSupply,
    allergies: allergies || scopedBrain.allergies,
    activeMedications: activeMedications || scopedBrain.activeMedications,
    latestCreatinine: latestCreatinine !== undefined ? latestCreatinine : scopedBrain.latestCreatinine,
    latestEgfr: latestEgfr !== undefined ? latestEgfr : scopedBrain.latestEgfr,
    baselineEgfr: baselineEgfr !== undefined ? baselineEgfr : scopedBrain.baselineEgfr
  });

  const taskId = `task-${patientId}-refill-${Date.now()}`;
  const newTask = {
    id: taskId,
    tenantId,
    category: 'refill',
    priority: verificationResult.safetyReport.blockers.length > 0 ? 'emergency' : (verificationResult.safetyReport.renalDriftWarning ? 'urgent' : 'routine'),
    status: 'requested',
    patientId,
    patientName: patientName || scopedBrain.patientName,
    patientAgeSex: `${patientAge || scopedBrain.patientAge || 70}yo`,
    title: `${medicationName} Refill Safety Gate`,
    summary: `Refill verification: ${medicationName} ${requestedDose}. Safety warnings: ${verificationResult.safetyReport.warnings.length}.`,
    sourceEvent: 'Pharmacy Inbound Electronic Request',
    createdAt: new Date().toISOString(),
    refillDetails: {
      ...verificationResult,
      id: `refill-${Date.now()}`
    }
  };

  taskRepository.saveTask(newTask, tenantId);

  auditRepository.recordAuditEvent({
    tenantId,
    action: 'refill_safety_verified',
    actorId: 'agent-careflow',
    actorRole: 'agent',
    actorName: 'Proton CareFlow Agent',
    patientId,
    summary: `Refill safety evaluated for ${medicationName}. Requires independent physician clinical directive.`
  });

  agentRunRepository.recordAgentRun({
    tenantId,
    taskId,
    agentName: 'Proton CareFlow Agent',
    modelProvider: 'deterministic_safety_rules',
    modelVersion: 'v1.4',
    contextProvenanceIds: Object.keys(scopedBrain.provenanceMap || {}),
    policyChecks: {
      antiPrescriptiveBoundaryVerified: true,
      optionsPresented: false,
      renalDriftDetected: !!verificationResult.safetyReport.renalDriftWarning
    },
    toolCalls: ['verifyRefillProposal'],
    structuredOutput: verificationResult.safetyReport,
    status: 'success',
    latencyMs: Date.now() - startTime,
    tokensConsumed: 0
  });

  return {
    success: true,
    task: newTask,
    ...verificationResult
  };
}

/**
 * Agent 2: Scheduler — Consultation Follow-up & Care Gap Evaluation
 */
async function handleFollowUpScheduling({
  patientId,
  patientName,
  consultationPlanText,
  patientAcuity,
  tenantId = 'org-default'
}) {
  const startTime = Date.now();
  const scopedBrain = getScopedPatientContext(patientId, 'scheduling');
  const planToEvaluate = consultationPlanText || scopedBrain.consultationPlanText || 'Follow up in 3 months with repeat labs.';

  const followupResult = evaluateFollowUpPlan({
    patientId,
    patientName: patientName || scopedBrain.patientName,
    consultationPlanText: planToEvaluate,
    patientAcuity
  });

  const taskId = `task-${patientId}-sched-${Date.now()}`;
  const newTask = {
    id: taskId,
    tenantId,
    category: 'scheduling',
    priority: followupResult.priority,
    status: 'ready',
    patientId,
    patientName: patientName || scopedBrain.patientName,
    patientAgeSex: 'Adult',
    title: `${followupResult.targetTimeframe} Follow-up Calendar Hold`,
    summary: `Proposed calendar hold for ${patientName || scopedBrain.patientName} (${followupResult.targetTimeframe}).`,
    sourceEvent: 'Consultation Plan Extraction',
    createdAt: new Date().toISOString(),
    schedulingDetails: followupResult
  };

  taskRepository.saveTask(newTask, tenantId);

  auditRepository.recordAuditEvent({
    tenantId,
    action: 'appointment_proposed',
    actorId: 'agent-scheduler',
    actorRole: 'agent',
    actorName: 'Proton Scheduler Agent',
    patientId,
    summary: `Proposed appointment slot allocated (${followupResult.targetTimeframe}). Awaiting explicit confirmation.`
  });

  agentRunRepository.recordAgentRun({
    tenantId,
    taskId,
    agentName: 'Proton Scheduler Agent',
    modelProvider: 'deterministic_scheduling_rules',
    modelVersion: 'v1.4',
    contextProvenanceIds: Object.keys(scopedBrain.provenanceMap || {}),
    policyChecks: {
      appointmentStatusStrictlyProposed: true,
      autonomousBookingBlocked: true
    },
    toolCalls: ['evaluateFollowUpPlan'],
    structuredOutput: followupResult.proposedSlot,
    status: 'success',
    latencyMs: Date.now() - startTime,
    tokensConsumed: 0
  });

  return {
    success: true,
    task: newTask,
    followupResult
  };
}

/**
 * Agent 3: CareFlow — Specialist Referral Compilation
 */
async function handleSpecialistReferral({
  patientId,
  patientName,
  patientAgeSex,
  specialty,
  specialtyCode,
  targetProviderOrClinic,
  clinicalIndication,
  hpiSummary,
  relevantLabs,
  currentMedications,
  documentedAllergies,
  vitalsSummary,
  orderingPhysician,
  tenantId = 'org-default'
}) {
  const startTime = Date.now();
  const scopedBrain = getScopedPatientContext(patientId, 'referral');

  const referralResult = compileReferralPacket({
    patientId,
    patientName: patientName || scopedBrain.patientName,
    patientAgeSex: patientAgeSex || scopedBrain.patientAgeSex,
    specialty,
    specialtyCode,
    targetProviderOrClinic,
    clinicalIndication,
    hpiSummary,
    relevantLabs: relevantLabs || scopedBrain.relevantLabs,
    currentMedications: currentMedications || scopedBrain.currentMedications,
    documentedAllergies: documentedAllergies || scopedBrain.documentedAllergies,
    vitalsSummary,
    orderingPhysician
  });

  const taskId = `task-${patientId}-referral-${Date.now()}`;
  const newTask = {
    id: taskId,
    tenantId,
    category: 'referral',
    priority: referralResult.priority,
    status: 'ready',
    patientId,
    patientName: patientName || scopedBrain.patientName,
    patientAgeSex: patientAgeSex || scopedBrain.patientAgeSex,
    title: `${specialty} Referral Packet`,
    summary: clinicalIndication,
    sourceEvent: 'Consultation Plan Order',
    createdAt: new Date().toISOString(),
    referralDetails: referralResult
  };

  taskRepository.saveTask(newTask, tenantId);

  auditRepository.recordAuditEvent({
    tenantId,
    action: 'referral_dispatched',
    actorId: 'agent-careflow',
    actorRole: 'agent',
    actorName: 'Proton CareFlow Agent',
    patientId,
    summary: `Specialist referral packet prepared for ${specialty}. Awaiting physician sign-off.`
  });

  agentRunRepository.recordAgentRun({
    tenantId,
    taskId,
    agentName: 'Proton CareFlow Agent',
    modelProvider: 'structured_packet_compiler',
    modelVersion: 'v1.4',
    contextProvenanceIds: Object.keys(scopedBrain.provenanceMap || {}),
    policyChecks: {
      requiresPhysicianSignature: true,
      serviceRequestStatusDraft: true
    },
    toolCalls: ['compileReferralPacket'],
    structuredOutput: referralResult.fhirServiceRequest,
    status: 'success',
    latencyMs: Date.now() - startTime,
    tokensConsumed: 0
  });

  return {
    success: true,
    task: newTask,
    referralResult
  };
}

/**
 * Physician Task Approval & Durable Intent + FHIR Reconciliation
 */
async function approveTask({
  taskId,
  doctor = 'Dr. Sarah Lin, MD',
  actorId = 'usr-md-lin-01',
  actorRole = 'physician',
  tenantId = 'org-default',
  editedContent,
  physicianDecision,
  overrideReason
}) {
  // Concurrency guard: await in-flight task approval for the same taskId
  if (inflightTaskApprovals.has(taskId)) {
    return await inflightTaskApprovals.get(taskId);
  }

  const approvalOp = (async () => {
    const task = taskRepository.getTaskById(taskId, tenantId);
    if (!task) {
      throw new Error(`Task ${taskId} not found.`);
    }

    const previousStatus = task.status;
    const previousSubStatus = task.triageDetails?.status || task.refillDetails?.status || task.schedulingDetails?.status || task.referralDetails?.status;
    const now = new Date().toISOString();

    // Idempotent short-circuit if task is already completed and reconciled
    if (task.status === 'completed' && task.reconciliationStatus === 'reconciled') {
      const taskIdentifierKey = `https://proton.health/ops/task|${task.id}`;
      const existingPersisted = fhirIdempotencyStore.get(taskIdentifierKey);
      return {
        success: true,
        task,
        isReplay: true,
        auditSummary: `Task ${taskId} was already approved and reconciled.`,
        fhirPersistence: {
          persistedResource: existingPersisted || task.refillDetails?.fhirMedicationRequest || { id: task.fhirResourceId, resourceType: task.fhirResourceType },
          persistenceMeta: {
            mode: process.env.PROTON_FHIR_PERSISTENCE_MODE === 'medplum' ? 'medplum_live' : 'in_memory_stub',
            livePersisted: process.env.PROTON_FHIR_PERSISTENCE_MODE === 'medplum',
            isReplay: true,
            idempotencyKey: taskIdentifierKey,
            endpoint: process.env.PROTON_FHIR_PERSISTENCE_MODE === 'medplum' ? (process.env.MEDPLUM_BASE_URL || 'http://localhost:8103/fhir/R4') : 'in-memory://synthetic-fhir-store',
            persistedAt: task.updatedAt || now
          }
        }
      };
    }

    // 1. Stage Operational Intent: 'pending_reconciliation'
    task.status = 'pending_reconciliation';
    task.reconciliationStatus = 'pending';
    taskRepository.saveTask(task, tenantId);

    let auditAction = 'operation_inbound_received';
    let auditSummary = `Task ${taskId} approved by ${doctor}.`;
    let resourceToPersist = null;
    let physicianDirectiveNotes = null;

    if (task.category === 'triage' && task.triageDetails) {
      task.triageDetails.status = 'completed';
      task.triageDetails.approvedAt = now;
      task.triageDetails.approvedBy = doctor;
      if (editedContent) {
        task.triageDetails.physicianApprovedResponse = editedContent;
        task.triageDetails.physicianEdited = true;
      } else {
        task.triageDetails.physicianApprovedResponse = task.triageDetails.aiDraftResponse;
        task.triageDetails.physicianEdited = false;
      }
      auditAction = 'agent_draft_generated';
      auditSummary = `Triage response approved for ${task.patientName} by ${doctor}${task.triageDetails.physicianEdited ? ' (Doctor Edited)' : ''}.`;
      
      const deterministicId = task.fhirResourceId || `comm-${task.id}`;
      task.fhirResourceId = deterministicId;
      task.fhirResourceType = 'Communication';

      resourceToPersist = {
        resourceType: 'Communication',
        id: deterministicId,
        identifier: [{ system: 'https://proton.health/ops/task', value: task.id }],
        status: 'completed',
        subject: { reference: `Patient/${task.patientId}` },
        sent: now,
        sender: { display: doctor },
        payload: [{ contentString: task.triageDetails.physicianApprovedResponse }]
      };
    } else if (task.category === 'refill' && task.refillDetails) {
      const decisionNotes = physicianDecision?.clinicalDecisionNotes || overrideReason || '';
      if (!decisionNotes.trim()) {
        task.status = previousStatus;
        task.reconciliationStatus = 'none';
        taskRepository.saveTask(task, tenantId);
        throw new Error('Physician clinical decision and rationale are strictly required to approve or modify a prescription refill.');
      }
      physicianDirectiveNotes = decisionNotes;
      const actionType = physicianDecision?.actionType || 'approve_standard';
      task.refillDetails.status = actionType === 'deny_request' ? 'rejected' : 'completed';
      task.refillDetails.approvedAt = now;
      task.refillDetails.approvedBy = doctor;
      task.refillDetails.physicianAction = {
        actionType,
        clinicalDecisionNotes: decisionNotes,
        prescribedDose: physicianDecision?.prescribedDose || task.refillDetails.requestedDose,
        daysSupply: physicianDecision?.daysSupply || task.refillDetails.daysSupply,
        directions: physicianDecision?.directions || task.refillDetails.requestedFrequency,
        confirmedAt: now,
        confirmedBy: doctor
      };

      const deterministicId = task.fhirResourceId || `mr-${task.id}`;
      task.fhirResourceId = deterministicId;
      task.fhirResourceType = 'MedicationRequest';

      resourceToPersist = {
        resourceType: 'MedicationRequest',
        id: deterministicId,
        identifier: [{ system: 'https://proton.health/ops/task', value: task.id }],
        status: actionType === 'deny_request' ? 'cancelled' : 'active',
        intent: 'order',
        medicationCodeableConcept: {
          text: task.refillDetails.medicationName
        },
        subject: { reference: `Patient/${task.patientId}` },
        authoredOn: now,
        requester: { display: doctor },
        dosageInstruction: [{
          text: `${physicianDecision?.prescribedDose || task.refillDetails.requestedDose} ${physicianDecision?.directions || task.refillDetails.requestedFrequency}`,
          patientInstruction: decisionNotes
        }],
        dispenseRequest: {
          numberOfRepeatsAllowed: 0,
          expectedSupplyDuration: {
            value: physicianDecision?.daysSupply || task.refillDetails.daysSupply || 30,
            unit: 'days',
            system: 'http://unitsofmeasure.org',
            code: 'd'
          }
        },
        note: [{
          text: `Independently determined and signed by ${doctor}. Clinical Directive: ${decisionNotes}`
        }]
      };
      task.refillDetails.fhirMedicationRequest = resourceToPersist;

      auditAction = actionType === 'deny_request' ? 'refill_physician_rejected' : 'refill_physician_approved';
      auditSummary = `Medication refill ${actionType === 'deny_request' ? 'denied' : 'authorized'} for ${task.refillDetails.medicationName} (${task.patientName}) by ${doctor}. Clinical Directive: ${decisionNotes}`;
    } else if (task.category === 'scheduling' && task.schedulingDetails) {
      task.schedulingDetails.status = 'completed';
      task.schedulingDetails.outreachDispatchedAt = now;
      const deterministicId = task.fhirResourceId || `app-${task.id}`;
      task.fhirResourceId = deterministicId;
      task.fhirResourceType = 'Appointment';
      task.schedulingDetails.bookedAppointmentId = deterministicId;
      auditAction = 'appointment_scheduled';
      auditSummary = `Appointment outreach confirmed for ${task.patientName} (${task.schedulingDetails.targetTimeframe}).`;
      
      resourceToPersist = {
        resourceType: 'Appointment',
        id: deterministicId,
        identifier: [{ system: 'https://proton.health/ops/task', value: task.id }],
        status: 'booked',
        description: task.schedulingDetails.clinicalReason || 'Follow-up Consultation',
        start: task.schedulingDetails.proposedSlot?.start || now,
        end: task.schedulingDetails.proposedSlot?.end || now,
        participant: [
          { actor: { reference: `Patient/${task.patientId}` }, status: 'accepted' },
          { actor: { display: doctor }, status: 'accepted' }
        ]
      };
    } else if (task.category === 'referral' && task.referralDetails) {
      task.referralDetails.status = 'physician_signed';
      task.referralDetails.signedAt = now;
      task.referralDetails.signedBy = doctor;
      auditAction = 'referral_dispatched';
      auditSummary = `Specialist referral signed for ${task.referralDetails.specialty} (${task.patientName}) by ${doctor}.`;
      
      const deterministicId = task.fhirResourceId || `sr-${task.id}`;
      task.fhirResourceId = deterministicId;
      task.fhirResourceType = 'ServiceRequest';

      resourceToPersist = {
        resourceType: 'ServiceRequest',
        id: deterministicId,
        identifier: [{ system: 'https://proton.health/ops/task', value: task.id }],
        status: 'active',
        intent: 'order',
        code: {
          text: task.referralDetails.specialty,
          coding: [{ system: 'http://snomed.info/sct', code: task.referralDetails.specialtyCode || '394589003', display: task.referralDetails.specialty }]
        },
        subject: { reference: `Patient/${task.patientId}` },
        authoredOn: now,
        requester: { display: doctor },
        performer: [{ display: task.referralDetails.targetProviderOrClinic }]
      };
    }

    // 2. FHIR Reconciliation Step
    let persistenceOutcome = null;
    if (resourceToPersist) {
      try {
        persistenceOutcome = await persistFhirResource(resourceToPersist);
        task.reconciliationStatus = 'reconciled';
        task.status = (task.category === 'refill' && task.refillDetails?.status === 'rejected') ? 'rejected' : 'completed';
        task.fhirResourceId = persistenceOutcome.persistedResource?.id || resourceToPersist.id;
        task.fhirResourceType = resourceToPersist.resourceType;
        taskRepository.saveTask(task, tenantId);
      } catch (err) {
        // FHIR persistence failed: mark reconciliation_failed, preserve failure reason, do NOT claim success
        task.status = 'reconciliation_failed';
        task.reconciliationStatus = 'failed';
        task.reconciliationError = err.message;
        if (task.triageDetails) task.triageDetails.status = previousSubStatus;
        if (task.refillDetails) task.refillDetails.status = previousSubStatus;
        if (task.schedulingDetails) task.schedulingDetails.status = previousSubStatus;
        if (task.referralDetails) task.referralDetails.status = previousSubStatus;
        taskRepository.saveTask(task, tenantId);

        auditRepository.recordAuditEvent({
          tenantId,
          action: 'fhir_persistence_failed',
          actorId,
          actorRole,
          actorName: doctor,
          patientId: task.patientId,
          targetResourceId: resourceToPersist?.id || null,
          summary: `FHIR write failed during task approval: ${err.message}`
        });

        throw err;
      }
    } else {
      task.status = 'completed';
      task.reconciliationStatus = 'none';
      taskRepository.saveTask(task, tenantId);
    }

  auditRepository.recordAuditEvent({
    tenantId,
    action: auditAction,
    actorId,
    actorRole,
    actorName: doctor,
    patientId: task.patientId,
    targetResourceId: task.fhirResourceId,
    previousState: previousStatus,
    resultingState: task.status,
    physicianDirective: physicianDirectiveNotes,
    summary: auditSummary
  });

    return {
      success: true,
      task,
      auditSummary,
      fhirPersistence: persistenceOutcome
    };
  })();

  inflightTaskApprovals.set(taskId, approvalOp);
  try {
    return await approvalOp;
  } finally {
    inflightTaskApprovals.delete(taskId);
  }
}

async function rejectTask({
  taskId,
  doctor = 'Dr. Sarah Lin, MD',
  actorId = 'usr-md-lin-01',
  actorRole = 'physician',
  tenantId = 'org-default',
  reason
}) {
  const task = taskRepository.getTaskById(taskId, tenantId);
  if (!task) {
    throw new Error(`Task ${taskId} not found.`);
  }

  const previousStatus = task.status;
  task.status = 'rejected';
  task.reconciliationStatus = 'none';
  taskRepository.saveTask(task, tenantId);

  auditRepository.recordAuditEvent({
    tenantId,
    action: 'refill_physician_rejected',
    actorId,
    actorRole,
    actorName: doctor,
    patientId: task.patientId,
    previousState: previousStatus,
    resultingState: 'rejected',
    summary: `Task ${taskId} rejected by ${doctor}. Reason: ${reason || 'Physician clinical discretion'}`
  });

  return {
    success: true,
    task
  };
}

/**
 * Dispatches Communication via the Abstract Communication Gateway
 */
async function dispatchCommunication({
  taskId,
  channel,
  tenantId = 'org-default',
  actorId = 'agent-connect',
  actorRole = 'agent',
  actorName = 'Proton Connect Agent'
}) {
  const task = taskRepository.getTaskById(taskId, tenantId);
  if (!task) throw new Error(`Task ${taskId} not found.`);
  if (task.category !== 'triage' || !task.triageDetails) {
    throw new Error(`Task ${taskId} is not a communication triage task.`);
  }

  // CLINICAL COMMUNICATION SAFETY INVARIANT:
  // Symptom guidance or medication advice strictly cannot be dispatched without physician review and approval!
  if (task.triageDetails.communicationCategory === 'clinical' && task.status !== 'completed') {
    const err = new Error('Clinical communication cannot be autonomously dispatched without attending physician review and approval.');
    err.statusCode = 403;
    err.code = 'CLINICAL_COMMUNICATION_CANNOT_BE_AUTONOMOUSLY_DISPATCHED';
    throw err;
  }

  const now = new Date().toISOString();
  task.status = 'completed';
  task.triageDetails.status = 'completed';
  task.triageDetails.dispatchedAt = now;
  taskRepository.saveTask(task, tenantId);

  // Dispatch through the abstract gateway
  const messageBody = task.triageDetails.physicianApprovedResponse || task.triageDetails.aiDraftResponse;
  const isClinical = task.triageDetails.communicationCategory === 'clinical';

  const gatewayResult = await communicationGateway.processOutboundMessage({
    taskId,
    patientId: task.patientId,
    tenantId,
    channel: channel || task.triageDetails.channel || 'portal',
    category: isClinical ? 'clinical' : 'administrative',
    messageBody,
    approvedBy: isClinical ? (task.triageDetails.approvedBy || actorName) : 'Proton Connect Agent (Autonomous Policy)',
    approvedAt: now
  });

  auditRepository.recordAuditEvent({
    tenantId,
    action: isClinical ? 'clinical_communication_dispatched' : 'administrative_communication_dispatched',
    actorId,
    actorRole,
    actorName: isClinical ? (task.triageDetails.approvedBy || actorName) : 'Proton Connect Agent (Autonomous Policy)',
    patientId: task.patientId,
    summary: `${isClinical ? 'Clinical' : 'Administrative'} message dispatched to ${task.patientName} via ${channel || task.triageDetails.channel}. Status: ${gatewayResult.status}`
  });

  return {
    success: true,
    task,
    communicationCategory: task.triageDetails.communicationCategory,
    dispatched: true,
    deliveryStatus: gatewayResult.status,
    gatewayRef: gatewayResult.gatewayRef
  };
}

/**
 * Explicit confirmation of proposed appointment booking
 */
async function confirmAppointmentBooking({
  taskId,
  confirmedBy = 'Patient (Portal Confirmation)',
  actorId = 'usr-ops-marcus-01',
  actorRole = 'operations_staff',
  tenantId = 'org-default'
}) {
  const task = taskRepository.getTaskById(taskId, tenantId);
  if (!task) throw new Error(`Task ${taskId} not found.`);
  if (task.category !== 'scheduling' || !task.schedulingDetails) {
    throw new Error(`Task ${taskId} is not a scheduling task.`);
  }

  const now = new Date().toISOString();
  task.status = 'completed';
  task.schedulingDetails.status = 'completed';
  task.schedulingDetails.appointmentStatus = 'booked';
  task.schedulingDetails.confirmedBy = confirmedBy;
  task.schedulingDetails.confirmedAt = now;
  if (task.schedulingDetails.fhirAppointment) {
    task.schedulingDetails.fhirAppointment.status = 'booked';
  }
  taskRepository.saveTask(task, tenantId);

  auditRepository.recordAuditEvent({
    tenantId,
    action: 'appointment_scheduled',
    actorId,
    actorRole,
    actorName: confirmedBy,
    patientId: task.patientId,
    summary: `Proposed appointment officially booked for ${task.patientName} upon ${confirmedBy}. Slot: ${task.schedulingDetails.proposedSlot?.start || 'Clinic Suite 400'}`
  });

  return {
    success: true,
    task,
    appointmentStatus: 'booked'
  };
}

function getAuditEvents(limit = 50, tenantId = 'org-default') {
  return auditRepository.listAuditEvents({ tenantId, limit });
}

function verifyAuditChain(tenantId = 'org-default') {
  return auditRepository.verifyAuditChain(tenantId);
}

module.exports = {
  initializeSyntheticCohort,
  getTasks,
  getSummary,
  handleInboundTriage,
  handleTriageSubmission: handleInboundTriage,
  handleRefillVerification,
  handleFollowUpScheduling,
  handleSchedulingFollowup: handleFollowUpScheduling,
  handleCareGapAssessment: ({ patientId, conditions, recentLabs }) => {
    const careGaps = evaluateCareGapsForPatient({ patientId, conditions, recentLabs });
    return { success: true, careGaps };
  },
  handleSpecialistReferral,
  handleReferralCompilation: handleSpecialistReferral,
  approveTask,
  rejectTask,
  dispatchCommunication,
  confirmAppointmentBooking,
  getAuditEvents,
  verifyAuditChain,
  persistFhirResource,
  clearFhirIdempotencyStore,
  FhirPersistenceError
};
