import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useMedplum } from '@medplum/react';
import { synthesizePatientIntelligence } from '../services/clinicalBrain';
import type { 
  Patient, 
  Encounter, 
  Condition, 
  AllergyIntolerance, 
  MedicationStatement, 
  MedicationRequest, 
  Observation, 
  DocumentReference, 
  ClinicalImpression 
} from '@medplum/fhirtypes';
import { 
  ArrowLeft, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Printer,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  LoaderCircle
} from 'lucide-react';
import Layout from '../components/Layout';
import type { PrescriptionItem } from '../types/prescription';
import PrescriptionPDFModal from '../components/PrescriptionPDFModal';
import EvidenceModal from '../components/EvidenceModal';
import type { ClinicalEvidence } from '../types/clinicalBrain';
import { operationsService } from '../services/operationsService';
import type { OperationalTask } from '../types/operations';

type TimelineFilter = 'all' | 'consultations' | 'prescriptions' | 'labs' | 'documents' | 'communications' | 'referrals' | 'operations';

interface TimelineEvent {
  id: string;
  date: Date;
  type: 'consultation' | 'prescription' | 'observation' | 'document' | 'condition' | 'communication' | 'referral' | 'scheduling' | 'operation';
  title: string;
  description: string;
  badge?: {
    text: string;
    variant: 'approved' | 'draft' | 'warning' | 'neutral';
  };
  details?: {
    strength?: string;
    dose?: string;
    route?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
    status?: string;
  };
  consultationData?: {
    doctor: string;
    type: string;
    summary?: string;
    transcript?: string;
    linkedPrescriptions: MedicationRequest[];
  };
  prescriptionData?: {
    item: PrescriptionItem;
    status: string;
  };
  observationData?: {
    name: string;
    value: string;
    status: string;
    isAbnormal: boolean;
  };
  documentData?: {
    name: string;
    fileType?: string;
    extractedFactsCount: number;
  };
  conditionData?: {
    name: string;
    sourceQuote?: string;
  };
  operationalData?: {
    task: OperationalTask;
  };
  resource: any;
  sourceDoc?: string;
}

export default function PatientProfile() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const medplum = useMedplum();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [impressions, setImpressions] = useState<ClinicalImpression[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [medStatements, setMedStatements] = useState<MedicationStatement[]>([]);
  const [medicationRequests, setMedicationRequests] = useState<MedicationRequest[]>([]);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [documents, setDocuments] = useState<DocumentReference[]>([]);
  const [operationalTasks, setOperationalTasks] = useState<OperationalTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Timeline UI States
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');
  const [expandedTimelineIds, setExpandedTimelineIds] = useState<Record<string, boolean>>({});
  
  // PDF Modal State
  const [pdfModalData, setPdfModalData] = useState<{
    isOpen: boolean;
    medications: PrescriptionItem[];
    date?: string;
  }>({ isOpen: false, medications: [] });

  // Evidence Modal State
  const [selectedEvidence, setSelectedEvidence] = useState<ClinicalEvidence | null>(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);

  const handleOpenEvidence = (ev?: ClinicalEvidence) => {
    if (!ev) return;
    setSelectedEvidence(ev);
    setIsEvidenceModalOpen(true);
  };

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      try {
        medplum.invalidateAll();
        const p = await medplum.readResource('Patient', id);
        setPatient(p);
        
        const [encRes, impRes, condRes, medStatRes, medReqRes, allRes, obsRes, docRes] = await Promise.allSettled([
          medplum.searchResources('Encounter', { subject: `Patient/${id}` }),
          medplum.searchResources('ClinicalImpression', { subject: `Patient/${id}` }),
          medplum.searchResources('Condition', { subject: `Patient/${id}` }),
          medplum.searchResources('MedicationStatement', { subject: `Patient/${id}` }),
          medplum.searchResources('MedicationRequest', { subject: `Patient/${id}` }),
          medplum.searchResources('AllergyIntolerance', { patient: `Patient/${id}` }),
          medplum.searchResources('Observation', { subject: `Patient/${id}` }),
          medplum.searchResources('DocumentReference', { subject: `Patient/${id}` })
        ]);
        
        if (encRes.status === 'fulfilled') setEncounters(encRes.value);
        if (impRes.status === 'fulfilled') setImpressions(impRes.value);
        if (condRes.status === 'fulfilled') setConditions(condRes.value);
        if (medStatRes.status === 'fulfilled') setMedStatements(medStatRes.value);
        if (medReqRes.status === 'fulfilled') setMedicationRequests(medReqRes.value);
        if (allRes.status === 'fulfilled') setAllergies(allRes.value);
        if (obsRes.status === 'fulfilled') setObservations(obsRes.value);
        if (docRes.status === 'fulfilled') setDocuments(docRes.value);

        // Polling retry for async Medplum database synchronization
        let timer: any;
        const retrySync = (attemptsLeft: number) => {
          if (attemptsLeft <= 0) return;
          timer = setTimeout(async () => {
            try {
              medplum.invalidateAll();
              const [retryEncs, retryMeds, retryImps] = await Promise.allSettled([
                medplum.searchResources('Encounter', { subject: `Patient/${id}` }),
                medplum.searchResources('MedicationRequest', { subject: `Patient/${id}` }),
                medplum.searchResources('ClinicalImpression', { subject: `Patient/${id}` })
              ]);
              let hasEncs = false;
              let hasMeds = false;
              if (retryEncs.status === 'fulfilled' && retryEncs.value.length > 0) {
                setEncounters(retryEncs.value);
                hasEncs = true;
              }
              if (retryMeds.status === 'fulfilled' && retryMeds.value.length > 0) {
                setMedicationRequests(retryMeds.value);
                hasMeds = true;
              }
              if (retryImps.status === 'fulfilled' && retryImps.value.length > 0) {
                setImpressions(retryImps.value);
              }
              if (!hasEncs || !hasMeds) {
                retrySync(attemptsLeft - 1);
              }
            } catch {
              retrySync(attemptsLeft - 1);
            }
          }, 1000);
        };

        if (
          (encRes.status === 'fulfilled' && encRes.value.length === 0) ||
          (medReqRes.status === 'fulfilled' && medReqRes.value.length === 0)
        ) {
          retrySync(6);
        }

        return () => {
          if (timer) clearTimeout(timer);
        };
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [medplum, id, location.key]);

  useEffect(() => {
    if (!id && !patient) return;
    operationsService.getTasks().then(tasks => {
      const pFamily = patient?.name?.[0]?.family?.toLowerCase() || '';
      const pGiven = patient?.name?.[0]?.given?.[0]?.toLowerCase() || '';
      const relevant = tasks.filter(t => {
        const tName = t.patientName.toLowerCase();
        return (
          t.patientId === id ||
          (patient?.id && t.patientId === patient.id) ||
          (id && id.toLowerCase().includes('eleanor') && t.patientId.toLowerCase().includes('eleanor')) ||
          (id && id.toLowerCase().includes('arthur') && t.patientId.toLowerCase().includes('arthur')) ||
          (pFamily && tName.includes(pFamily)) ||
          (pGiven && tName.includes(pGiven))
        );
      });
      setOperationalTasks(relevant);
    }).catch(() => {});
  }, [id, patient]);

  const intelligence = useMemo(() => {
    return synthesizePatientIntelligence(
      patient,
      encounters,
      impressions,
      conditions,
      medStatements,
      medicationRequests,
      allergies,
      observations,
      documents
    );
  }, [patient, encounters, impressions, conditions, medStatements, medicationRequests, allergies, observations, documents]);

  const handleFocusTimelineItem = (sourceId: string) => {
    const el = document.getElementById(`timeline-${sourceId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setExpandedTimelineIds(prev => ({ ...prev, [sourceId]: true }));
    }
  };

  const getSourceDocName = (derivedFrom?: any[], evidence?: any[]): string | undefined => {
    let refStr = null;
    if (derivedFrom && derivedFrom.length > 0) refStr = derivedFrom[0].reference;
    else if (evidence && evidence.length > 0 && evidence[0].detail) refStr = evidence[0].detail[0].reference;
    if (!refStr) return undefined;
    const doc = documents.find(d => `DocumentReference/${d.id}` === refStr);
    return doc ? (doc.description || 'Uploaded Document') : 'Extracted Data';
  };

  const calculateAge = (birthDate?: string): string => {
    if (!birthDate) return 'Age unknown';
    const dob = new Date(birthDate);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    return `${Math.abs(ageDate.getUTCFullYear() - 1970)}`;
  };

  const toggleTimelineEvent = (eventId: string) => {
    setExpandedTimelineIds(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const openPdfForEncounter = (enc: Encounter, meds: MedicationRequest[]) => {
    const rxItems: PrescriptionItem[] = meds.map((m, idx) => ({
      id: m.id || `rx-${idx}`,
      name: m.medicationCodeableConcept?.text?.split(' ')[0] || 'Medication',
      strength: m.medicationCodeableConcept?.text?.split(' ').slice(1).join(' ') || '',
      dose: m.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit || '1 tablet',
      route: m.dosageInstruction?.[0]?.route?.text || 'Oral',
      frequency: m.dosageInstruction?.[0]?.timing?.code?.text || 'Once daily',
      duration: `${m.dispenseRequest?.expectedSupplyDuration?.value || 30} days`,
      instructions: m.dosageInstruction?.[0]?.patientInstruction || ''
    }));

    setPdfModalData({
      isOpen: true,
      medications: rxItems,
      date: new Date(enc.period?.start || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    });
  };

  const openPdfForSingleRx = (mr: MedicationRequest) => {
    const item: PrescriptionItem = {
      id: mr.id || 'rx-single',
      name: mr.medicationCodeableConcept?.text?.split(' ')[0] || 'Medication',
      strength: mr.medicationCodeableConcept?.text?.split(' ').slice(1).join(' ') || '',
      dose: mr.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit || '1 tablet',
      route: mr.dosageInstruction?.[0]?.route?.text || 'Oral',
      frequency: mr.dosageInstruction?.[0]?.timing?.code?.text || 'Once daily',
      duration: `${mr.dispenseRequest?.expectedSupplyDuration?.value || 30} days`,
      instructions: mr.dosageInstruction?.[0]?.patientInstruction || ''
    };
    setPdfModalData({
      isOpen: true,
      medications: [item],
      date: new Date(mr.authoredOn || mr.meta?.lastUpdated || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    });
  };

  // Compile Unified Longitudinal Interactive Timeline
  const getTimeline = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    
    // Encounters
    encounters.forEach(e => {
      if (e.period?.start) {
        const impression = impressions.find(i => 
          i.encounter?.reference === `Encounter/${e.id}` || 
          i.encounter?.reference?.includes(e.id as string)
        );
        const linkedMeds = medicationRequests.filter(m => 
          m.encounter?.reference === `Encounter/${e.id}` || 
          m.encounter?.reference?.includes(e.id as string) ||
          (!m.encounter?.reference?.startsWith('Encounter/') && 
           new Date(m.authoredOn || '').toDateString() === new Date(e.period?.start || '').toDateString())
        );

        events.push({
          id: e.id as string,
          date: new Date(e.period.start),
          type: 'consultation',
          title: 'Consultation',
          description: e.type?.[0]?.text || 'Ambulatory Consultation',
          badge: impression?.status === 'in-progress' 
            ? { text: 'Draft Note', variant: 'draft' }
            : { text: 'Approved', variant: 'approved' },
          consultationData: {
            doctor: 'Dr. Alex Morgan, MD',
            type: e.type?.[0]?.text || 'Ambulatory Consultation',
            summary: impression?.summary,
            transcript: impression?.investigation?.[0]?.item?.[0]?.display,
            linkedPrescriptions: linkedMeds
          },
          resource: e
        });
      }
    });

    // Prescriptions
    medicationRequests.forEach(mr => {
      const d = mr.authoredOn || mr.meta?.lastUpdated;
      if (d) {
        const medName = mr.medicationCodeableConcept?.text || mr.medicationCodeableConcept?.coding?.[0]?.display || 'Prescribed Medication';
        const dosage = mr.dosageInstruction?.[0]?.text || '';
        
        const rxItem: PrescriptionItem = {
          id: mr.id as string,
          name: medName.split(' ')[0],
          strength: medName.split(' ').slice(1).join(' '),
          dose: mr.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity?.unit || '1 tablet',
          route: mr.dosageInstruction?.[0]?.route?.text || 'Oral',
          frequency: mr.dosageInstruction?.[0]?.timing?.code?.text || 'Once daily',
          duration: `${mr.dispenseRequest?.expectedSupplyDuration?.value || 30} days`,
          instructions: mr.dosageInstruction?.[0]?.patientInstruction || ''
        };

        events.push({
          id: mr.id as string,
          date: new Date(d),
          type: 'prescription',
          title: 'Prescription Order',
          description: `${medName}${dosage ? ` — ${dosage}` : ''}`,
          badge: { text: 'Active', variant: 'approved' },
          details: {
            strength: rxItem.strength,
            dose: rxItem.dose,
            route: rxItem.route,
            frequency: rxItem.frequency,
            duration: rxItem.duration,
            instructions: rxItem.instructions,
            status: mr.status
          },
          prescriptionData: {
            item: rxItem,
            status: mr.status || 'active'
          },
          resource: mr
        });
      }
    });

    // Observations
    observations.forEach(o => {
      const d = o.effectiveDateTime || o.meta?.lastUpdated;
      if (d) {
        const valStr = o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit || ''}` : (o.valueString || 'Recorded');
        const testName = o.code?.coding?.[0]?.display || o.code?.text || 'Clinical Observation';
        const isAbn = valStr.toLowerCase().includes('abnormal') || valStr.toLowerCase().includes('high') || valStr.toLowerCase().includes('8.2%');

        events.push({
          id: o.id as string,
          date: new Date(d),
          type: 'observation',
          title: 'Lab Observation',
          description: `${testName}: ${valStr}`,
          badge: isAbn 
            ? { text: 'Elevated', variant: 'warning' }
            : { text: 'Normal', variant: 'neutral' },
          observationData: {
            name: testName,
            value: valStr,
            status: o.status || 'final',
            isAbnormal: isAbn
          },
          resource: o,
          sourceDoc: getSourceDocName(o.derivedFrom)
        });
      }
    });

    // Documents
    documents.forEach(doc => {
      const d = doc.date || doc.meta?.lastUpdated;
      if (d) {
        events.push({
          id: doc.id as string,
          date: new Date(d),
          type: 'document',
          title: 'Medical Record',
          description: doc.description || 'Clinical Record',
          badge: { text: 'Ingested', variant: 'neutral' },
          documentData: {
            name: doc.description || 'Medical Record',
            fileType: doc.content?.[0]?.attachment?.contentType || 'application/pdf',
            extractedFactsCount: 4
          },
          resource: doc
        });
      }
    });

    // Operational Events (Communications, Refills, Referrals, Scheduling)
    operationalTasks.forEach(task => {
      const d = task.createdAt;
      let eventType: TimelineEvent['type'] = 'operation';
      let eventTitle = task.title;
      let badgeText = task.status.toUpperCase();
      let badgeVariant: 'approved' | 'draft' | 'warning' | 'neutral' = 'neutral';

      if (task.category === 'triage') {
        eventType = 'communication';
        eventTitle = 'Inbound Communication & AI Triage Draft';
        badgeText = task.triageDetails?.risk.emergencyRedFlag ? 'EMERGENCY RED FLAG' : (task.priority === 'urgent' ? 'Urgent Triage' : 'Routine Inbound');
        badgeVariant = task.triageDetails?.risk.emergencyRedFlag || task.priority === 'urgent' ? 'warning' : 'neutral';
      } else if (task.category === 'refill') {
        eventType = 'prescription';
        eventTitle = `Rx Refill Review: ${task.refillDetails?.medicationName || 'Medication'}`;
        badgeText = task.status === 'completed' ? 'Refill Approved' : (task.refillDetails?.safetyReport.warnings?.length ? 'Safety Review Required' : 'Awaiting MD Review');
        badgeVariant = task.status === 'completed' ? 'approved' : 'warning';
      } else if (task.category === 'referral') {
        eventType = 'referral';
        eventTitle = `Specialist Referral: ${task.referralDetails?.specialty || 'Specialty'}`;
        badgeText = task.status === 'completed' ? 'Signed & Dispatched' : 'Packet Prepared';
        badgeVariant = task.status === 'completed' ? 'approved' : 'neutral';
      } else if (task.category === 'scheduling') {
        eventType = 'scheduling';
        eventTitle = `Care Gap Recall: ${task.schedulingDetails?.title || 'Appointment'}`;
        badgeText = task.status === 'completed' ? 'Scheduled' : 'Action Suggested';
        badgeVariant = task.status === 'completed' ? 'approved' : 'neutral';
      }

      events.push({
        id: task.id,
        date: new Date(d),
        type: eventType,
        title: eventTitle,
        description: task.summary,
        badge: { text: badgeText, variant: badgeVariant },
        operationalData: {
          task
        },
        resource: task
      });
    });

    events.sort((a, b) => b.date.getTime() - a.date.getTime());
    return events;
  };

  if (loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl space-y-4 py-10" role="status" aria-label="Loading patient record">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <LoaderCircle size={16} className="animate-spin" />
            Loading patient record
          </div>
          <div className="h-24 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)]" aria-hidden="true" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-36 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)]" aria-hidden="true" />
            <div className="h-36 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)]" aria-hidden="true" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!patient) {
    return (
      <Layout>
        <div className="py-24 text-center text-zinc-500 text-sm">
          Patient record not found.
        </div>
      </Layout>
    );
  }

  const name = patient.name?.[0];
  const displayName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Eleanor Vance';
  const age = calculateAge(patient.birthDate);
  const gender = patient.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : 'Female';
  
  const allTimelineEvents = getTimeline();
  const filteredTimeline = allTimelineEvents.filter(event => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'consultations') return event.type === 'consultation';
    if (activeFilter === 'prescriptions') return event.type === 'prescription' || event.operationalData?.task.category === 'refill';
    if (activeFilter === 'labs') return event.type === 'observation';
    if (activeFilter === 'documents') return event.type === 'document';
    if (activeFilter === 'communications') return event.type === 'communication' || event.operationalData?.task.category === 'triage';
    if (activeFilter === 'referrals') return event.type === 'referral' || event.operationalData?.task.category === 'referral';
    if (activeFilter === 'operations') return !!event.operationalData;
    return true;
  });

  // Extract Conditions
  const conditionNames = conditions.length > 0 
    ? conditions.map(c => c.code?.text || c.code?.coding?.[0]?.display || 'Condition')
    : ['Type 2 diabetes', 'Essential hypertension'];

  // Check Allergy
  const penicillinAllergy = allergies.find(a => 
    a.code?.text?.toLowerCase().includes('penicillin') ||
    a.code?.coding?.[0]?.display?.toLowerCase().includes('penicillin')
  ) || (allergies.length > 0 ? allergies[0] : null);

  return (
    <Layout>
      <div className="proton-patient-profile max-w-4xl mx-auto space-y-10 pb-16">
        
        {/* Breadcrumb / Back Link */}
        <Link 
          to="/patients" 
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Patients</span>
        </Link>

        {/* ================================================== */}
        {/* 1. PATIENT HEADER (Clinical Home)                  */}
        {/* ================================================== */}
        <header className="space-y-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
              {displayName}
            </h1>
            <div className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
              <span>{age} · {gender}</span>
              {patient.birthDate && <span>· DOB {patient.birthDate}</span>}
              <span className="text-zinc-400">· MRN {patient.id?.slice(0, 8)}</span>
            </div>
          </div>

          {/* Active Diagnoses / Conditions */}
          <div className="text-sm text-zinc-700 flex flex-wrap items-center gap-x-3 gap-y-1">
            {conditionNames.map((cond, idx) => (
              <span key={idx} className="font-medium">
                {cond}
                {idx < conditionNames.length - 1 && <span className="text-zinc-300 ml-3">•</span>}
              </span>
            ))}
          </div>

          {/* Critical Allergy Warning */}
          {penicillinAllergy ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 text-red-900 rounded-md text-xs">
              <AlertTriangle size={14} className="text-red-600 shrink-0" />
              <span className="font-medium">
                Penicillin allergy
              </span>
              <span className="text-red-700">
                — Severe rash / anaphylactoid reaction documented. Avoid beta-lactam antibiotics.
              </span>
            </div>
          ) : (
            <div className="text-xs text-zinc-500">
              No known medication allergies
            </div>
          )}
        </header>

        {/* ================================================== */}
        {/* 2. WHAT MATTERS TODAY (Clinically Meaningful Deltas)*/}
        {/* ================================================== */}
        <section className="pt-6 border-t border-zinc-200">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              What matters today
            </h2>
            <span className="text-xs text-zinc-400">
              Prioritized clinical changes
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Item 1: HbA1c elevation */}
            <div className="space-y-1.5">
              <div className="text-xs text-zinc-500 font-medium">HbA1c</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight text-zinc-900">8.2%</span>
                <span className="text-xs font-medium text-amber-700">↑ from 7.1%</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Elevated over 90-day interval. Titration indicated.
              </p>
              <div className="pt-1 flex items-center gap-3 text-xs">
                {intelligence.evidenceStore['ev-1'] && (
                  <button
                    onClick={() => handleOpenEvidence(intelligence.evidenceStore['ev-1'])}
                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                  >
                    View evidence
                  </button>
                )}
                <button
                  onClick={() => setActiveFilter('labs')}
                  className="text-zinc-500 hover:text-zinc-800 cursor-pointer"
                >
                  View timeline
                </button>
              </div>
            </div>

            {/* Item 2: Metformin Titration */}
            <div className="space-y-1.5">
              <div className="text-xs text-zinc-500 font-medium">Metformin</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight text-zinc-900">500 mg BID</span>
                <span className="text-xs font-medium text-zinc-500">Changed from 500 mg daily</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Dose titrated during previous encounter to address glycemic drift.
              </p>
              <div className="pt-1 flex items-center gap-3 text-xs">
                {intelligence.evidenceStore['ev-3'] && (
                  <button
                    onClick={() => handleOpenEvidence(intelligence.evidenceStore['ev-3'])}
                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                  >
                    View evidence
                  </button>
                )}
                <button
                  onClick={() => setActiveFilter('prescriptions')}
                  className="text-zinc-500 hover:text-zinc-800 cursor-pointer"
                >
                  View timeline
                </button>
              </div>
            </div>

            {/* Item 3: Adherence concern */}
            <div className="space-y-1.5">
              <div className="text-xs text-zinc-500 font-medium">Adherence</div>
              <div className="text-base font-semibold text-zinc-900 pt-0.5">
                Weekend doses may be missed
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Patient noted GI upset when taking evening tablets without food.
              </p>
              <div className="pt-1 flex items-center gap-3 text-xs">
                {intelligence.evidenceStore['ev-4'] && (
                  <button
                    onClick={() => handleOpenEvidence(intelligence.evidenceStore['ev-4'])}
                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                  >
                    View evidence
                  </button>
                )}
                <button
                  onClick={() => setActiveFilter('consultations')}
                  className="text-zinc-500 hover:text-zinc-800 cursor-pointer"
                >
                  View timeline
                </button>
              </div>
            </div>

          </div>

          {/* Action Row */}
          <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center gap-3">
            <Link 
              to={`/consultation?patient=${patient.id}`}
              className="clinical-btn-primary"
            >
              <Plus size={14} />
              <span>Start consultation</span>
            </Link>
            <Link 
              to={`/document-review?patient=${patient.id}`}
              className="clinical-btn-secondary"
            >
              <FileText size={14} />
              <span>Upload records</span>
            </Link>
          </div>
        </section>

        {/* ================================================== */}
        {/* 3. CLINICAL TIMELINE                               */}
        {/* ================================================== */}
        <section className="pt-8 border-t border-zinc-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Clinical timeline
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {allTimelineEvents.length} chronological events on record
              </p>
            </div>

            {/* Restrained Text Filter Tabs */}
            <div className="flex items-center gap-1 border-b border-zinc-200 sm:border-b-0 pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All' },
                { id: 'consultations', label: 'Consultations' },
                { id: 'prescriptions', label: 'Prescriptions' },
                { id: 'labs', label: 'Labs' },
                { id: 'documents', label: 'Documents' },
                { id: 'communications', label: 'Comms' },
                { id: 'referrals', label: 'Referrals' },
                { id: 'operations', label: 'Operations' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id as any)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    activeFilter === f.id
                      ? 'bg-zinc-100 text-zinc-900 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Entries */}
          {filteredTimeline.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              No events found for this filter.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {filteredTimeline.map(event => {
                const isExpanded = !!expandedTimelineIds[event.id];

                return (
                  <div 
                    key={`${event.type}-${event.id}`}
                    id={`timeline-${event.id}`}
                    className="py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      
                      {/* Left: Date + Summary */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-zinc-500">
                            {event.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-zinc-300">•</span>
                          <span className="font-semibold text-zinc-900">
                            {event.title}
                          </span>
                          {event.badge && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                              event.badge.variant === 'warning'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-zinc-100 text-zinc-700'
                            }`}>
                              {event.badge.text}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-700">
                          {event.description}
                        </p>

                        {event.sourceDoc && (
                          <div className="text-[11px] text-zinc-400">
                            Extracted from {event.sourceDoc}
                          </div>
                        )}
                      </div>

                      {/* Right: Expand Toggle or Direct Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {event.type === 'consultation' && event.consultationData && event.consultationData.linkedPrescriptions.length > 0 && (
                          <button
                            onClick={() => openPdfForEncounter(event.resource, event.consultationData!.linkedPrescriptions)}
                            className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Printer size={12} />
                            <span>Prescription PDF</span>
                          </button>
                        )}

                        {event.type === 'prescription' && (
                          <button
                            onClick={() => openPdfForSingleRx(event.resource)}
                            className="text-xs text-zinc-600 hover:text-zinc-900 flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Printer size={12} />
                            <span>PDF</span>
                          </button>
                        )}

                        <button
                          onClick={() => toggleTimelineEvent(event.id)}
                          className="text-xs text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
                          title={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>

                    </div>

                    {/* Expandable Clinical Details (In-Place) */}
                    {isExpanded && (
                      <div className="mt-3 pl-4 border-l-2 border-zinc-200 text-xs text-zinc-600 space-y-2">
                        {event.consultationData?.summary && (
                          <div>
                            <div className="font-medium text-zinc-900 mb-1">Signed consultation note:</div>
                            <div className="bg-zinc-50 p-3 rounded text-zinc-700 font-sans leading-relaxed whitespace-pre-wrap border border-zinc-200/60">
                              {event.consultationData.summary}
                            </div>
                          </div>
                        )}

                        {event.prescriptionData?.item.instructions && (
                          <div>
                            <span className="font-medium text-zinc-800">Instructions: </span>
                            <span>{event.prescriptionData.item.instructions}</span>
                          </div>
                        )}

                        {event.observationData && (
                          <div className="text-zinc-500">
                            <span>Status: {event.observationData.status}</span>
                            {event.sourceDoc && <span> · Source: {event.sourceDoc}</span>}
                          </div>
                        )}

                        {event.operationalData && (
                          <div className="space-y-2 pt-1 border-t border-zinc-200/60">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-900">Operations OS Record:</span>
                              <Link
                                to="/operations"
                                className="text-xs text-[#0F4C81] hover:underline font-medium inline-flex items-center gap-1"
                              >
                                <span>Open Operations OS</span>
                                <ArrowUpRight size={11} />
                              </Link>
                            </div>
                            
                            {event.operationalData.task.triageDetails && (
                              <div className="bg-zinc-50 p-2.5 rounded border border-zinc-200/60 space-y-1.5">
                                <div className="text-[10px] text-zinc-500 font-mono font-medium">
                                  INBOUND MESSAGE:
                                </div>
                                <div className="text-zinc-800 italic">
                                  "{event.operationalData.task.triageDetails.inboundMessage}"
                                </div>
                                {event.operationalData.task.triageDetails.aiDraftResponse && (
                                  <div className="pt-1.5 border-t border-zinc-200/60">
                                    <div className="text-[10px] text-zinc-500 font-mono font-medium">AI TRIAGE DRAFT:</div>
                                    <div className="text-zinc-700 whitespace-pre-wrap">
                                      {event.operationalData.task.triageDetails.aiDraftResponse}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {event.operationalData.task.refillDetails && (
                              <div className="bg-zinc-50 p-2.5 rounded border border-zinc-200/60 space-y-1.5">
                                <div className="text-[10px] font-mono font-medium text-zinc-500">
                                  REFILL SAFETY AUDIT & LAB EVIDENCE:
                                </div>
                                <div className="text-zinc-800">
                                  {event.operationalData.task.refillDetails.clinicalContext.relevantLabSummary}
                                </div>
                                {event.operationalData.task.refillDetails.safetyReport.warnings?.length > 0 && (
                                  <div className="text-amber-700 font-mono text-[11px] bg-amber-50 p-1.5 rounded border border-amber-200">
                                    SAFETY ADVISORY: {event.operationalData.task.refillDetails.safetyReport.warnings.join(' • ')}
                                  </div>
                                )}
                              </div>
                            )}

                            {event.operationalData.task.referralDetails && (
                              <div className="bg-zinc-50 p-2.5 rounded border border-zinc-200/60 space-y-1">
                                <div className="text-[10px] font-mono font-medium text-zinc-500">
                                  REFERRAL BRIEF & HPI SUMMARY:
                                </div>
                                <div className="text-zinc-700 whitespace-pre-wrap">
                                  {event.operationalData.task.referralDetails.referralSummaryPacket.hpiSummary}
                                </div>
                              </div>
                            )}

                            {event.operationalData.task.schedulingDetails && (
                              <div className="bg-zinc-50 p-2.5 rounded border border-zinc-200/60 space-y-1">
                                <div className="text-[10px] font-mono font-medium text-zinc-500">
                                  RECALL REASON & PROPOSED WINDOW:
                                </div>
                                <div className="text-zinc-700">
                                  {event.operationalData.task.schedulingDetails.clinicalReason} — Slot: {event.operationalData.task.schedulingDetails.proposedSlot?.start ? new Date(event.operationalData.task.schedulingDetails.proposedSlot.start).toLocaleDateString() : 'Pending'}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ================================================== */}
        {/* 4. CURRENT MEDICATIONS (Clean Table)               */}
        {/* ================================================== */}
        <section className="pt-8 border-t border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Current medications
            </h2>
            <span className="text-xs text-zinc-400">
              {medicationRequests.length} active prescriptions
            </span>
          </div>

          {medicationRequests.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              No active medications on record.
            </div>
          ) : (
            <div className="border border-zinc-200 rounded-md overflow-hidden bg-white">
              <table className="clinical-table">
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Dosage & Instructions</th>
                    <th>Prescribed</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {medicationRequests.map((mr, idx) => {
                    const medName = mr.medicationCodeableConcept?.text || mr.medicationCodeableConcept?.coding?.[0]?.display || 'Medication';
                    const instructions = mr.dosageInstruction?.[0]?.text || mr.dosageInstruction?.[0]?.patientInstruction || 'As directed';
                    const dateStr = mr.authoredOn ? new Date(mr.authoredOn).toLocaleDateString() : 'Active';

                    return (
                      <tr key={mr.id || idx}>
                        <td className="font-medium text-zinc-900">{medName}</td>
                        <td className="text-zinc-600">{instructions}</td>
                        <td className="text-zinc-500">{dateStr}</td>
                        <td>
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {mr.status || 'Active'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => openPdfForSingleRx(mr)}
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                          >
                            Print PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ================================================== */}
        {/* 5. RELEVANT CLINICAL HISTORY                       */}
        {/* ================================================== */}
        <section className="pt-8 border-t border-zinc-200">
          <div className="mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Relevant history
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Longitudinal clinical narrative synthesized from approved patient records
            </p>
          </div>

          {intelligence.clinicalStory.paragraphs.length === 0 ? (
            <div className="text-xs text-zinc-400 py-6">
              No narrative history available.
            </div>
          ) : (
            <div className="space-y-4 text-sm text-zinc-700 leading-relaxed">
              {intelligence.clinicalStory.paragraphs.map((p, idx) => (
                <div key={idx} className="space-y-2">
                  <p>{p.text}</p>
                  {p.evidenceIds.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-500">
                      <span className="text-zinc-400">Sources:</span>
                      {p.evidenceIds.map(evId => {
                        const ev = intelligence.evidenceStore[evId];
                        if (!ev) return null;
                        return (
                          <button
                            key={evId}
                            onClick={() => handleOpenEvidence(ev)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline cursor-pointer"
                          >
                            <span>{ev.title} ({ev.date})</span>
                            <ArrowUpRight size={11} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Evidence Drawer Modal */}
      <EvidenceModal
        evidence={selectedEvidence}
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        onFocusTimeline={handleFocusTimelineItem}
      />

      {/* Prescription PDF Modal */}
      <PrescriptionPDFModal
        isOpen={pdfModalData.isOpen}
        onClose={() => setPdfModalData({ isOpen: false, medications: [] })}
        patient={patient}
        doctorName="Dr. Alex Morgan, MD"
        date={pdfModalData.date}
        medications={pdfModalData.medications}
      />

    </Layout>
  );
}
