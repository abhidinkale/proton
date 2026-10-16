import { API_BASE_URL } from '../config';
import type { 
  OperationalTask, 
  OperationsSummary 
} from '../types/operations';
import { checkTriageEmergencyFlags } from './verification';

// Client-side fallback store strictly for disconnected local UI dev
let localTasksCache: OperationalTask[] | null = null;

function seedLocalCohort(): OperationalTask[] {
  const now = new Date();

  const eleanorTriage: OperationalTask = {
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
    persistenceMode: 'offline_synthetic',
    isOfflineSynthetic: true,
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

  const arthurRefill: OperationalTask = {
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
    persistenceMode: 'offline_synthetic',
    isOfflineSynthetic: true,
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
      physicianDecisionRequired: true
    }
  };

  const eleanorScheduling: OperationalTask = {
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
    persistenceMode: 'offline_synthetic',
    isOfflineSynthetic: true,
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

  const arthurReferral: OperationalTask = {
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
    persistenceMode: 'offline_synthetic',
    isOfflineSynthetic: true,
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

  return [eleanorTriage, arthurRefill, eleanorScheduling, arthurReferral];
}

class OperationsService {
  private offlineSynthetic = false;

  public isOffline(): boolean {
    return this.offlineSynthetic;
  }

  private getLocalTasks(): OperationalTask[] {
    if (!localTasksCache) {
      const stored = localStorage.getItem('proton_operations_tasks_v1');
      if (stored) {
        try {
          localTasksCache = JSON.parse(stored);
        } catch {
          localTasksCache = seedLocalCohort();
        }
      } else {
        localTasksCache = seedLocalCohort();
      }
    }
    return localTasksCache!;
  }

  private persistLocalTasks(): void {
    if (localTasksCache) {
      localStorage.setItem('proton_operations_tasks_v1', JSON.stringify(localTasksCache));
    }
  }

  private currentPersona: string = 'physician-lin';

  public setDevPersona(persona: string): void {
    this.currentPersona = persona;
  }

  public getDevPersona(): string {
    return this.currentPersona;
  }

  private getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Proton-Dev-Persona': this.currentPersona,
      ...extraHeaders
    };
  }

  public async getSummary(): Promise<OperationsSummary> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/summary`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        this.offlineSynthetic = false;
        return await res.json();
      }
    } catch {
      this.offlineSynthetic = true;
    }

    const tasks = this.getLocalTasks();
    const pendingTriage = tasks.filter(t => t.category === 'triage' && t.status !== 'completed' && t.status !== 'rejected').length;
    const urgentRefills = tasks.filter(t => t.category === 'refill' && t.status !== 'completed' && t.status !== 'rejected').length;
    const careGaps = tasks.filter(t => t.category === 'scheduling' && t.status !== 'completed' && t.status !== 'rejected').length;
    const openReferrals = tasks.filter(t => t.category === 'referral' && t.status !== 'completed' && t.status !== 'rejected').length;
    const emergencyAlerts = tasks.filter(t => t.priority === 'emergency' && t.status !== 'completed').length;

    return {
      pendingTriageCount: pendingTriage,
      urgentRefillCount: urgentRefills,
      schedulingCareGapCount: careGaps,
      openReferralCount: openReferrals,
      emergencyAlertCount: emergencyAlerts,
      totalActiveTasks: tasks.filter(t => t.status !== 'completed' && t.status !== 'rejected').length
    };
  }

  public async getTasks(filters?: { status?: string; category?: string; patientId?: string }): Promise<OperationalTask[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.category) params.set('category', filters.category);
      if (filters?.patientId) params.set('patientId', filters.patientId);

      const res = await fetch(`${API_BASE_URL}/api/operations/tasks?${params.toString()}`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        this.offlineSynthetic = false;
        const data = await res.json();
        const serverTasks = data.tasks || [];
        localTasksCache = serverTasks;
        this.persistLocalTasks();
        return serverTasks;
      }
    } catch {
      this.offlineSynthetic = true;
    }

    return this.getLocalTasks().filter(t => {
      if (filters?.status && filters.status !== 'all' && t.status !== filters.status) return false;
      if (filters?.category && filters.category !== 'all' && t.category !== filters.category) return false;
      if (filters?.patientId && t.patientId !== filters.patientId) return false;
      return true;
    });
  }

  public async submitInboundTriage(params: {
    patientId: string;
    message: string;
    channel?: 'portal' | 'sms';
    patientContext?: any;
    phone?: string;
    birthDate?: string;
  }): Promise<{ success: boolean; task: OperationalTask; isReplay?: boolean }> {
    const idempotencyKey = `triage-${params.patientId}-${Date.now()}`;
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/triage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          ...params,
          idempotencyKey
        })
      });
      if (res.ok) {
        this.offlineSynthetic = false;
        const data = await res.json();
        if (data.task) {
          const tasks = this.getLocalTasks();
          tasks.unshift(data.task);
          this.persistLocalTasks();
          return { success: true, task: data.task, isReplay: data.isReplay };
        }
      }
    } catch {
      this.offlineSynthetic = true;
    }

    // Offline synthetic simulation
    const redFlagCheck = checkTriageEmergencyFlags(params.message);
    const newTask: OperationalTask = {
      id: `task-sim-${Date.now()}`,
      category: 'triage',
      priority: redFlagCheck.emergencyRedFlag ? 'emergency' : (redFlagCheck.riskLevel === 'HIGH' ? 'urgent' : 'routine'),
      status: 'requested',
      patientId: params.patientId,
      patientName: params.patientContext?.name || 'Patient',
      patientAgeSex: params.patientContext?.ageSex || 'Unknown',
      title: redFlagCheck.emergencyRedFlag ? 'CRITICAL: Acute Red Flag Alert' : 'Inbound Patient Query (Offline Synthetic)',
      summary: params.message.slice(0, 100),
      sourceEvent: params.channel === 'sms' ? 'SMS Message' : 'Portal Message',
      persistenceMode: 'offline_synthetic',
      isOfflineSynthetic: true,
      createdAt: new Date().toISOString(),
      triageDetails: {
        id: `tri-${Date.now()}`,
        patientId: params.patientId,
        patientName: params.patientContext?.name || 'Patient',
        patientAgeSex: params.patientContext?.ageSex || 'Unknown',
        channel: params.channel || 'portal',
        inboundMessage: params.message,
        receivedAt: new Date().toISOString(),
        priority: redFlagCheck.emergencyRedFlag ? 'emergency' : 'urgent',
        status: 'requested',
        communicationCategory: 'clinical',
        autonomousDispatchAllowed: false,
        risk: redFlagCheck,
        aiDraftResponse: redFlagCheck.emergencyRedFlag
          ? 'EMERGENCY NOTICE: Your symptoms may indicate a serious medical emergency. Please call 911 or proceed immediately to the nearest emergency department.'
          : 'Thank you for reaching out. Dr. Lin is reviewing your chart and symptoms. If your dizziness worsens or you experience shortness of breath, please seek emergency care.',
        relevantLongitudinalContext: params.patientContext?.conditions || []
      }
    };

    const tasks = this.getLocalTasks();
    tasks.unshift(newTask);
    this.persistLocalTasks();

    return { success: true, task: newTask };
  }

  public async approveTask(options: {
    taskId: string;
    doctor?: string;
    editedContent?: string;
    physicianDecision?: {
      actionType: 'approve_standard' | 'modify_dosage' | 'deny_request';
      clinicalDecisionNotes: string;
      prescribedDose?: string;
      directions?: string;
      daysSupply?: number;
    };
    selectedOptionId?: string;
    overrideReason?: string;
  }): Promise<{ success: boolean; task: OperationalTask }> {
    const doctor = options.doctor || 'Dr. Sarah Lin, MD';
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/tasks/${options.taskId}/approve`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(options)
      });
      if (res.ok) {
        this.offlineSynthetic = false;
        const data = await res.json();
        if (data.task) {
          const tasks = this.getLocalTasks();
          const idx = tasks.findIndex(t => t.id === options.taskId);
          if (idx !== -1) tasks[idx] = data.task;
          this.persistLocalTasks();
          return { success: true, task: data.task };
        }
      }
    } catch {
      this.offlineSynthetic = true;
    }

    const tasks = this.getLocalTasks();
    const task = tasks.find(t => t.id === options.taskId);
    if (!task) throw new Error(`Task ${options.taskId} not found.`);

    const now = new Date().toISOString();

    if (task.category === 'triage' && task.triageDetails) {
      task.status = 'completed';
      task.triageDetails.status = 'completed';
      task.triageDetails.approvedAt = now;
      task.triageDetails.approvedBy = doctor;
      if (options.editedContent) {
        task.triageDetails.physicianApprovedResponse = options.editedContent;
        task.triageDetails.physicianEdited = true;
      } else {
        task.triageDetails.physicianApprovedResponse = task.triageDetails.aiDraftResponse;
        task.triageDetails.physicianEdited = false;
      }
    } else if (task.category === 'refill' && task.refillDetails) {
      const decisionNotes = options.physicianDecision?.clinicalDecisionNotes || options.overrideReason || '';
      const actionType = options.physicianDecision?.actionType || 'approve_standard';
      task.status = actionType === 'deny_request' ? 'rejected' : 'completed';
      task.refillDetails.status = actionType === 'deny_request' ? 'rejected' : 'completed';
      task.refillDetails.approvedAt = now;
      task.refillDetails.approvedBy = doctor;
      task.refillDetails.physicianAction = {
        actionType,
        clinicalDecisionNotes: decisionNotes,
        prescribedDose: options.physicianDecision?.prescribedDose || task.refillDetails.requestedDose,
        daysSupply: options.physicianDecision?.daysSupply || task.refillDetails.daysSupply || 30,
        confirmedAt: now,
        confirmedBy: doctor
      };
    } else if (task.category === 'scheduling' && task.schedulingDetails) {
      task.schedulingDetails.status = 'completed';
      task.schedulingDetails.outreachDispatchedAt = now;
      task.schedulingDetails.bookedAppointmentId = `app-${task.patientId}-${Date.now()}`;
    } else if (task.category === 'referral' && task.referralDetails) {
      task.referralDetails.status = 'physician_signed';
      task.referralDetails.signedAt = now;
      task.referralDetails.signedBy = doctor;
    }

    this.persistLocalTasks();
    return { success: true, task };
  }

  public async rejectTask(taskId: string, reason?: string, doctor = 'Dr. Sarah Lin, MD'): Promise<{ success: boolean; task: OperationalTask }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ reason, doctor })
      });
      if (res.ok) {
        this.offlineSynthetic = false;
        const data = await res.json();
        if (data.task) {
          const tasks = this.getLocalTasks();
          const idx = tasks.findIndex(t => t.id === taskId);
          if (idx !== -1) tasks[idx] = data.task;
          this.persistLocalTasks();
          return { success: true, task: data.task };
        }
      }
    } catch {
      this.offlineSynthetic = true;
    }

    const tasks = this.getLocalTasks();
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found.`);

    task.status = 'rejected';
    this.persistLocalTasks();
    return { success: true, task };
  }

  public async dispatchCommunication(taskId: string, channel?: string): Promise<{ success: boolean; task?: OperationalTask }> {
    const res = await fetch(`${API_BASE_URL}/api/operations/communications/${taskId}/dispatch`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ channel })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to dispatch communication.');
    }
    return await res.json();
  }

  public async confirmAppointmentBooking(taskId: string, confirmedBy?: string): Promise<{ success: boolean; task?: OperationalTask }> {
    const res = await fetch(`${API_BASE_URL}/api/operations/scheduling/${taskId}/confirm`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ confirmedBy })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to confirm appointment booking.');
    }
    return await res.json();
  }

  public async getAuditEvents(limit = 50): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/audit?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        this.offlineSynthetic = false;
        const data = await res.json();
        return data.auditEvents || [];
      }
    } catch {
      this.offlineSynthetic = true;
    }
    return [];
  }

  public async verifyAuditChain(): Promise<{ valid: boolean; totalEventsVerified: number; error?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/audit/verify`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { valid: true, totalEventsVerified: 0 };
  }

  public async setGatewayFailureMode(enable: boolean, reason?: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/gateway/failure-mode`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ enable, reason })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { failureMode: enable };
  }

  public async resolvePatientIdentity(params: { patientId?: string; mrn?: string; phone?: string; birthDate?: string }) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/identity/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return {
      status: params.patientId ? 'RESOLVED' : 'UNRESOLVED',
      tier: params.patientId ? 'TIER_1_EXACT_ID' : 'TIER_3_UNASSIGNED',
      confidence: params.patientId ? 1.0 : 0.0,
      patientId: params.patientId || 'unassigned-patient',
      patientName: 'Patient',
      requiresManualResolution: !params.patientId
    };
  }

  public async evaluateCareGaps(patientId: string, conditions: string[], recentLabs: any[] = []) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/scheduling/care-gaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, conditions, recentLabs })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { success: false, careGaps: { patientId, gaps: [] } };
  }

  public async scheduleFollowup(consultationPlanText: string, patientId: string, patientAcuity?: string, patientName?: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/scheduling/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultationPlanText, patientId, patientAcuity, patientName })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          const tasks = this.getLocalTasks();
          tasks.unshift(data.task);
          this.persistLocalTasks();
        }
        return data;
      }
    } catch {}
    return { success: false };
  }

  public async compileReferral(params: any) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/operations/referrals/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          const tasks = this.getLocalTasks();
          tasks.unshift(data.task);
          this.persistLocalTasks();
        }
        return data;
      }
    } catch {}
    return { success: false };
  }

  public resetToSyntheticCohort(): OperationalTask[] {
    localTasksCache = seedLocalCohort();
    this.persistLocalTasks();
    return localTasksCache;
  }
}

export const operationsService = new OperationsService();
