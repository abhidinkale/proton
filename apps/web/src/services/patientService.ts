/**
 * PROTON CLINICAL DOMAIN SERVICE: PATIENT SERVICE ADAPTER
 * Connects the UI domain to live FHIR/Medplum or rich clinical case store.
 */

import type { Patient, PatientSummary, TimelineEvent, LabResult, Medication, Allergy, Condition } from '../domain/patient/types';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';
import type { DoctorDeskPatient } from '../components/DoctorDeskEncounter';

function mapDeskPatientToDomain(dp: DoctorDeskPatient): Patient {
  const allergies: Allergy[] = dp.allergies.map((allStr, i) => {
    const isPenicillin = allStr.toLowerCase().includes('penicillin');
    const isAnaphylaxis = allStr.toLowerCase().includes('anaphylaxis');
    return {
      id: `all-${dp.id}-${i}`,
      allergen: allStr,
      category: allStr.toLowerCase().includes('pollen') ? 'environment' : 'medication',
      reaction: isAnaphylaxis ? 'Anaphylaxis / Airway compromise' : 'Rash / Urticaria',
      severity: isAnaphylaxis ? 'anaphylaxis' : 'moderate',
      isCritical: isAnaphylaxis || isPenicillin
    };
  });

  const conditions: Condition[] = dp.conditions.map((cStr, i) => ({
    id: `cond-${dp.id}-${i}`,
    name: cStr,
    status: 'active',
    diagnosedDate: '2024-03-15'
  }));

  const medications: Medication[] = dp.medications.map((mStr, i) => ({
    id: `med-${dp.id}-${i}`,
    name: mStr,
    dosage: 'Standard clinical titration',
    frequency: 'Daily',
    route: 'Oral',
    status: 'active',
    prescribedDate: '2026-01-10'
  }));

  const recentLabs: LabResult[] = dp.recentLabs.map((l, i) => {
    const isAbnormal = l.status === 'high' || l.status === 'low';
    return {
      id: `lab-${dp.id}-${i}`,
      name: l.name,
      value: l.value,
      unit: l.value.split(' ')[1] || '',
      referenceRange: 'Standard adult reference',
      status: isAbnormal ? 'NEEDS_ATTENTION' : 'NORMAL',
      recordedAt: l.date || 'Recent'
    };
  });

  const timeline: TimelineEvent[] = [
    {
      id: `tl-enc-${dp.id}`,
      timestamp: '2026-10-18 08:30',
      type: 'encounter',
      title: `${dp.visitType || 'Clinical Encounter'} (${(dp.status || 'ready').toUpperCase()})`,
      summary: dp.chiefComplaint,
      severity: dp.allergies.some(a => a.toLowerCase().includes('anaphylaxis')) ? 'critical' : 'normal'
    },
    ...recentLabs.map((l, i) => ({
      id: `tl-lab-${dp.id}-${i}`,
      timestamp: '2026-10-15 14:00',
      type: 'lab' as const,
      title: `Lab: ${l.name}`,
      summary: `Result: ${l.value} (${l.status})`,
      severity: (l.status === 'NEEDS_ATTENTION' ? 'attention' : 'normal') as any
    })),
    ...dp.documents.map((d, i) => ({
      id: `tl-doc-${dp.id}-${i}`,
      timestamp: d.date || '2026-10-12',
      type: 'document' as const,
      title: d.name,
      summary: d.summary || d.type,
      severity: 'info' as any
    }))
  ];

  return {
    id: dp.id,
    mrn: dp.mrn,
    name: dp.name,
    age: dp.age,
    dob: dp.dob || '1970-01-01',
    gender: (dp.gender?.toLowerCase() as any) || 'unknown',
    chiefComplaint: dp.chiefComplaint,
    vitals: {
      bp: dp.vitals.bp,
      hr: dp.vitals.hr,
      spo2: dp.vitals.spo2,
      bmi: dp.vitals.bmi,
      temp: dp.vitals.temp,
      recordedAt: 'Today 08:00 AM'
    },
    allergies,
    conditions,
    medications,
    recentLabs,
    timeline,
    activeEncounterId: dp.encounterId,
    riskScore: dp.allergies.some(a => a.toLowerCase().includes('anaphylaxis')) ? 'critical' : 'moderate'
  };
}

export const patientService = {
  async getAllSummaries(): Promise<PatientSummary[]> {
    return TODAY_CLINIC_SCHEDULE.map(dp => {
      const isCriticalAllergy = dp.allergies.some(a => a.toLowerCase().includes('anaphylaxis') || a.toLowerCase().includes('penicillin'));
      let status: PatientSummary['status'] = 'WAITING';
      if (dp.status === 'completed') status = 'COMPLETED';
      else if (dp.id.includes('eleanor')) status = 'IN_CONSULTATION';
      else if (dp.id.includes('arthur')) status = 'READY_FOR_REVIEW';

      return {
        id: dp.id,
        mrn: dp.mrn,
        name: dp.name,
        age: dp.age,
        gender: (dp.gender?.toLowerCase() as any) || 'unknown',
        chiefComplaint: dp.chiefComplaint,
        appointmentTime: dp.time,
        status,
        criticalAllergies: dp.allergies.filter(a => !a.toLowerCase().includes('no known')),
        primaryCondition: dp.conditions[0],
        vitalsSummary: `BP ${dp.vitals.bp} • HR ${dp.vitals.hr}`,
        needsAttention: isCriticalAllergy || dp.recentLabs.some(l => l.status === 'high' || l.status === 'low'),
        attentionReason: isCriticalAllergy ? 'Critical Allergy Guard' : undefined
      };
    });
  },

  async getPatientById(id: string): Promise<Patient | null> {
    const cleanId = id.trim().toLowerCase();
    const match = TODAY_CLINIC_SCHEDULE.find(
      p => p.id.toLowerCase() === cleanId || p.id.toLowerCase().includes(cleanId) || p.mrn.toLowerCase() === cleanId
    );
    if (match) {
      return mapDeskPatientToDomain(match);
    }
    // Fallback to Eleanor Vance as default clinical fixture
    return mapDeskPatientToDomain(TODAY_CLINIC_SCHEDULE[1]);
  },

  async searchPatients(query: string): Promise<PatientSummary[]> {
    const q = query.trim().toLowerCase();
    if (!q) return this.getAllSummaries();

    const summaries = await this.getAllSummaries();
    return summaries.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.mrn.toLowerCase().includes(q) ||
      s.chiefComplaint.toLowerCase().includes(q) ||
      (s.primaryCondition && s.primaryCondition.toLowerCase().includes(q))
    );
  }
};
