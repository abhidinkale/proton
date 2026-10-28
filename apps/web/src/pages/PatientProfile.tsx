import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
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
  Plus, 
  LoaderCircle, 
  Sparkles, 
  Stethoscope, 
  Activity, 
  Pill, 
  Clock, 
  FileCheck, 
  AlertTriangle,
  Upload
} from 'lucide-react';
import Layout from '../components/Layout';
import type { PrescriptionItem } from '../types/prescription';
import PrescriptionPDFModal from '../components/PrescriptionPDFModal';
import { operationsService } from '../services/operationsService';
import type { OperationalTask } from '../types/operations';
import ProvenanceBadge from '../components/ui/ProvenanceBadge';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';
import { clinicApi, type ClinicNote, type PatientChart } from '../lib/clinicApi';
import { authService } from '../services/auth';

type ProfileTab = 'overview' | 'timeline' | 'documents';
type TimelineFilter = 'all' | 'consultations' | 'prescriptions' | 'labs' | 'documents';

interface TimelineEvent {
  id: string;
  date: Date;
  type: 'consultation' | 'prescription' | 'observation' | 'document' | 'operation';
  provenance: string;
  title: string;
  description: string;
  badge?: {
    text: string;
    variant: 'approved' | 'draft' | 'warning' | 'neutral';
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
  };
  operationalData?: {
    task: OperationalTask;
  };
  resource: any;
}

export default function PatientProfile() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [clinicChart, setClinicChart] = useState<PatientChart | null>(null);
  const [clinicNotes, setClinicNotes] = useState<ClinicNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Progressive Disclosure Tab state: Overview, Timeline, Documents
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  // Timeline UI States
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>('all');
  const [expandedTimelineIds, setExpandedTimelineIds] = useState<Record<string, boolean>>({});
  
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
        // The durable clinic workspace is authoritative for clinic-created and
        // clinic-edited patients. Try it before the frozen synthetic cohort.
        try {
          const chart = await clinicApi.getPatient(id);
          const record = chart.patient;
          const nameParts = String(record.name || '').trim().split(/\s+/);
          const family = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || '';
          const given = nameParts.length > 1 ? nameParts.slice(0, -1) : [nameParts[0] || ''];

          setClinicChart(chart);
          setClinicNotes(chart.notes || []);

          setPatient({
            resourceType: 'Patient',
            id: record.id,
            name: [{ family, given }],
            gender: (String(record.gender || 'unknown').toLowerCase() as Patient['gender']),
            birthDate: record.dob || undefined,
            telecom: record.patientPhone ? [{ system: 'phone', value: String(record.patientPhone) }] : undefined
          });

          const conditionList = (record.conditions || []).filter(Boolean);
          setConditions(conditionList.map((condition, index) => ({
            resourceType: 'Condition',
            id: `clinic-cond-${index}`,
            code: { text: String(condition) },
            clinicalStatus: { coding: [{ code: 'active' }] },
            subject: { reference: `Patient/${record.id}` }
          })));

          const allergyList = (record.allergies || []).filter(Boolean);
          setAllergies(allergyList.map((allergy, index) => {
            const label = String(allergy);
            return {
              resourceType: 'AllergyIntolerance',
              id: `clinic-allergy-${index}`,
              code: { text: label },
              criticality: /anaphyla|penicillin|severe/i.test(label) ? 'high' : 'low',
              patient: { reference: `Patient/${record.id}` }
            } as AllergyIntolerance;
          }));

          const medicationList = (record.medications || []).filter(Boolean);
          setMedicationRequests(medicationList.map((medication, index) => ({
            resourceType: 'MedicationRequest',
            id: `clinic-med-${index}`,
            status: 'active',
            intent: 'order',
            medicationCodeableConcept: { text: String(medication) },
            subject: { reference: `Patient/${record.id}` }
          })));

          const vitals = (record.vitals || {}) as Record<string, string>;
          const vitalsObs: Observation[] = Object.entries(vitals)
            .filter(([, value]) => Boolean(value))
            .map(([key, value], index) => ({
              resourceType: 'Observation',
              id: `clinic-vital-${index}`,
              code: { text: key },
              valueString: String(value),
              status: 'final',
              subject: { reference: `Patient/${record.id}` }
            }));

          const labObs: Observation[] = ((record.recentLabs || []) as Array<Record<string, unknown>>).map((lab, index) => {
            const abnormal = ['high', 'low', 'abnormal', 'critical'].includes(String(lab.status || '').toLowerCase());
            return {
              resourceType: 'Observation',
              id: `clinic-lab-${index}`,
              code: { text: String(lab.name || 'Lab result') },
              valueString: String(lab.value || ''),
              status: 'final',
              interpretation: abnormal
                ? [{ coding: [{ code: String(lab.status).toUpperCase().startsWith('H') ? 'H' : 'L' }] }]
                : undefined,
              note: lab.note ? [{ text: String(lab.note) }] : undefined,
              subject: { reference: `Patient/${record.id}` }
            } as Observation;
          });
          setObservations([...vitalsObs, ...labObs]);

          // Every persisted encounter note becomes a signed or draft visit.
          setEncounters((chart.notes || []).map((note) => ({
            resourceType: 'Encounter',
            id: note.id,
            status: note.status === 'SIGNED' ? 'finished' : 'in-progress',
            class: { code: 'AMB', display: 'Ambulatory' },
            type: [{ text: note.title }],
            reasonCode: [{ text: note.note?.assessment || note.note?.plan || 'Clinical encounter' }],
            subject: { reference: `Patient/${record.id}` },
            period: { start: note.signedAt || note.updatedAt || note.createdAt }
          })));

          setDocuments([]);
        } catch (clinicError) {
          console.warn('No durable clinic chart for this patient, checking local clinic schedule...', clinicError);
          const localMatch = TODAY_CLINIC_SCHEDULE.find(
            s => s.id === id || (s.id && id && (s.id.includes(id) || id.includes(s.id))) ||
                 s.name.toLowerCase() === id?.toLowerCase()
          );
          if (localMatch) {
            const parts = localMatch.name.split(' ');
            const family = parts.length > 1 ? parts[parts.length - 1] : parts[0];
            const given = parts.length > 1 ? parts.slice(0, -1) : [parts[0]];
            const synthPatient: Patient = {
              resourceType: 'Patient',
              id: localMatch.id,
              name: [{ family, given }],
              gender: localMatch.gender.toLowerCase() as any,
              birthDate: localMatch.dob,
              telecom: [{ system: 'phone', value: localMatch.patientPhone || '555-010-0000' }]
            };
            setPatient(synthPatient);

            setConditions(localMatch.conditions.map((c, idx) => ({
              resourceType: 'Condition',
              id: `cond-${idx}`,
              code: { text: c },
              clinicalStatus: { coding: [{ code: 'active' }] },
              subject: { reference: `Patient/${localMatch.id}` }
            })));

            setAllergies(localMatch.allergies.map((a, idx) => ({
              resourceType: 'AllergyIntolerance',
              id: `all-${idx}`,
              code: { text: a },
              criticality: a.toLowerCase().includes('anaphylaxis') || a.toLowerCase().includes('penicillin') ? 'high' : 'low',
              patient: { reference: `Patient/${localMatch.id}` }
            })));

            setMedicationRequests(localMatch.medications.map((m, idx) => ({
              resourceType: 'MedicationRequest',
              id: `med-${idx}`,
              status: 'active',
              intent: 'order',
              medicationCodeableConcept: { text: m },
              subject: { reference: `Patient/${localMatch.id}` }
            })));

            const synthObs: Observation[] = [
              {
                resourceType: 'Observation',
                id: 'obs-bp',
                code: { text: 'Blood Pressure' },
                valueString: localMatch.vitals.bp,
                status: 'final',
                subject: { reference: `Patient/${localMatch.id}` }
              },
              {
                resourceType: 'Observation',
                id: 'obs-hr',
                code: { text: 'Heart Rate' },
                valueString: localMatch.vitals.hr,
                status: 'final',
                subject: { reference: `Patient/${localMatch.id}` }
              },
              ...localMatch.recentLabs.map((l, idx) => ({
                resourceType: 'Observation' as const,
                id: `obs-lab-${idx}`,
                code: { text: l.name },
                valueString: l.value,
                status: 'final' as const,
                note: l.note ? [{ text: l.note }] : undefined,
                subject: { reference: `Patient/${localMatch.id}` }
              }))
            ];
            setObservations(synthObs);

            setEncounters([
              {
                resourceType: 'Encounter',
                id: localMatch.encounterId || `enc-${localMatch.id}`,
                status: 'finished',
                class: { code: 'AMB', display: 'Ambulatory' },
                type: [{ text: localMatch.visitType || 'Clinical Consultation' }],
                subject: { reference: `Patient/${localMatch.id}` },
                period: { start: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() }
              }
            ]);
          }
        }
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

  const calculateAge = (dob?: string) => {
    if (!dob) return 0;
    const birth = new Date(dob);
    const now = new Date();
    let a = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--;
    return a;
  };

  const toggleTimelineEvent = (eventId: string) => {
    setExpandedTimelineIds(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  const openPdfForEncounter = (enc: Encounter, linkedMeds: MedicationRequest[]) => {
    const meds: PrescriptionItem[] = linkedMeds.map((m, idx) => ({
      id: m.id || `med-${idx}`,
      name: m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display || 'Prescribed Medication',
      strength: '',
      dose: '1 unit',
      route: 'Oral',
      frequency: m.dosageInstruction?.[0]?.timing?.code?.text || 'Daily',
      duration: '30 days',
      instructions: m.dosageInstruction?.[0]?.patientInstruction || 'Take as directed by clinician'
    }));

    setPdfModalData({
      isOpen: true,
      medications: meds.length > 0 ? meds : [
        {
          id: 'def-1',
          name: 'Metformin Hydrochloride',
          strength: '1000 mg',
          dose: '1 tablet',
          route: 'Oral',
          frequency: 'Twice daily with meals',
          duration: '90 days',
          instructions: 'Take with food to minimize GI disturbance.'
        }
      ],
      date: enc.period?.start ? new Date(enc.period.start).toLocaleDateString() : undefined
    });
  };

  const openPdfForSingleRx = (mr: MedicationRequest) => {
    const medName = mr.medicationCodeableConcept?.text || mr.medicationCodeableConcept?.coding?.[0]?.display || 'Prescribed Medication';
    const dosage = mr.dosageInstruction?.[0]?.text || mr.dosageInstruction?.[0]?.patientInstruction || 'As directed';

    setPdfModalData({
      isOpen: true,
      medications: [{
        id: mr.id || 'rx-1',
        name: medName,
        strength: '',
        dose: '1 unit',
        route: 'Oral',
        frequency: mr.dosageInstruction?.[0]?.timing?.code?.text || 'Daily',
        duration: '90 days',
        instructions: dosage
      }],
      date: mr.authoredOn ? new Date(mr.authoredOn).toLocaleDateString() : undefined
    });
  };

  const getTimeline = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // Encounters
    encounters.forEach(enc => {
      const d = enc.period?.start || enc.meta?.lastUpdated;
      if (d) {
        const linkedMeds = medicationRequests.filter(mr => 
          mr.encounter?.reference === `Encounter/${enc.id}` || 
          mr.meta?.lastUpdated === enc.meta?.lastUpdated
        );
        const clinicNote = clinicNotes.find((note) => note.id === enc.id);
        const signed = clinicNote ? clinicNote.status === 'SIGNED' : enc.status === 'finished';

        events.push({
          id: enc.id as string,
          date: new Date(d),
          type: 'consultation',
          provenance: signed ? 'CLINICIAN_FACT' : 'AI_SUGGESTION',
          title: enc.type?.[0]?.text || 'Clinical Consultation',
          description: enc.reasonCode?.[0]?.text || 'Outpatient encounter & medication review',
          badge: signed
            ? { text: 'Signed by MD', variant: 'approved' }
            : { text: 'Draft · unsigned', variant: 'draft' },
          consultationData: {
            doctor: clinicNote?.signature?.actorName || authService.getCurrentUser()?.displayName || 'Unassigned clinician',
            type: enc.type?.[0]?.text || 'Outpatient',
            summary: clinicNote
              ? [clinicNote.note?.subjective, clinicNote.note?.assessment, clinicNote.note?.plan].filter(Boolean).join('\n\n')
              : enc.reasonCode?.[0]?.text,
            linkedPrescriptions: linkedMeds
          },
          resource: enc
        });
      }
    });

    // Medication Requests
    medicationRequests.forEach(mr => {
      const d = mr.authoredOn || mr.meta?.lastUpdated;
      if (d) {
        const medName = mr.medicationCodeableConcept?.text || mr.medicationCodeableConcept?.coding?.[0]?.display || 'Prescribed Medication';
        const dosage = mr.dosageInstruction?.[0]?.text || mr.dosageInstruction?.[0]?.patientInstruction || 'As directed';

        events.push({
          id: mr.id as string,
          date: new Date(d),
          type: 'prescription',
          provenance: 'CLINICIAN_FACT',
          title: `Rx: ${medName}`,
          description: dosage,
          badge: { text: 'Active Rx', variant: 'approved' },
          prescriptionData: {
            item: {
              id: mr.id || '',
              name: medName,
              strength: '',
              dose: '1 unit',
              route: 'Oral',
              frequency: 'Daily',
              duration: '30 days',
              instructions: dosage || 'Take as directed by clinician'
            },
            status: mr.status || 'active'
          },
          resource: mr
        });
      }
    });

    // Observations / Labs
    observations.forEach(o => {
      const d = o.effectiveDateTime || o.meta?.lastUpdated;
      if (d) {
        const testName = o.code?.text || o.code?.coding?.[0]?.display || 'Diagnostic Observation';
        const valStr = o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit || ''}` : (o.valueString || 'Recorded');
        const isAbn = o.interpretation?.[0]?.coding?.[0]?.code === 'H' || o.interpretation?.[0]?.coding?.[0]?.code === 'L';

        events.push({
          id: o.id as string,
          date: new Date(d),
          type: 'observation',
          provenance: 'CONFIRMED_CLINICAL_DATA',
          title: `Lab: ${testName}`,
          description: `${testName}: ${valStr}`,
          badge: isAbn 
            ? { text: 'Abnormal Flag', variant: 'warning' }
            : { text: 'Normal', variant: 'neutral' },
          observationData: {
            name: testName,
            value: valStr,
            status: o.status || 'final',
            isAbnormal: isAbn
          },
          resource: o
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
          provenance: 'AI_INFERENCE',
          title: 'Clinical Document Record',
          description: doc.description || 'Clinical Record PDF',
          badge: { text: 'Processed', variant: 'neutral' },
          documentData: {
            name: doc.description || 'Clinical Record',
            fileType: doc.content?.[0]?.attachment?.contentType || 'application/pdf'
          },
          resource: doc
        });
      }
    });

    // Operations / Triage
    operationalTasks.forEach(task => {
      events.push({
        id: task.id,
        date: new Date(task.createdAt),
        type: 'operation',
        provenance: 'PATIENT_REPORTED',
        title: task.title,
        description: task.summary,
        badge: { 
          text: task.status === 'completed' ? 'Approved' : 'Triage Queue', 
          variant: task.status === 'completed' ? 'approved' : 'warning' 
        },
        operationalData: { task },
        resource: task
      });
    });

    events.sort((a, b) => b.date.getTime() - a.date.getTime());
    return events;
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto py-24 flex flex-col items-center justify-center gap-3 text-xs text-ink-2" role="status">
          <LoaderCircle size={22} className="animate-spin text-ink" />
          <span>Opening clinical record...</span>
        </div>
      </Layout>
    );
  }

  if (!patient) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-24 text-center space-y-4">
          <h3 className="text-xl font-bold text-ink">Patient Record Not Found</h3>
          <p className="text-xs text-ink-2">
            The requested patient could not be located in the current database.
          </p>
          <Link
            to="/patients"
            className="inline-flex items-center gap-2 px-4 py-2 bg-solid text-white rounded-xl text-xs font-semibold"
          >
            <ArrowLeft size={14} />
            <span>Return to Patients</span>
          </Link>
        </div>
      </Layout>
    );
  }

  const name = patient.name?.[0];
  const displayName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() || `Patient (${patient.id})` : `Patient (${patient.id})`;
  const age = calculateAge(patient.birthDate);
  const gender = patient.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : 'Unknown';

  const conditionNames = conditions.length > 0 
    ? conditions.map(c => c.code?.text || c.code?.coding?.[0]?.display || 'Condition')
    : [];

  // Prescriptions signed at the clinic desk live on the note, not always in FHIR.
  const clinicPrescriptions = clinicNotes.flatMap((note) =>
    (Array.isArray(note.prescriptions) ? note.prescriptions : []).map((entry) => {
      const item = (entry || {}) as Record<string, unknown>;
      return {
        name: String(item.name || item.medication || 'Medication'),
        detail:
          [item.dose, item.frequency, item.duration].filter(Boolean).join(' · ') ||
          String(item.instructions || 'As directed')
      };
    })
  );

  const criticalAllergies = allergies.map(a => {
    const allergenName = a.code?.text || a.code?.coding?.[0]?.display || 'Allergen';
    const isCritical = 
      a.criticality === 'high' || 
      allergenName.toLowerCase().includes('anaphylaxis') ||
      allergenName.toLowerCase().includes('penicillin');
    return { name: allergenName, isCritical };
  });

  // Dynamic clinical markers
  const a1cObs = observations.find(o => 
    (o.code?.text || '').toLowerCase().includes('a1c') || 
    (o.code?.coding?.[0]?.display || '').toLowerCase().includes('a1c')
  );
  const a1cVal = a1cObs ? (a1cObs.valueQuantity ? `${a1cObs.valueQuantity.value}%` : a1cObs.valueString || '—') : '—';
  const a1cElevated = a1cVal.includes('8.') || a1cVal.includes('9.') || a1cVal.includes('10.');

  const bpObs = observations.find(o => 
    (o.code?.text || '').toLowerCase().includes('blood pressure') || 
    (o.code?.coding?.[0]?.display || '').toLowerCase().includes('blood pressure')
  );
  const bpVal = bpObs ? (bpObs.valueString || '—') : '—';

  const renalObs = observations.find(o => 
    (o.code?.text || '').toLowerCase().includes('egfr') || 
    (o.code?.coding?.[0]?.display || '').toLowerCase().includes('egfr')
  );
  const renalVal = renalObs ? (renalObs.valueQuantity ? `eGFR ${renalObs.valueQuantity.value}` : renalObs.valueString || '—') : '—';

  const allTimelineEvents = getTimeline();
  const filteredTimeline = allTimelineEvents.filter(event => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'consultations') return event.type === 'consultation';
    if (activeFilter === 'prescriptions') return event.type === 'prescription';
    if (activeFilter === 'labs') return event.type === 'observation';
    if (activeFilter === 'documents') return event.type === 'document';
    return true;
  });

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in pb-16">
        
        {/* Back navigation */}
        <Link 
          to="/patients" 
          className="inline-flex items-center gap-1.5 text-xs text-ink-2 hover:text-ink transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Patient Panel</span>
        </Link>

        {/* ── 1. CLEAN PATIENT HEADER (Airy Slab) ── */}
        <section aria-label="Patient header summary" className="bg-paper border border-rule rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {displayName}
                </h1>
                <span className="text-xs text-ink-2 font-medium">
                  {age}y • {gender}
                </span>
                {criticalAllergies.map((all, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      all.isCritical
                        ? 'text-critical bg-critical-wash border border-critical-line/80'
                        : 'text-caution bg-caution-wash border border-caution-line/80'
                    }`}
                  >
                    <AlertTriangle size={11} className="shrink-0" />
                    Allergy: {all.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-ink-2 flex-wrap">
                <span>DOB: {patient.birthDate || 'Not recorded'}</span>
                <span>•</span>
                <span>Attending: {authService.getCurrentUser()?.displayName || 'Unassigned'}</span>
                {clinicChart?.appointments?.[0] && (
                  <>
                    <span>•</span>
                    <span>
                      {clinicChart.appointments[0].date} · {clinicChart.appointments[0].time} · {clinicChart.appointments[0].roomOrVirtual}
                    </span>
                  </>
                )}
              </div>

              {/* Clean condition chips */}
              {conditionNames.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  {conditionNames.map((cond, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-paper-2 text-ink-2 border border-rule"
                    >
                      {cond}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Clean Primary Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate(`/consultation?patient=${patient.id}`)}
                className="px-4 py-2.5 bg-solid hover:bg-solid text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Stethoscope size={14} className="text-settled-on-solid" />
                <span>Start Consultation</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`/document-review?patient=${patient.id}`)}
                className="p-2.5 bg-paper hover:bg-paper-2 text-ink border border-rule rounded-xl transition-all shadow-2xs cursor-pointer"
                title="Upload Clinical Documents"
              >
                <Upload size={15} />
              </button>
            </div>
          </div>
        </section>

        {/* ── 2. MINIMALIST 3-TAB SWITCHER ── */}
        <div className="border-b border-rule flex items-center gap-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'timeline', label: `Timeline & Visits (${allTimelineEvents.length})`, icon: Clock },
            { id: 'documents', label: `Documents (${documents.length})`, icon: FileCheck }
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ProfileTab)}
                className={`flex items-center gap-2 pb-3 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer border-b-2 -mb-px ${
                  active
                    ? 'border-solid text-ink'
                    : 'border-transparent text-ink-2 hover:text-ink'
                }`}
              >
                <tab.icon size={14} className={active ? 'text-ink' : 'text-ink-3'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── 3. CLEAN TAB CONTENT PANELS ── */}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <section className="space-y-6 animate-in fade-in">
            {/* Clinical Narrative / Snapshot */}
            {intelligence.clinicalStory.paragraphs.length > 0 && (
              <div className="p-5 sm:p-6 bg-paper border border-rule rounded-2xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-rule">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <Sparkles size={14} className="text-accent-ink" />
                    <span>Clinical Longitudinal Snapshot</span>
                  </div>
                  <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
                </div>
                <div className="space-y-2 text-xs sm:text-sm text-ink-2 leading-relaxed">
                  {intelligence.clinicalStory.paragraphs.map((p, idx) => (
                    <p key={idx}>{p.text}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Key Clinical Markers (Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-paper rounded-2xl border border-rule shadow-2xs space-y-1">
                <div className="text-[11px] font-medium text-ink-2 uppercase tracking-wider">Hemoglobin A1c</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-ink">{a1cVal}</span>
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                    a1cElevated ? 'text-critical bg-critical-wash' : 'text-settled bg-settled-wash'
                  }`}>
                    {a1cElevated ? 'Elevated' : 'Target'}
                  </span>
                </div>
                <p className="text-xs text-ink-2 pt-1">Target ceiling &lt; 7.0%</p>
              </div>

              <div className="p-4 bg-paper rounded-2xl border border-rule shadow-2xs space-y-1">
                <div className="text-[11px] font-medium text-ink-2 uppercase tracking-wider">Blood Pressure</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-ink">{bpVal}</span>
                  <span className="text-[11px] font-semibold text-settled bg-settled-wash px-1.5 py-0.5 rounded">Recorded</span>
                </div>
                <p className="text-xs text-ink-2 pt-1">Active Regimen Observation</p>
              </div>

              <div className="p-4 bg-paper rounded-2xl border border-rule shadow-2xs space-y-1">
                <div className="text-[11px] font-medium text-ink-2 uppercase tracking-wider">Renal Function</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-ink">{renalVal}</span>
                  <span className="text-[11px] font-semibold text-ink-2 bg-paper-2 px-1.5 py-0.5 rounded">Serum Marker</span>
                </div>
                <p className="text-xs text-ink-2 pt-1">Renal filtration metric</p>
              </div>
            </div>

            {/* Active Regimen & Conditions side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Active Medications */}
              <div className="p-5 bg-paper border border-rule rounded-2xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Pill size={14} className="text-ink" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Current Medications</h3>
                  </div>
                  <span className="text-xs text-ink-2">{medicationRequests.length} active</span>
                </div>

                {medicationRequests.length === 0 && clinicPrescriptions.length === 0 ? (
                  <div className="py-6 text-center text-xs text-ink-2">
                    No active prescriptions.
                  </div>
                ) : medicationRequests.length === 0 ? null : (
                  <div className="divide-y divide-rule">
                    {medicationRequests.map((mr, idx) => {
                      const medName = mr.medicationCodeableConcept?.text || mr.medicationCodeableConcept?.coding?.[0]?.display || 'Medication';
                      const instructions = mr.dosageInstruction?.[0]?.text || mr.dosageInstruction?.[0]?.patientInstruction || 'As directed';

                      return (
                        <div key={mr.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-semibold text-ink">{medName}</div>
                            <div className="text-ink-2">{instructions}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openPdfForSingleRx(mr)}
                            className="p-1.5 text-ink-2 hover:text-ink hover:bg-paper-2 rounded-lg cursor-pointer"
                            title="Print Prescription"
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {clinicPrescriptions.length > 0 && (
                  <div className="pt-3 border-t border-rule space-y-2">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-ink-3">
                      Prescribed at this clinic
                    </div>
                    {clinicPrescriptions.map((item, idx) => (
                      <div key={`${item.name}-${idx}`} className="flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-ink">{item.name}</div>
                          <div className="text-ink-2">{item.detail}</div>
                        </div>
                        <Pill size={12} className="text-ink-3" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Conditions */}
              <div className="p-5 bg-paper border border-rule rounded-2xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-ink" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Active Conditions</h3>
                  </div>
                  <span className="text-xs text-ink-2">{conditionNames.length} conditions</span>
                </div>

                <div className="divide-y divide-rule">
                  {conditionNames.map((cond, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-ink">{cond}</div>
                        <div className="text-ink-2">Chronic diagnosis • Active</div>
                      </div>
                      <span className="px-2 py-0.5 bg-settled-wash text-settled text-[10px] font-medium rounded-full">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Durable encounter notes from /api/clinic */}
            {clinicNotes.length > 0 && (
              <div className="p-5 bg-paper border border-rule rounded-2xl shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-ink" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Encounter notes</h3>
                  </div>
                  <span className="text-xs text-ink-2">{clinicNotes.length} on file</span>
                </div>
                <div className="divide-y divide-rule">
                  {clinicNotes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => navigate(`/consultation?patient=${patient.id}`)}
                      className="flex w-full items-start justify-between gap-3 py-2.5 text-left cursor-pointer hover:bg-canvas"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-ink">{note.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] text-ink-2">
                          {note.note?.assessment || note.note?.plan || 'No assessment recorded'}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${
                        note.status === 'SIGNED'
                          ? 'bg-settled-wash text-settled'
                          : 'bg-caution-wash text-caution'
                      }`}>
                        {note.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Consultation CTA */}
            <div className="p-5 bg-canvas border border-rule rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-ink">Ready for an encounter?</h4>
                <p className="text-xs text-ink-2 mt-0.5">
                  Start ambient consultation to capture clinical dialogue and synthesize SOAP notes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/consultation?patient=${patient.id}`)}
                className="px-4 py-2 bg-solid hover:bg-solid text-white rounded-xl text-xs font-semibold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Stethoscope size={14} className="text-settled-on-solid" />
                <span>Open Doctor Desk</span>
              </button>
            </div>
          </section>
        )}

        {/* TAB 2: TIMELINE & VISITS */}
        {activeTab === 'timeline' && (
          <section className="space-y-5 animate-in fade-in">
            {/* Filter Pills */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'consultations', label: 'Visits' },
                  { id: 'prescriptions', label: 'Prescriptions' },
                  { id: 'labs', label: 'Labs' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilter(f.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      activeFilter === f.id
                        ? 'bg-solid text-white font-semibold'
                        : 'bg-paper border border-rule text-ink-2 hover:text-ink'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink-3">
                {filteredTimeline.length} events
              </span>
            </div>

            {/* Timeline Entries */}
            <div className="space-y-3">
              {filteredTimeline.length === 0 ? (
                <div className="p-8 bg-paper rounded-2xl border border-rule text-center text-xs text-ink-2">
                  No events found for this filter.
                </div>
              ) : (
                filteredTimeline.map((ev) => {
                  const isExpanded = !!expandedTimelineIds[ev.id];

                  return (
                    <div
                      key={`${ev.type}-${ev.id}`}
                      className="p-4 sm:p-5 bg-paper border border-rule rounded-2xl shadow-2xs space-y-2 transition-colors hover:border-rule-strong"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-ink-2 font-medium">
                              {ev.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                            {ev.badge && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                ev.badge.variant === 'approved' 
                                  ? 'bg-settled-wash text-settled' 
                                  : ev.badge.variant === 'warning'
                                  ? 'bg-caution-wash text-caution'
                                  : 'bg-paper-2 text-ink-2'
                              }`}>
                                {ev.badge.text}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-ink tracking-tight">
                            {ev.title}
                          </h4>
                          <p className="text-xs text-ink-2 leading-relaxed">
                            {ev.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {ev.type === 'consultation' && ev.consultationData && (
                            <button
                              type="button"
                              onClick={() => openPdfForEncounter(ev.resource, ev.consultationData?.linkedPrescriptions || [])}
                              className="px-2.5 py-1 text-xs border border-rule hover:bg-paper-2 rounded-lg text-ink-2 flex items-center gap-1 cursor-pointer"
                              title="Print Summary"
                            >
                              <Printer size={12} />
                              <span>Print</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleTimelineEvent(ev.id)}
                            className="p-1 text-ink-2 hover:text-ink cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-rule text-xs text-ink-2 space-y-1">
                          <div>Recorded: {ev.date.toLocaleString()}</div>
                          {ev.observationData && <div>Status: {ev.observationData.status}</div>}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* TAB 3: DOCUMENTS */}
        {activeTab === 'documents' && (
          <section className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">
                Uploaded Records & Attachments
              </span>
              <button
                type="button"
                onClick={() => navigate(`/document-review?patient=${patient.id}`)}
                className="px-3.5 py-1.5 bg-solid text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} />
                <span>Upload Document</span>
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 bg-paper rounded-2xl border border-rule text-center text-xs text-ink-2">
                No document references uploaded yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {documents.map(doc => (
                  <div key={doc.id} className="p-4 bg-paper border border-rule rounded-2xl shadow-2xs flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-paper-2 text-ink flex items-center justify-center">
                        <FileText size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-ink">{doc.description || 'Clinical Record PDF'}</h4>
                        <div className="text-[11px] text-ink-2">
                          {doc.date ? new Date(doc.date).toLocaleDateString() : 'Uploaded'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/document-review?patient=${patient.id}`)}
                      className="px-3 py-1.5 bg-canvas hover:bg-paper-2 text-xs font-medium rounded-lg text-ink border border-rule cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </div>

      {/* PDF Modal */}
      <PrescriptionPDFModal
        isOpen={pdfModalData.isOpen}
        onClose={() => setPdfModalData({ isOpen: false, medications: [] })}
        patient={patient}
        doctorName="Dr. Aris Thorne, MD"
        medications={pdfModalData.medications}
        date={pdfModalData.date}
      />
    </Layout>
  );
}
