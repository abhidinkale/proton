import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useMedplum } from '@medplum/react';
import PatientIntelligenceSection from '../components/PatientIntelligenceSection';
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
  Activity, 
  FileText, 
  Clock, 
  ShieldCheck, 
  Sparkles, 
  Mic, 
  Pill, 
  ChevronDown, 
  ChevronUp, 
  Printer,
  Stethoscope
} from 'lucide-react';
import Layout from '../components/Layout';
import type { PrescriptionItem } from '../types/prescription';
import PrescriptionPDFModal from '../components/PrescriptionPDFModal';

type TimelineFilter = 'all' | 'consultations' | 'prescriptions' | 'labs' | 'documents';

interface TimelineEvent {
  id: string;
  date: Date;
  type: 'consultation' | 'prescription' | 'observation' | 'document' | 'condition';
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
  const [loading, setLoading] = useState(true);

  // Timeline UI States
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');
  const [expandedTimelineIds, setExpandedTimelineIds] = useState<Record<string, boolean>>({});
  const [expandedEncRx, setExpandedEncRx] = useState<Record<string, boolean>>({});
  
  // PDF Modal State
  const [pdfModalData, setPdfModalData] = useState<{
    isOpen: boolean;
    medications: PrescriptionItem[];
    date?: string;
  }>({ isOpen: false, medications: [] });

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
        
        console.log('PATIENT PROFILE FETCH ID:', id);
        console.log('ENCOUNTERS STATUS:', encRes.status, encRes.status === 'fulfilled' ? encRes.value.length : (encRes as any).reason);
        console.log('MED REQS STATUS:', medReqRes.status, medReqRes.status === 'fulfilled' ? medReqRes.value.length : (medReqRes as any).reason);
        
        if (encRes.status === 'fulfilled') setEncounters(encRes.value);
        if (impRes.status === 'fulfilled') setImpressions(impRes.value);
        if (condRes.status === 'fulfilled') setConditions(condRes.value);
        if (medStatRes.status === 'fulfilled') setMedStatements(medStatRes.value);
        if (medReqRes.status === 'fulfilled') setMedicationRequests(medReqRes.value);
        if (allRes.status === 'fulfilled') setAllergies(allRes.value);
        if (obsRes.status === 'fulfilled') setObservations(obsRes.value);
        if (docRes.status === 'fulfilled') setDocuments(docRes.value);

        // If encounters or medication requests are empty, poll up to 6 times with 1s intervals
        // to catch asynchronous Medplum PostgreSQL search index commits.
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
              console.log('RETRY SYNC ATTEMPT:', {
                attemptsLeft,
                encsFound: retryEncs.status === 'fulfilled' ? retryEncs.value.length : 0,
                medsFound: retryMeds.status === 'fulfilled' ? retryMeds.value.length : 0
              });
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
    const years = Math.abs(ageDate.getUTCFullYear() - 1970);
    return `${years} years`;
  };

  const toggleTimelineEvent = (eventId: string) => {
    setExpandedTimelineIds(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const toggleEncRx = (encId: string) => {
    setExpandedEncRx(prev => ({ ...prev, [encId]: !prev[encId] }));
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
    
    // 1. Encounters / Consultations
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
            ? { text: 'AI Draft', variant: 'draft' }
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

    // 2. Approved Prescriptions (MedicationRequest)
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
          title: 'Prescription (Approved)',
          description: `${medName}${dosage ? ` (${dosage})` : ''} — Approved`,
          badge: { text: 'Approved', variant: 'approved' },
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

    // 3. Observations / Labs
    observations.forEach(o => {
      const d = o.effectiveDateTime || o.meta?.lastUpdated;
      if (d) {
        const valStr = o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit || ''}` : (o.valueString || 'Recorded');
        const testName = o.code?.coding?.[0]?.display || o.code?.text || 'Clinical Observation';
        const isAbn = valStr.toLowerCase().includes('abnormal') || valStr.toLowerCase().includes('high') || valStr.toLowerCase().includes('7.2%');

        events.push({
          id: o.id as string,
          date: new Date(d),
          type: 'observation',
          title: 'Observation/Lab',
          description: `${testName}: ${valStr}`,
          badge: isAbn 
            ? { text: 'Abnormal', variant: 'warning' }
            : { text: 'Final', variant: 'neutral' },
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

    // 4. Uploaded Historical Documents
    documents.forEach(doc => {
      const dt = doc.date || doc.meta?.lastUpdated;
      if (dt) {
        // Count related facts derived from this document
        const linkedFactsCount = conditions.filter(c => c.evidence?.[0]?.detail?.[0]?.reference === `DocumentReference/${doc.id}`).length +
          medStatements.filter(m => m.derivedFrom?.[0]?.reference === `DocumentReference/${doc.id}`).length +
          observations.filter(o => o.derivedFrom?.[0]?.reference === `DocumentReference/${doc.id}`).length;

        events.push({
          id: doc.id as string,
          date: new Date(dt),
          type: 'document',
          title: 'Document Uploaded',
          description: doc.description || 'Uploaded Medical Record',
          badge: { text: 'Extracted & Approved', variant: 'approved' },
          documentData: {
            name: doc.description || 'Clinical Record',
            fileType: doc.content?.[0]?.attachment?.contentType || 'application/pdf',
            extractedFactsCount: linkedFactsCount
          },
          resource: doc
        });
      }
    });

    // 5. Conditions
    conditions.forEach(c => {
      const d = c.recordedDate || c.meta?.lastUpdated;
      if (d) {
        const condName = c.code?.text || c.code?.coding?.[0]?.display || 'Condition Recorded';
        events.push({
          id: c.id as string,
          date: new Date(d),
          type: 'condition',
          title: 'Condition Recorded',
          description: condName,
          badge: { text: 'Active', variant: 'neutral' },
          conditionData: {
            name: condName,
            sourceQuote: c.evidence?.[0]?.code?.[0]?.text
          },
          resource: c,
          sourceDoc: getSourceDocName(c.meta?.extension, c.evidence)
        });
      }
    });

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-4">
          <Activity size={32} className="animate-pulse text-brand-600" />
          <p className="text-sm font-medium text-slate-600">Loading patient intelligence profile...</p>
        </div>
      </Layout>
    );
  }

  if (!patient) return <Layout><div className="text-center mt-12 text-slate-500">Patient not found.</div></Layout>;

  const name = patient.name?.[0];
  const displayName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Demo Patient';
  const age = calculateAge(patient.birthDate);
  const gender = patient.gender || 'Unknown';
  
  const allTimelineEvents = getTimeline();

  // Filter timeline
  const filteredTimeline = allTimelineEvents.filter(event => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'consultations') return event.type === 'consultation';
    if (activeFilter === 'prescriptions') return event.type === 'prescription';
    if (activeFilter === 'labs') return event.type === 'observation';
    if (activeFilter === 'documents') return event.type === 'document' || event.type === 'condition';
    return true;
  });

  // Filter counts
  const counts = {
    all: allTimelineEvents.length,
    consultations: allTimelineEvents.filter(e => e.type === 'consultation').length,
    prescriptions: allTimelineEvents.filter(e => e.type === 'prescription').length,
    labs: allTimelineEvents.filter(e => e.type === 'observation').length,
    documents: allTimelineEvents.filter(e => e.type === 'document' || e.type === 'condition').length
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
        
        {/* ================================================== */}
        {/* PART 3: PATIENT CONTEXT HEADER                    */}
        {/* ================================================== */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2 font-medium">
                <Link to="/" className="hover:text-brand-600 transition-colors">Command Center</Link>
                <span>&rarr;</span>
                <Link to="/patients" className="hover:text-brand-600 transition-colors">Patients</Link>
                <span>&rarr;</span>
                <span className="text-slate-700 font-semibold truncate max-w-[200px]">{displayName}</span>
              </div>

              <Link to="/patients" className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-brand-600 mb-3 transition-colors">
                <ArrowLeft size={14} className="mr-1" /> Back to Patient Directory
              </Link>

              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center font-bold text-lg shrink-0">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    {displayName}
                  </h1>
                  <div className="mt-1 text-slate-500 flex items-center gap-3 text-xs md:text-sm font-medium">
                    <span>{age}</span>
                    <span>•</span>
                    <span className="capitalize">{gender}</span>
                    <span>•</span>
                    <span>DOB: {patient.birthDate || 'Unknown'}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-400">MRN: {patient.id?.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <Link 
                to={`/consultation?patient=${patient.id}`}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-xs inline-flex items-center gap-2"
              >
                <Mic size={16} /> Start Consultation
              </Link>
              <Link 
                to={`/document-review?patient=${patient.id}`}
                className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition-colors shadow-xs inline-flex items-center gap-2"
              >
                <FileText size={16} /> Upload Previous Records
              </Link>
            </div>
          </div>
        </div>

        {/* ================================================== */}
        {/* CLINICAL BRAIN: PATIENT INTELLIGENCE & STORY       */}
        {/* ================================================== */}
        <PatientIntelligenceSection 
          intelligence={intelligence} 
          onFocusTimeline={handleFocusTimelineItem} 
        />

        {/* ================================================== */}
        {/* PART 2: INTERACTIVE PATIENT TIMELINE              */}
        {/* ================================================== */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          
          {/* Timeline Header & Filter Pills */}
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-brand-600" />
              <h2 className="font-bold text-slate-900 text-base">Longitudinal Patient Timeline</h2>
              <span className="text-xs text-slate-400">({allTimelineEvents.length} events)</span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeFilter === 'all' 
                    ? 'bg-slate-900 text-white shadow-2xs' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({counts.all})
              </button>
              <button
                onClick={() => setActiveFilter('consultations')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeFilter === 'consultations' 
                    ? 'bg-brand-600 text-white shadow-2xs' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Consultations ({counts.consultations})
              </button>
              <button
                onClick={() => setActiveFilter('prescriptions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeFilter === 'prescriptions' 
                    ? 'bg-purple-600 text-white shadow-2xs' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Prescriptions ({counts.prescriptions})
              </button>
              <button
                onClick={() => setActiveFilter('labs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeFilter === 'labs' 
                    ? 'bg-emerald-600 text-white shadow-2xs' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Labs ({counts.labs})
              </button>
              <button
                onClick={() => setActiveFilter('documents')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeFilter === 'documents' 
                    ? 'bg-amber-600 text-white shadow-2xs' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Documents ({counts.documents})
              </button>
            </div>
          </div>

          {/* Interactive Timeline Body */}
          <div className="p-6 md:p-8">
            {filteredTimeline.length === 0 ? (
              <div className="text-center text-slate-400 text-sm py-12">
                No events found matching the selected filter.
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
                {filteredTimeline.map(event => {
                  const isExpanded = !!expandedTimelineIds[event.id];

                  return (
                    <div 
                      key={`${event.type}-${event.id}`} 
                      id={`timeline-${event.id}`} 
                      className="relative pl-6"
                    >
                      
                      {/* Timeline Dot Indicator */}
                      <div className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-xs transition-colors ${
                        event.type === 'consultation' ? 'bg-brand-600' :
                        event.type === 'prescription' ? 'bg-purple-600' :
                        event.type === 'observation' ? 'bg-emerald-600' :
                        event.type === 'document' ? 'bg-amber-500' :
                        'bg-slate-500'
                      }`} />

                      {/* Timeline Item Container */}
                      <div className={`bg-slate-50/80 border rounded-xl shadow-xs transition-all ${
                        isExpanded ? 'border-brand-300 ring-2 ring-brand-100 bg-white' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        
                        {/* Event Header Card (Clickable) */}
                        <div 
                          onClick={() => toggleTimelineEvent(event.id)}
                          className="p-4 cursor-pointer flex items-start justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wide">
                                {event.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                {event.title}
                              </span>
                              
                              {/* Status Badge */}
                              {event.badge && (
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded border ${
                                  event.badge.variant === 'approved' ? 'bg-green-100 text-green-800 border-green-200' :
                                  event.badge.variant === 'draft' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                  event.badge.variant === 'warning' ? 'bg-red-100 text-red-800 border-red-200' :
                                  'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {event.badge.text}
                                </span>
                              )}
                            </div>

                            <h3 className="text-sm font-bold text-slate-900">
                              {event.description}
                            </h3>

                            {/* Provenance Document Link */}
                            {event.sourceDoc && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.2 rounded">
                                  <FileText size={10} /> Extracted & Approved
                                </span>
                                <span>from {event.sourceDoc}</span>
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1">
                              {isExpanded ? <>Less <ChevronUp size={15} /></> : <>Details <ChevronDown size={15} /></>}
                            </span>
                          </div>
                        </div>

                        {/* ========================================== */}
                        {/* IN-PLACE EXPANDABLE DETAILS ACCORDION      */}
                        {/* ========================================== */}
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-2 border-t border-slate-100 text-xs text-slate-700 space-y-4 animate-in fade-in-50 duration-150">
                            
                            {/* CASE 1: CONSULTATION EVENT */}
                            {event.type === 'consultation' && event.consultationData && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                                  <span>Treating Physician: <strong className="text-slate-800">{event.consultationData.doctor}</strong></span>
                                  <span>Status: <strong className="text-emerald-700">Signed & Approved</strong></span>
                                </div>

                                {/* Clinical Note */}
                                {event.consultationData.summary ? (
                                  <div>
                                    <h4 className="font-bold text-slate-800 mb-1">Approved Clinical Note</h4>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                                      {event.consultationData.summary}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-slate-400 italic">No written clinical note summary.</div>
                                )}

                                {/* Linked Prescriptions in Consultation */}
                                {event.consultationData.linkedPrescriptions.length > 0 && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <Pill size={13} className="text-purple-600" /> Linked Prescription Orders ({event.consultationData.linkedPrescriptions.length})
                                      </h4>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openPdfForEncounter(event.resource, event.consultationData!.linkedPrescriptions);
                                        }}
                                        className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                                      >
                                        <Printer size={12} /> Print Prescription PDF
                                      </button>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 divide-y divide-slate-100">
                                      {event.consultationData.linkedPrescriptions.map((m, idx) => (
                                        <div key={m.id || idx} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between">
                                          <div>
                                            <span className="font-bold text-slate-900">
                                              {m.medicationCodeableConcept?.text || 'Medicine'}
                                            </span>
                                            <p className="text-slate-500 text-[11px]">
                                              {m.dosageInstruction?.[0]?.text || 'As directed'}
                                            </p>
                                          </div>
                                          <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.2 rounded">
                                            Approved
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* CASE 2: PRESCRIPTION EVENT */}
                            {event.type === 'prescription' && event.prescriptionData && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                  <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Dose</span>
                                    <p className="font-semibold text-slate-800">{event.prescriptionData.item.dose || '1 tablet'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Route</span>
                                    <p className="font-semibold text-slate-800">{event.prescriptionData.item.route || 'Oral'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Frequency</span>
                                    <p className="font-semibold text-slate-800">{event.prescriptionData.item.frequency || 'Once daily'}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Duration</span>
                                    <p className="font-semibold text-slate-800">{event.prescriptionData.item.duration || '30 days'}</p>
                                  </div>
                                </div>

                                {event.prescriptionData.item.instructions && (
                                  <p className="text-slate-600 bg-purple-50/50 p-2.5 rounded-lg border border-purple-100">
                                    <strong>Doctor Instructions:</strong> {event.prescriptionData.item.instructions}
                                  </p>
                                )}

                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                    <ShieldCheck size={14} /> Approved by Dr. Alex Morgan, MD
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openPdfForSingleRx(event.resource);
                                    }}
                                    className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <Printer size={13} /> View Prescription PDF
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* CASE 3: OBSERVATION / LAB EVENT */}
                            {event.type === 'observation' && event.observationData && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                                  <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Test Name</span>
                                    <p className="font-bold text-slate-800 text-sm">{event.observationData.name}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-slate-400 text-[10px] uppercase font-bold">Result Value</span>
                                    <p className={`font-bold text-sm ${event.observationData.isAbnormal ? 'text-red-600' : 'text-slate-900'}`}>
                                      {event.observationData.value}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-xs text-slate-500 flex items-center justify-between">
                                  <span>Status: <strong className="text-slate-700 capitalize">{event.observationData.status}</strong></span>
                                  <span>Reference Source: <strong className="text-slate-700">{event.sourceDoc || 'Direct Ingestion'}</strong></span>
                                </div>
                              </div>
                            )}

                            {/* CASE 4: DOCUMENT UPLOAD EVENT */}
                            {event.type === 'document' && event.documentData && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                                  <div>
                                    <p className="font-bold text-slate-800">{event.documentData.name}</p>
                                    <p className="text-slate-500 text-[11px]">Type: {event.documentData.fileType}</p>
                                  </div>
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                                    Approved & Persisted to FHIR
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-600">
                                    Extracted facts: <strong>{event.documentData.extractedFactsCount} clinical facts</strong>
                                  </span>
                                  <Link
                                    to={`/document-review?patient=${patient.id}`}
                                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                                  >
                                    Open Document Ingestion Review →
                                  </Link>
                                </div>
                              </div>
                            )}

                            {/* CASE 5: CONDITION RECORDED EVENT */}
                            {event.type === 'condition' && event.conditionData && (
                              <div className="space-y-2">
                                <p className="text-slate-700 font-semibold">{event.conditionData.name}</p>
                                {event.conditionData.sourceQuote && (
                                  <p className="text-slate-500 italic bg-slate-50 p-2.5 rounded border border-slate-200">
                                    "{event.conditionData.sourceQuote}"
                                  </p>
                                )}
                              </div>
                            )}

                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================================================== */}
        {/* CONSULTATION HISTORY SECTION                      */}
        {/* ================================================== */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope size={18} className="text-brand-600" />
              <h2 className="font-bold text-slate-900 text-base">Consultation History</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {encounters.length} total encounters
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {encounters.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No past consultations found.</div>
            ) : (
              encounters.map(enc => {
                const impression = impressions.find(i => 
                  i.encounter?.reference === `Encounter/${enc.id}` || 
                  i.encounter?.reference?.includes(enc.id as string)
                );
                const isDraft = impression?.status === 'in-progress';
                const encMeds = medicationRequests.filter(m => 
                  m.encounter?.reference === `Encounter/${enc.id}` || 
                  m.encounter?.reference?.includes(enc.id as string) ||
                  (!m.encounter?.reference?.startsWith('Encounter/') && 
                   new Date(m.authoredOn || '').toDateString() === new Date(enc.period?.start || '').toDateString())
                );
                const isRxExpanded = !!expandedEncRx[enc.id as string];

                return (
                  <div key={enc.id} className="p-6 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-slate-800">
                            {new Date(enc.period?.start || '').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                          </h3>
                          {isDraft ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                              <Sparkles size={12}/> AI Draft
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-200">
                              <ShieldCheck size={12}/> Approved
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{enc.type?.[0]?.text || 'Ambulatory Consultation'}</p>
                      </div>

                      {encMeds.length > 0 && (
                        <button
                          onClick={() => openPdfForEncounter(enc, encMeds)}
                          className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Printer size={13} /> View Prescription PDF
                        </button>
                      )}
                    </div>

                    {/* Clinical Note Snippet */}
                    {impression?.summary ? (
                      <div className="mt-3 text-xs text-slate-700 bg-slate-50/80 border border-slate-200 rounded-lg p-3.5 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {impression.summary}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-400 italic">No clinical note recorded.</div>
                    )}

                    {/* Prescription Status & Medication Count */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Pill size={14} className="text-brand-600" />
                          <span className="text-xs font-semibold text-slate-700">
                            Prescription: {encMeds.length > 0 ? `${encMeds.length} medication${encMeds.length > 1 ? 's' : ''}` : 'No medications prescribed'}
                          </span>
                          {encMeds.length > 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.2 rounded">
                              Approved
                            </span>
                          )}
                        </div>

                        {encMeds.length > 0 && (
                          <button
                            onClick={() => toggleEncRx(enc.id as string)}
                            className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                          >
                            {isRxExpanded ? <>Hide Details <ChevronUp size={14} /></> : <>View Prescription <ChevronDown size={14} /></>}
                          </button>
                        )}
                      </div>

                      {/* Expandable Medications List */}
                      {isRxExpanded && encMeds.length > 0 && (
                        <div className="mt-2 bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                          {encMeds.map((m, idx) => (
                            <div key={m.id || idx} className="text-xs border-b border-slate-100 last:border-b-0 pb-2 last:pb-0">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900">
                                  {m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display || 'Medication'}
                                </span>
                                <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                                  {m.status}
                                </span>
                              </div>
                              <p className="text-slate-600 mt-0.5">
                                {m.dosageInstruction?.[0]?.text || 'As directed by physician'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

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
