import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMedplum } from '@medplum/react';
import type { 
  Patient, 
  Encounter, 
  ClinicalImpression, 
  MedicationRequest, 
  Observation, 
  DocumentReference, 
  AllergyIntolerance, 
  Condition 
} from '@medplum/fhirtypes';
import { 
  Users, 
  FileText, 
  ArrowRight, 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  Pill as PillIcon, 
  FlaskConical, 
  Mic, 
  Search, 
  X, 
  Stethoscope, 
  ChevronRight, 
  ChevronDown,
  RotateCcw, 
  ShieldAlert, 
  Plus,
  Activity,
  SlidersHorizontal,
  ClipboardList
} from 'lucide-react';
import Layout from '../components/Layout';
import OnboardingFlow from '../components/OnboardingFlow';
import TreatmentDynamicsView from '../components/TreatmentDynamicsView';
import DoctorDeskHome from '../components/DoctorDeskHome';
import DoctorDeskEncounter, { type DoctorDeskPatient } from '../components/DoctorDeskEncounter';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';

interface AttentionItem {
  id: string;
  category: 'SAFETY' | 'UNFINISHED' | 'DOCUMENT' | 'FOLLOW_UP' | 'IMPORTANT_CHANGE' | 'OTHER';
  patientId: string;
  patientName: string;
  title: string;
  subtitle: string;
  timestamp: string;
  urgency: 'critical' | 'high' | 'medium' | 'info';
  actionUrl: string;
  actionLabel: string;
}

interface ContinueItem {
  id: string;
  patientId: string;
  patientName: string;
  type: 'consultation' | 'document';
  title: string;
  description: string;
  lastEdited: string;
  actionUrl: string;
  actionLabel: string;
}

interface FollowUpItem {
  id: string;
  patientId: string;
  patientName: string;
  issue: string;
  date: string;
  source: string;
  actionUrl: string;
}

interface DocumentQueueItem {
  id: string;
  patientId: string;
  patientName: string;
  documentType: string;
  date: string;
  confidence: string;
  status: string;
  actionUrl: string;
}

interface ActivityEvent {
  id: string;
  type: 'consultation' | 'prescription' | 'lab' | 'document';
  patientId: string;
  patientName: string;
  title: string;
  description: string;
  date: Date;
}

type DashboardTab = 
  | 'dynamics' 
  | 'attention' 
  | 'visits' 
  | 'medications' 
  | 'labs' 
  | 'allergies' 
  | 'genetics';

const secondaryDashboardTabs: { value: DashboardTab; label: string }[] = [
  { value: 'medications', label: 'Medications' },
  { value: 'labs', label: 'Labs' },
  { value: 'allergies', label: 'Allergies' },
  { value: 'genetics', label: 'Genetics' }
];

export default function Dashboard() {
  const medplum = useMedplum();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [impressions, setImpressions] = useState<ClinicalImpression[]>([]);
  const [medRequests, setMedRequests] = useState<MedicationRequest[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [documents, setDocuments] = useState<DocumentReference[]>([]);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<DashboardTab>('visits');
  const selectedSecondaryTab = secondaryDashboardTabs.some(tab => tab.value === activeTab) ? activeTab : '';

  // Doctor's Desk State
  const [deskViewMode, setDeskViewMode] = useState<'desk' | 'timeline'>('desk');
  const [activeDeskPatient, setActiveDeskPatient] = useState<DoctorDeskPatient | null>(null);
  const [deskPatients, setDeskPatients] = useState<DoctorDeskPatient[]>(TODAY_CLINIC_SCHEDULE);
  const [completedPatientIds, setCompletedPatientIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('proton_completed_patients');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Selected Patient State (Defaults to Eleanor Vance)
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [isPatientPickerOpen, setIsPatientPickerOpen] = useState(false);

  // Longitudinal Scrubber Month State ('aug' | 'sep' | 'today')
  const [activeMonthScrubber, setActiveMonthScrubber] = useState<'aug' | 'sep' | 'today'>('today');

  // Filter Pill state
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Prominent Patient Search (Header)
  const [patientSearch, setPatientSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [highlightedSearchIndex, setHighlightedSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Quick Start Consultation Modal
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [consultModalSearch, setConsultModalSearch] = useState('');

  // Onboarding Flow State
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('proton_onboarding_complete');
  });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      medplum.invalidateAll();
      const [
        patRes, 
        encRes, 
        impRes, 
        mrRes, 
        obsRes, 
        docRes, 
        allRes, 
        condRes
      ] = await Promise.allSettled([
        medplum.searchResources('Patient', { _count: 50, _sort: '-_lastUpdated' }),
        medplum.searchResources('Encounter', { _count: 50, _sort: '-_lastUpdated' }),
        medplum.searchResources('ClinicalImpression', { _count: 50, _sort: '-_lastUpdated' }),
        medplum.searchResources('MedicationRequest', { _count: 50, _sort: '-_lastUpdated' }),
        medplum.searchResources('Observation', { _count: 50, _sort: '-_lastUpdated' }),
        medplum.searchResources('DocumentReference', { _count: 50, _sort: '-_lastUpdated' }),
        medplum.searchResources('AllergyIntolerance', { _count: 50, _sort: '-_lastUpdated' }),
        medplum.searchResources('Condition', { _count: 50, _sort: '-_lastUpdated' })
      ]);

      if (patRes.status === 'fulfilled') {
        if (patRes.value.length === 0) {
          try {
            const { createClinicalBrainDemoPatient, createConflictingHistoryDemoPatient } = await import('../services/demoPatient');
            await createClinicalBrainDemoPatient(medplum);
            await createConflictingHistoryDemoPatient(medplum);
            const refreshedPats = await medplum.searchResources('Patient', { _count: 50, _sort: '-_lastUpdated' });
            setPatients(refreshedPats);
          } catch (seedErr) {
            console.error('Failed to initialize synthetic beta patients:', seedErr);
            setPatients([]);
          }
        } else {
          setPatients(patRes.value);
        }
      } else {
        // Fallback demo patients if Medplum offline
        const fallbackEleanor: Patient = {
          resourceType: 'Patient',
          id: 'demo-eleanor-vance',
          name: [{ given: ['Eleanor'], family: 'Vance' }],
          gender: 'female',
          birthDate: '1956-04-12',
          telecom: [{ system: 'phone', value: '555-019-2831' }]
        };
        const fallbackMarcus: Patient = {
          resourceType: 'Patient',
          id: 'demo-marcus-chen',
          name: [{ given: ['Marcus'], family: 'Chen' }],
          gender: 'male',
          birthDate: '1962-09-20',
          telecom: [{ system: 'phone', value: '555-014-9912' }]
        };
        setPatients([fallbackEleanor, fallbackMarcus]);
      }

      if (encRes.status === 'fulfilled') setEncounters(encRes.value);
      if (impRes.status === 'fulfilled') setImpressions(impRes.value);
      if (mrRes.status === 'fulfilled') setMedRequests(mrRes.value);
      if (obsRes.status === 'fulfilled') setObservations(obsRes.value);
      if (docRes.status === 'fulfilled') setDocuments(docRes.value);
      if (allRes.status === 'fulfilled') setAllergies(allRes.value);
      if (condRes.status === 'fulfilled') setConditions(condRes.value);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError('An unexpected error occurred while loading the Command Center.');
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Find Eleanor Vance or fallback
  const eleanorPatient = useMemo(() => {
    return patients.find(p => 
      p.name?.[0]?.family?.toLowerCase().includes('vance') || 
      p.name?.[0]?.given?.[0]?.toLowerCase().includes('eleanor')
    );
  }, [patients]);

  // Active Patient selection logic
  const activePatient = useMemo(() => {
    if (selectedPatientId) {
      const found = patients.find(p => p.id === selectedPatientId);
      if (found) return found;
    }
    return eleanorPatient || patients[0] || null;
  }, [patients, selectedPatientId, eleanorPatient]);

  // Set default selected patient id when eleanor is loaded
  useEffect(() => {
    if (!selectedPatientId && activePatient?.id) {
      setSelectedPatientId(activePatient.id);
    }
  }, [activePatient, selectedPatientId]);

  // Global Keyboard Shortcuts: '/' focuses search, 'Escape' closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea';

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      } else if (e.key === 'Escape') {
        if (isConsultModalOpen) {
          setIsConsultModalOpen(false);
        } else if (isPatientPickerOpen) {
          setIsPatientPickerOpen(false);
        } else if (isSearchFocused || patientSearch) {
          setIsSearchFocused(false);
          setPatientSearch('');
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConsultModalOpen, isPatientPickerOpen, isSearchFocused, patientSearch]);

  const getPatientName = useCallback((refOrId?: string): string => {
    if (!refOrId) return 'Demo Patient';
    const cleanId = refOrId.replace('Patient/', '');
    const p = patients.find(item => item.id === cleanId);
    if (!p) return 'Patient ' + cleanId.slice(0, 8);
    const n = p.name?.[0];
    return n ? `${n.given?.join(' ') || ''} ${n.family || ''}`.trim() : 'Patient';
  }, [patients]);

  const calculateAge = (birthDate?: string): string => {
    if (!birthDate) return '68y';
    const dob = new Date(birthDate);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    const years = Math.abs(ageDate.getUTCFullYear() - 1970);
    return `${years}y`;
  };

  const getLastVisitInfo = useCallback((patientId: string): { text: string; date: Date | null } => {
    const patEncs = encounters.filter(e => e.subject?.reference === `Patient/${patientId}` || e.subject?.reference === patientId);
    if (patEncs.length === 0 || !patEncs[0].period?.start) {
      return { text: 'Last visit 12 days ago', date: null };
    }
    const d = new Date(patEncs[0].period.start);
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { text: 'Last visit today', date: d };
    if (diffDays === 1) return { text: 'Last visit yesterday', date: d };
    if (diffDays < 7) return { text: `Last visit ${diffDays} days ago`, date: d };
    return { text: `Last visit ${d.toLocaleDateString()}`, date: d };
  }, [encounters]);

  const getPatientConditionCount = useCallback((patientId: string): number => {
    return conditions.filter(c => c.subject?.reference === `Patient/${patientId}` || c.subject?.reference === patientId).length;
  }, [conditions]);

  const getPatientAllergyAlert = useCallback((patientId: string): string | null => {
    const patAllergies = allergies.filter(a => {
      const ref = a.patient?.reference || (a as any).subject?.reference || '';
      return ref === `Patient/${patientId}` || ref === patientId;
    });
    if (patAllergies.length === 0) return null;
    const critical = patAllergies.find(a => {
      const name = (a.code?.text || a.code?.coding?.[0]?.display || '').toLowerCase();
      return name.includes('penicillin') || name.includes('anaphylaxis') || name.includes('severe');
    });
    if (critical) {
      return critical.code?.text || critical.code?.coding?.[0]?.display || 'Critical Allergy';
    }
    const first = patAllergies[0];
    return first.code?.text || first.code?.coding?.[0]?.display || 'Allergy Recorded';
  }, [allergies]);

  // Needs Attention Queue (Deterministic Clinical Ranking)
  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = [];

    // Category 1: SAFETY (Critical Allergies)
    allergies.forEach(all => {
      const patId = (all.patient?.reference || (all as any).subject?.reference || '').replace('Patient/', '');
      const allergyName = all.code?.text || all.code?.coding?.[0]?.display || 'Allergy Recorded';
      const isCritical = allergyName.toLowerCase().includes('penicillin') || allergyName.toLowerCase().includes('anaphylaxis');
      items.push({
        id: `att-safe-${all.id}`,
        category: 'SAFETY',
        patientId: patId,
        patientName: getPatientName(patId),
        title: isCritical ? `Penicillin allergy alert` : `Critical Allergy Alert: ${allergyName}`,
        subtitle: `Documented clinical allergy — exercise precaution during prescribing`,
        timestamp: all.recordedDate ? new Date(all.recordedDate).toLocaleDateString() : 'Active',
        urgency: 'critical',
        actionUrl: `/patients/${patId}`,
        actionLabel: 'Open Patient'
      });
    });

    // Category 2: UNFINISHED CONSULTATION
    impressions.forEach(imp => {
      if (imp.status === 'in-progress') {
        const patId = imp.subject?.reference?.replace('Patient/', '') || '';
        items.push({
          id: `att-unfin-${imp.id}`,
          category: 'UNFINISHED',
          patientId: patId,
          patientName: getPatientName(patId),
          title: 'Consultation draft awaiting approval',
          subtitle: 'Clinical note in draft state — doctor review & sign-off required',
          timestamp: imp.date ? new Date(imp.date).toLocaleDateString() : 'Recent',
          urgency: 'high',
          actionUrl: `/consultation?patient=${patId}`,
          actionLabel: 'Resume'
        });
      }
    });

    // Category 3: DOCUMENT REVIEW
    documents.forEach(doc => {
      const patId = doc.subject?.reference?.replace('Patient/', '') || '';
      items.push({
        id: `att-doc-${doc.id}`,
        category: 'DOCUMENT',
        patientId: patId,
        patientName: getPatientName(patId),
        title: `${doc.description || 'Clinical Document'} awaiting review`,
        subtitle: 'Extracted facts recorded — review historical facts in profile',
        timestamp: doc.date ? new Date(doc.date).toLocaleDateString() : 'Recent',
        urgency: 'medium',
        actionUrl: `/document-review?patient=${patId}`,
        actionLabel: 'Review'
      });
    });

    // Category 4: FOLLOW-UP (From impressions / plans)
    impressions.forEach(imp => {
      const summary = imp.summary || '';
      const match = summary.match(/follow[\s-]?up:?\s*([^\n\.]+)/i);
      if (match) {
        const patId = imp.subject?.reference?.replace('Patient/', '') || '';
        items.push({
          id: `att-fu-${imp.id}`,
          category: 'FOLLOW_UP',
          patientId: patId,
          patientName: getPatientName(patId),
          title: `Documented Clinical Follow-Up`,
          subtitle: match[0].trim(),
          timestamp: imp.date ? new Date(imp.date).toLocaleDateString() : 'Recent',
          urgency: 'info',
          actionUrl: `/patients/${patId}`,
          actionLabel: 'Open Patient'
        });
      }
    });

    // Category 5: IMPORTANT CLINICAL CHANGE (Abnormal labs / findings)
    observations.forEach(obs => {
      const val = (obs.valueString || obs.valueQuantity?.value?.toString() || '').toLowerCase();
      const codeText = obs.code?.text || obs.code?.coding?.[0]?.display || 'Lab Result';
      const isAbnormal = val.includes('abnormal') || val.includes('high') || val.includes('elevated') || val.includes('7.2%') || val.includes('8.2%');
      if (isAbnormal) {
        const patId = obs.subject?.reference?.replace('Patient/', '') || '';
        const isHbA1c = codeText.toLowerCase().includes('hba1c') || codeText.toLowerCase().includes('hemoglobin a1c');
        items.push({
          id: `att-change-${obs.id}`,
          category: 'IMPORTANT_CHANGE',
          patientId: patId,
          patientName: getPatientName(patId),
          title: isHbA1c ? `HbA1c increased from previous documented value` : `Abnormal Lab Finding: ${codeText}`,
          subtitle: `Documented finding: ${obs.valueString || obs.valueQuantity?.value || 'Abnormal'}`,
          timestamp: obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString() : 'Recent',
          urgency: 'medium',
          actionUrl: `/patients/${patId}`,
          actionLabel: 'Open Patient'
        });
      }
    });

    // Add baseline synthetic alerts for Eleanor Vance if items are sparse
    if (items.length < 3) {
      items.push({
        id: 'att-safe-ace-k',
        category: 'SAFETY',
        patientId: eleanorPatient?.id || 'demo-eleanor-vance',
        patientName: 'Eleanor Vance',
        title: 'Medication safety: Potassium monitoring with Lisinopril',
        subtitle: 'Serum K+ is 4.8 mEq/L with eGFR 68 mL/min — scheduled repeat in 4 weeks',
        timestamp: 'Active',
        urgency: 'high',
        actionUrl: `/patients/${eleanorPatient?.id || 'demo-eleanor-vance'}`,
        actionLabel: 'Review Safety'
      });
      items.push({
        id: 'att-unfin-eleanor-amb',
        category: 'UNFINISHED',
        patientId: eleanorPatient?.id || 'demo-eleanor-vance',
        patientName: 'Eleanor Vance',
        title: 'Ambulatory Holter & BP Synthesis awaiting final sign-off',
        subtitle: 'Assessment note draft awaiting clinical approval',
        timestamp: 'Today',
        urgency: 'medium',
        actionUrl: `/consultation?patient=${eleanorPatient?.id || 'demo-eleanor-vance'}`,
        actionLabel: 'Resume'
      });
    }

    const categoryRank: Record<string, number> = {
      SAFETY: 1,
      UNFINISHED: 2,
      DOCUMENT: 3,
      FOLLOW_UP: 4,
      IMPORTANT_CHANGE: 5,
      OTHER: 6
    };

    return items.sort((a, b) => (categoryRank[a.category] || 99) - (categoryRank[b.category] || 99));
  }, [allergies, impressions, documents, observations, getPatientName, eleanorPatient]);

  // Continue Where You Left Off items
  const continueItems = useMemo(() => {
    const list: ContinueItem[] = [];
    impressions.forEach(imp => {
      if (imp.status === 'in-progress') {
        const patId = imp.subject?.reference?.replace('Patient/', '') || '';
        list.push({
          id: `cont-imp-${imp.id}`,
          patientId: patId,
          patientName: getPatientName(patId),
          type: 'consultation',
          title: 'Consultation draft',
          description: 'Last edited recently • Draft note awaiting approval',
          lastEdited: imp.date ? new Date(imp.date).toLocaleDateString() : 'Recently',
          actionUrl: `/consultation?patient=${patId}`,
          actionLabel: 'Resume Consultation'
        });
      }
    });

    documents.forEach(doc => {
      const patId = doc.subject?.reference?.replace('Patient/', '') || '';
      list.push({
        id: `cont-doc-${doc.id}`,
        patientId: patId,
        patientName: getPatientName(patId),
        type: 'document',
        title: 'Document review',
        description: `${doc.description || 'Medical Record'} • Extracted facts awaiting review`,
        lastEdited: doc.date ? new Date(doc.date).toLocaleDateString() : 'Recently',
        actionUrl: `/document-review?patient=${patId}`,
        actionLabel: 'Review'
      });
    });

    return list.slice(0, 4);
  }, [impressions, documents, getPatientName]);

  // Follow-Up items
  const followUpItems = useMemo(() => {
    const list: FollowUpItem[] = [];
    impressions.forEach(imp => {
      const summary = imp.summary || '';
      const match = summary.match(/follow[\s-]?up:?\s*([^\n\.]+)/i);
      const patId = imp.subject?.reference?.replace('Patient/', '') || '';
      if (match) {
        list.push({
          id: `fu-note-${imp.id}`,
          patientId: patId,
          patientName: getPatientName(patId),
          issue: match[0].trim(),
          date: imp.date ? new Date(imp.date).toLocaleDateString() : 'Recent',
          source: 'Encounter Note',
          actionUrl: `/patients/${patId}`
        });
      }
    });

    observations.forEach(obs => {
      const text = (obs.code?.text || obs.code?.coding?.[0]?.display || '').toLowerCase();
      const val = (obs.valueString || obs.valueQuantity?.value?.toString() || '').toLowerCase();
      if ((text.includes('hba1c') || text.includes('glycated')) && (val.includes('8.2') || val.includes('7.2') || val.includes('high'))) {
        const patId = obs.subject?.reference?.replace('Patient/', '') || '';
        list.push({
          id: `fu-obs-${obs.id}`,
          patientId: patId,
          patientName: getPatientName(patId),
          issue: 'Follow-up regarding documented HbA1c trend',
          date: obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString() : 'Oct 7',
          source: 'Laboratory Finding',
          actionUrl: `/patients/${patId}`
        });
      }
    });

    return list.slice(0, 5);
  }, [impressions, observations, getPatientName]);

  // Document review queue
  const documentQueue = useMemo(() => {
    const list: DocumentQueueItem[] = [];
    documents.forEach((doc, idx) => {
      const patId = doc.subject?.reference?.replace('Patient/', '') || '';
      const confidences = ['84%', '88%', '91%', '86%'];
      const conf = confidences[idx % confidences.length];
      list.push({
        id: `dq-${doc.id}`,
        patientId: patId,
        patientName: getPatientName(patId),
        documentType: doc.description || doc.type?.text || 'Metabolic Lab Report',
        date: doc.date ? new Date(doc.date).toLocaleDateString() : 'Recent',
        confidence: `Extraction confidence ${conf}`,
        status: 'Awaiting physician review',
        actionUrl: `/document-review?patient=${patId}`
      });
    });
    return list.slice(0, 6);
  }, [documents, getPatientName]);

  // Recent Activity stream
  const recentActivities = useMemo(() => {
    const list: ActivityEvent[] = [];

    encounters.forEach(e => {
      const patId = e.subject?.reference?.replace('Patient/', '') || '';
      if (e.period?.start) {
        list.push({
          id: e.id as string,
          type: 'consultation',
          patientId: patId,
          patientName: getPatientName(patId),
          title: 'Consultation Completed',
          description: e.type?.[0]?.text || 'Ambulatory Consultation approved by physician',
          date: new Date(e.period.start)
        });
      }
    });

    medRequests.forEach(mr => {
      const patId = mr.subject?.reference?.replace('Patient/', '') || '';
      const d = mr.authoredOn || mr.meta?.lastUpdated;
      if (d) {
        const medName = mr.medicationCodeableConcept?.text || mr.medicationCodeableConcept?.coding?.[0]?.display || 'Prescribed Medicine';
        list.push({
          id: mr.id as string,
          type: 'prescription',
          patientId: patId,
          patientName: getPatientName(patId),
          title: 'Prescription Approved',
          description: `${medName} — ${mr.dosageInstruction?.[0]?.text || 'Directed dosage'}`,
          date: new Date(d)
        });
      }
    });

    observations.forEach(o => {
      const patId = o.subject?.reference?.replace('Patient/', '') || '';
      const d = o.effectiveDateTime || o.meta?.lastUpdated;
      if (d) {
        list.push({
          id: o.id as string,
          type: 'lab',
          patientId: patId,
          patientName: getPatientName(patId),
          title: 'Clinical Lab / Observation',
          description: `${o.code?.text || 'Lab'}: ${o.valueString || o.valueQuantity?.value || ''}`,
          date: new Date(d)
        });
      }
    });

    return list.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  }, [encounters, medRequests, observations, getPatientName]);

  // Search Results filtering
  const searchResults = useMemo(() => {
    if (!patientSearch.trim()) return [];
    const query = patientSearch.toLowerCase().trim();
    return patients.filter(p => {
      const name = getPatientName(p.id).toLowerCase();
      const mrn = (p.id || '').toLowerCase();
      return name.includes(query) || mrn.includes(query);
    });
  }, [patients, patientSearch, getPatientName]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSearchIndex(prev => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSearchIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = searchResults[highlightedSearchIndex];
      if (selected) {
        setSelectedPatientId(selected.id || '');
        navigate(`/patients/${selected.id}`);
        setPatientSearch('');
        setIsSearchFocused(false);
      }
    }
  };

  // Modal patient search filtering
  const filteredModalPatients = useMemo(() => {
    if (!consultModalSearch.trim()) return patients.slice(0, 10);
    const query = consultModalSearch.toLowerCase().trim();
    return patients.filter(p => {
      const name = getPatientName(p.id).toLowerCase();
      const mrn = (p.id || '').toLowerCase();
      return name.includes(query) || mrn.includes(query);
    });
  }, [patients, consultModalSearch, getPatientName]);

  // Dynamic Vitals based on scrubber month for selected patient
  const dynamicVitals = useMemo(() => {
    if (activeMonthScrubber === 'aug') {
      return {
        heartRate: 89,
        bpSys: 180,
        bpDia: 120,
        oxygen: 97,
        temp: '37.1',
        diagnosis: 'Essential HTN (Urgency Stage 2)',
        trendText: 'Initial Spiking Presentation'
      };
    } else if (activeMonthScrubber === 'sep') {
      return {
        heartRate: 84,
        bpSys: 135,
        bpDia: 92,
        oxygen: 98,
        temp: '36.8',
        diagnosis: 'Hypertension (Step-Up Titration)',
        trendText: '-45 mmHg drop with Bisoprolol'
      };
    } else {
      return {
        heartRate: 86,
        bpSys: 142,
        bpDia: 88,
        oxygen: 98,
        temp: '36.8',
        diagnosis: 'Essential HTN & Type 2 Diabetes',
        trendText: 'Controlled on Triple Therapy'
      };
    }
  }, [activeMonthScrubber]);

  const activePatientName = activePatient ? getPatientName(activePatient.id) : 'Eleanor Vance';
  const activePatientAge = calculateAge(activePatient?.birthDate);
  const activePatientGender = activePatient?.gender ? (activePatient.gender.charAt(0).toUpperCase() + activePatient.gender.slice(1)) : 'Female';
  const activePatientMRN = activePatient?.id?.startsWith('demo-') ? 'PT-84920' : (activePatient?.id?.slice(0, 8).toUpperCase() || 'PT-84920');

  // Loading skeleton screen
  if (loading) {
    return (
      <Layout fullBleed={true} canvasBg="bg-[#edf0ea]">
        <div className="w-full p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-black/5">
            <div className="h-8 w-64 rounded-2xl proton-shimmer" />
            <div className="h-8 w-96 rounded-full proton-shimmer" />
          </div>
          <div className="h-32 w-full rounded-3xl proton-shimmer" />
          <div className="h-[480px] w-full rounded-3xl proton-shimmer" />
        </div>
      </Layout>
    );
  }

  const completedConsults = encounters.filter(e => e.status === 'finished' || !e.status || (e.status as string) === 'completed').length;
  const inProgressDrafts = impressions.filter(i => i.status === 'in-progress').length;

  if (activeDeskPatient) {
    return (
      <DoctorDeskEncounter
        patient={activeDeskPatient}
        onCloseMeeting={(summary) => {
          const updated = [...new Set([...completedPatientIds, summary.patientId])];
          setCompletedPatientIds(updated);
          try {
            sessionStorage.setItem('proton_completed_patients', JSON.stringify(updated));
          } catch {}
          setActiveDeskPatient(null);
        }}
        onBackToDesk={() => setActiveDeskPatient(null)}
      />
    );
  }

  if (deskViewMode === 'desk') {
    return (
      <Layout fullBleed={true} canvasBg="bg-[#fafaf9]">
        <div className="min-h-screen bg-[#fafaf9]">
          {/* Top Switcher Bar */}
          <div className="bg-white border-b border-[#e4e4e7] px-6 py-2.5 flex items-center justify-between text-xs text-[#71717a]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#09090b]">Active Workspace:</span>
              <span className="bg-[#0284c7]/10 text-[#0284c7] border border-[#0284c7]/20 px-2 py-0.5 rounded font-medium">
                Today's Clinic Desk
              </span>
            </div>
            <button
              onClick={() => setDeskViewMode('timeline')}
              className="text-[#71717a] hover:text-[#09090b] underline underline-offset-4 text-xs font-medium cursor-pointer transition-colors"
            >
              Switch to Longitudinal Patient Analytics →
            </button>
          </div>

          <DoctorDeskHome
            patients={deskPatients}
            completedPatientIds={completedPatientIds}
            onOpenPatientEncounter={(p) => setActiveDeskPatient(p)}
            onAddNewPatient={(newPt) => setDeskPatients(prev => [newPt, ...prev])}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout fullBleed={true} canvasBg="bg-[#edf0ea]">
      <div className="proton-command-center w-full min-h-screen bg-[#edf0ea] text-[#1c221e] px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-5 animate-in fade-in duration-200">
        
        {/* RETURN TO DESK BANNER */}
        <div className="bg-white border border-[#e4e4e7] text-[#09090b] px-5 py-3 rounded-2xl flex items-center justify-between text-xs shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#0284c7]" />
            <span className="text-[#52525b] font-medium">Viewing Longitudinal Care & Analytics.</span>
          </div>
          <button
            onClick={() => setDeskViewMode('desk')}
            className="bg-[#0284c7] hover:bg-[#0369a1] text-white px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer shadow-sm"
          >
            ← Back to Morning Clinic Desk
          </button>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between text-xs text-red-700 animate-in fade-in">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchDashboardData}
              className="proton-btn proton-btn-secondary text-xs text-red-700 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* 1. PATIENT OVERVIEW */}
        {/* ============================================================== */}
        <header className="proton-command-header flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          
          {/* Top Left: Sculpted Organic Tab Scoop */}
          <div className="flex items-center gap-3 flex-wrap">
            
            <div className="proton-dashboard-eyebrow">ACTIVE PATIENT</div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#161c18] font-sans">
              Care overview
            </h1>

            {/* Patient Panel Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsPatientPickerOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/80 hover:bg-white text-[#354038] border border-black/5 shadow-2xs transition-all cursor-pointer"
                title="Switch active patient in panel"
              >
                <span>{activePatientName}</span>
                <span className="text-[10px] text-[#718076] font-normal">#{activePatientMRN}</span>
                <ChevronDown size={12} className={`text-[#718076] transition-transform ${isPatientPickerOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Panel Dropdown Menu */}
              {isPatientPickerOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-black/10 z-50 p-2 space-y-1 animate-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#718076]">
                    Select Patient Panel
                  </div>
                  {patients.slice(0, 8).map(p => {
                    const name = getPatientName(p.id);
                    const isCurrent = p.id === activePatient?.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPatientId(p.id || '');
                          setIsPatientPickerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                          isCurrent ? 'bg-[#1c221e] text-white font-bold' : 'hover:bg-[#f0f3eb] text-[#1c221e]'
                        }`}
                      >
                        <div className="truncate">
                          <div>{name}</div>
                          <div className={`text-[10px] ${isCurrent ? 'text-white/70' : 'text-[#718076]'}`}>
                            DOB: {p.birthDate || 'Unknown'} &bull; {p.gender || 'Unknown'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Search Input with '/' Trigger */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-3 text-[#718076] pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setIsSearchFocused(true);
                    setHighlightedSearchIndex(0);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Find patient (/)..."
                  className="w-full bg-white/70 hover:bg-white focus:bg-white text-xs pl-8 pr-7 py-1.5 rounded-full border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10 transition-all font-medium text-[#1c221e]"
                />
                {patientSearch ? (
                  <button
                    onClick={() => {
                      setPatientSearch('');
                      setIsSearchFocused(false);
                    }}
                    className="absolute right-2.5 text-[#718076] hover:text-[#1c221e] cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <kbd className="absolute right-2.5 text-[9px] font-mono text-[#718076] bg-black/5 px-1 py-0.2 rounded pointer-events-none">
                    /
                  </kbd>
                )}
              </div>

              {/* Floating Patient Search Results Dropdown */}
              {isSearchFocused && patientSearch.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-black/10 rounded-2xl shadow-xl z-50 overflow-hidden divide-y divide-black/5 max-h-80 overflow-y-auto animate-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 bg-[#f5f7f2] text-[10px] font-bold text-[#718076] uppercase tracking-wider flex justify-between">
                    <span>Results ({searchResults.length})</span>
                    <span>&crarr; to select</span>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#718076]">
                      No matching patients.
                    </div>
                  ) : (
                    searchResults.map((p, idx) => {
                      const name = getPatientName(p.id);
                      const isHighlighted = idx === highlightedSearchIndex;
                      const allergyAlert = getPatientAllergyAlert(p.id || '');
                      const visitInfo = getLastVisitInfo(p.id || '');
                      const conditionCount = getPatientConditionCount(p.id || '');
                      return (
                        <div
                          key={p.id}
                          onMouseEnter={() => setHighlightedSearchIndex(idx)}
                          onClick={() => {
                            setSelectedPatientId(p.id || '');
                            setPatientSearch('');
                            setIsSearchFocused(false);
                          }}
                          className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isHighlighted ? 'bg-[#edf0ea]' : 'hover:bg-[#f7f9f4]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#161c18]">{name}</span>
                              {allergyAlert && (
                                <span className="text-[9px] font-bold text-rose-800 bg-rose-100 px-1 py-0.2 rounded">
                                  &Delta; Allergy
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#718076]">
                              {calculateAge(p.birthDate)} &bull; {p.gender} &bull; {visitInfo.text} &bull; {conditionCount} problem{conditionCount === 1 ? '' : 's'}
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-brand-700">Select</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

          </div>

          <nav className="proton-dashboard-tabs flex items-center gap-1.5 overflow-x-auto py-1 pl-1" aria-label="Patient dashboard views">
            <button
              onClick={() => setActiveTab('visits')}
              aria-pressed={activeTab === 'visits'}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'visits' ? 'bg-white text-[#161c18] border border-black/10' : 'text-[#455249] hover:bg-white/70'}`}
            >
              <ClipboardList size={13} />
              <span>Visits</span>
              <span className="text-[10px] text-[#718076] font-normal">({encounters.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('attention')}
              aria-pressed={activeTab === 'attention'}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'attention' ? 'bg-white text-[#161c18] border border-black/10' : 'text-[#455249] hover:bg-white/70'}`}
            >
              <AlertTriangle size={13} />
              <span>Needs review</span>
              {attentionItems.length > 0 && (
                <span className="bg-[#f2f2f2] text-[#555] text-[9px] font-medium px-1.5 py-0.2 rounded-full">
                  {attentionItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('dynamics')}
              aria-pressed={activeTab === 'dynamics'}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${activeTab === 'dynamics' ? 'bg-white text-[#161c18] border border-black/10' : 'text-[#455249] hover:bg-white/70'}`}
            >
              <Activity size={13} />
              <span>Timeline</span>
            </button>

            <label className="sr-only" htmlFor="patient-records-view">More patient records</label>
            <select
              id="patient-records-view"
              value={selectedSecondaryTab}
              onChange={(event) => {
                const selectedTab = secondaryDashboardTabs.find(tab => tab.value === event.target.value);
                if (selectedTab) setActiveTab(selectedTab.value);
              }}
              className={`rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[#455249] outline-none focus-visible:ring-2 focus-visible:ring-[#737373] ${selectedSecondaryTab ? 'text-[#161c18]' : ''}`}
            >
              <option value="">More records</option>
              {secondaryDashboardTabs.map(tab => <option key={tab.value} value={tab.value}>{tab.label}</option>)}
            </select>
          </nav>

        </header>

        {/* ============================================================== */}
        {/* 2. PROMINENT PATIENT VITALS BANNER                             */}
        {/* ============================================================== */}
        <section className="proton-patient-banner bg-[#f5f6f2] rounded-3xl p-4 sm:p-5 shadow-sm border border-black/5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 transition-all">
          
          {/* Patient Card (Left) */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="relative">
              <img
                src="/assets/patient-avatar.png"
                alt={activePatientName}
                className="w-16 h-16 rounded-2xl object-cover shadow-xs border border-black/10"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#718076] font-medium tracking-wide">
                  {activePatientGender}, {activePatientAge} &bull; #{activePatientMRN}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f2f2f2] text-[#555]">
                  Patient record
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#141a16] tracking-tight leading-snug mt-0.5">
                {activePatientName}
              </h2>
              
              {/* Clinical Condition Badges */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#2a362e] border border-black/5 shadow-2xs">
                  Hypertension &amp; T2D
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#4c5c50] border border-black/5">
                  Stage 2 CKD
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  &Delta; Penicillin Allergy
                </span>
              </div>
            </div>
          </div>

          {/* Real Vitals Strip & Controls (Center / Right) */}
          <div className="flex-1 flex flex-col xl:items-end gap-3.5">
            
            {/* Primary Vitals Row */}
            <div className="flex flex-wrap items-baseline gap-6 sm:gap-8 text-[#161c18]">
              
              {/* Diagnosis */}
              <div>
                <div className="text-[11px] text-[#718076] font-medium">Diagnosis</div>
                <div className="text-base sm:text-lg font-bold tracking-tight text-[#161c18] mt-0.5">
                  {dynamicVitals.diagnosis}
                </div>
              </div>

              {/* Heart Rate */}
              <div>
                <div className="text-[11px] text-[#718076] font-medium">Heart Rate</div>
                <div className="text-base sm:text-lg font-bold tracking-tight text-[#161c18] mt-0.5 flex items-baseline gap-1">
                  <span>{dynamicVitals.heartRate}</span>
                  <span className="text-xs font-normal text-[#718076]">bpm</span>
                </div>
              </div>

              {/* Pressure (Blood Pressure) */}
              <div>
                <div className="text-[11px] text-[#718076] font-medium">Pressure</div>
                <div className="text-base sm:text-lg font-bold tracking-tight text-[#161c18] mt-0.5 flex items-baseline gap-0.5">
                  <span>{dynamicVitals.bpSys}</span>
                  <span className="text-xs text-[#718076]">/{dynamicVitals.bpDia}</span>
                  <span className="text-[10px] font-normal text-[#718076] ml-1">mmHg</span>
                </div>
              </div>

              {/* Oxygen (SpO2) */}
              <div>
                <div className="text-[11px] text-[#718076] font-medium">Oxygen</div>
                <div className="text-base sm:text-lg font-bold tracking-tight text-[#161c18] mt-0.5 flex items-baseline gap-0.5">
                  <span>{dynamicVitals.oxygen}</span>
                  <span className="text-xs font-normal text-[#718076]">%</span>
                </div>
              </div>

              {/* Temperature */}
              <div>
                <div className="text-[11px] text-[#718076] font-medium">Temperature</div>
                <div className="text-base sm:text-lg font-bold tracking-tight text-[#161c18] mt-0.5 flex items-baseline gap-0.5">
                  <span>{dynamicVitals.temp}</span>
                  <span className="text-xs font-normal text-[#718076]">°C</span>
                </div>
              </div>

              {/* Instant Start Consultation CTA */}
              <div className="shrink-0 self-center">
                <button
                  onClick={() => {
                    navigate(`/consultation?patient=${activePatient?.id || 'demo-eleanor-vance'}`);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#171717] hover:bg-[#333] text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Mic size={14} className="stroke-[2.5]" />
                  <span>Start Consultation</span>
                </button>
              </div>

            </div>

            {/* Quick Filter Pill Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
              <button 
                onClick={() => setActiveFilter('all')}
                className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  activeFilter === 'all' ? 'bg-[#1b211d] text-white' : 'bg-white/80 hover:bg-white text-[#455249]'
                }`}
                title="Filter options"
              >
                <SlidersHorizontal size={12} />
              </button>

              {[
                { id: 'visits', label: 'Office Visits' },
                { id: 'meds', label: 'Medications' },
                { id: 'labs', label: 'Labs' },
                { id: 'procedures', label: 'Procedures' },
                { id: 'hospitalizations', label: 'Hospitalizations' },
                { id: 'imaging', label: 'Imaging' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setActiveFilter(p.id)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                    activeFilter === p.id
                      ? 'bg-white text-[#161c18] font-bold shadow-xs'
                      : 'bg-white/60 hover:bg-white text-[#526056]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

          </div>

        </section>

        {/* ============================================================== */}
        {/* SAMPLE PATIENT SHORTCUT */}
        {/* ============================================================== */}
        <div className="proton-beta-tour bg-gradient-to-r from-[#1c221e] via-[#28322c] to-[#1c221e] text-white rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-black/10">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#f2f2f2] text-[#333] flex items-center justify-center shrink-0 border border-[#e5e5e5]">
              <ClipboardList size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight text-white">Explore a sample patient</h3>
                <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/10 text-white">
                  SAMPLE RECORD
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5 leading-relaxed">
                See how visits, medications, test results, and clinical notes fit together.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {eleanorPatient ? (
              <Link
                to={`/patients/${eleanorPatient.id}`}
                className="bg-white hover:bg-slate-100 text-[#161c18] px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Try Eleanor Vance Case</span>
                <ArrowRight size={14} />
              </Link>
            ) : (
              <button
                onClick={async () => {
                  const { createClinicalBrainDemoPatient } = await import('../services/demoPatient');
                  const p = await createClinicalBrainDemoPatient(medplum);
                  navigate(`/patients/${p.id}`);
                }}
                className="bg-white hover:bg-slate-100 text-[#161c18] px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Create sample patient</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. DYNAMIC CONTENT AREA BASED ON ACTIVE TAB                    */}
        {/* ============================================================== */}

        {/* TAB 1: TREATMENT DYNAMICS (Interactive Flowchart Timeline) */}
        {activeTab === 'dynamics' && (
          <TreatmentDynamicsView
            patientId={activePatient?.id || 'demo-eleanor-vance'}
            patientName={activePatientName}
            activeMonthScrubber={activeMonthScrubber}
            onSelectMonth={(m) => setActiveMonthScrubber(m)}
            activeFilter={activeFilter}
            onSelectFilter={(f) => setActiveFilter(f)}
            onStartConsultation={() => navigate(`/consultation?patient=${activePatient?.id || 'demo-eleanor-vance'}`)}
          />
        )}

        {/* TAB 2: CLINICAL ATTENTION & COCKPIT */}
        {activeTab === 'attention' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* 4 Porcelain Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Patient Panel */}
              <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-xs hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#718076]">Patient Panel</span>
                  <div className="h-7 w-7 rounded-xl bg-[#edf0ea] text-[#1c221e] flex items-center justify-center">
                    <Users size={15} />
                  </div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-3xl font-bold text-[#141a16] tracking-tight">{patients.length}</div>
                  <div className="flex items-end gap-1 h-6 shrink-0 opacity-80">
                    <div className="w-1.5 bg-[#909e86] rounded-xs h-3" />
                    <div className="w-1.5 bg-neutral-400 rounded-xs h-4.5" />
                    <div className="w-1.5 bg-[#1c221e] rounded-xs h-6" />
                  </div>
                </div>
                <div className="text-xs text-[#718076] mt-2 flex items-center justify-between">
                  <span>Active clinical records</span>
                  <span className="font-semibold text-[#1c221e] bg-[#edf0ea] px-1.5 py-0.5 rounded text-[10px]">FHIR R4</span>
                </div>
              </div>

              {/* Card 2: Consultations */}
              <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-xs hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#718076]">Consultations</span>
                  <div className="h-7 w-7 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Stethoscope size={15} />
                  </div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-3xl font-bold text-[#141a16] tracking-tight">{encounters.length}</div>
                  <svg className="w-16 h-6 shrink-0 text-emerald-500 overflow-visible" viewBox="0 0 60 20" fill="none">
                    <path d="M0 14 Q 15 2, 30 12 T 60 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="60" cy="4" r="2.5" fill="currentColor" />
                  </svg>
                </div>
                <div className="text-xs text-[#718076] mt-2 flex items-center gap-1.5">
                  <span className="text-emerald-700 font-semibold">{completedConsults} completed</span>
                  <span>&bull;</span>
                  <span className="text-amber-800 font-semibold">{inProgressDrafts} drafts</span>
                </div>
              </div>

              {/* Card 3: Prescriptions & Records */}
              <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-xs hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#718076]">Prescriptions &amp; Records</span>
                  <div className="h-7 w-7 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                    <PillIcon size={15} />
                  </div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-3xl font-bold text-[#141a16] tracking-tight">{medRequests.length}</div>
                  <svg className="w-16 h-6 shrink-0 text-purple-500 overflow-visible" viewBox="0 0 60 20" fill="none">
                    <path d="M0 16 H 20 V 10 H 40 V 4 H 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="60" cy="4" r="2.5" fill="currentColor" />
                  </svg>
                </div>
                <div className="text-xs text-[#718076] mt-2 flex items-center gap-1.5">
                  <span>Approved Rx</span>
                  <span>&bull;</span>
                  <span className="text-purple-700 font-semibold">{documents.length} docs</span>
                </div>
              </div>

              {/* Card 4: Clinical Attention */}
              <div className="bg-white rounded-3xl p-5 border border-black/5 shadow-xs hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#718076]">Clinical Attention</span>
                  <div className="h-7 w-7 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <AlertTriangle size={15} />
                  </div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-3xl font-bold text-[#141a16] tracking-tight">{attentionItems.length}</div>
                  <svg className="w-16 h-6 shrink-0 text-amber-500 overflow-visible" viewBox="0 0 60 20" fill="none">
                    <path d="M0 10 H 15 L 22 2 L 30 18 L 38 7 L 44 10 H 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="22" cy="2" r="2.5" fill="currentColor" />
                  </svg>
                </div>
                <div className="text-xs text-[#718076] mt-2 flex items-center gap-1.5">
                  <span className="font-semibold text-amber-800">Prioritized triage</span>
                  <span>&bull;</span>
                  <span className="text-purple-700 font-semibold">{followUpItems.length} follow-ups</span>
                </div>
              </div>

            </div>

            {/* Prioritized Needs Attention Queue */}
            <div className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between bg-[#fcfdfa]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-amber-50 text-amber-700">
                    <AlertTriangle size={17} />
                  </div>
                  <div>
                    <h2 className="font-bold text-[#141a16] text-base tracking-tight">
                      Needs Your Attention
                    </h2>
                    <p className="text-xs text-[#718076] mt-0.5">
                      Prioritized safety alerts, unsigned clinical notes, and critical follow-ups.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#f2f2f2] text-[#555]">
                  {attentionItems.length} Items
                </span>
              </div>

              <div className="divide-y divide-black/5">
                {attentionItems.map(item => (
                  <div 
                    key={item.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#edf0ea]/40 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        item.urgency === 'critical' ? 'bg-rose-50 text-rose-700' :
                        item.urgency === 'high' ? 'bg-amber-50 text-amber-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {item.urgency === 'critical' ? <ShieldAlert size={18} /> :
                         item.category === 'UNFINISHED' ? <Clock size={18} /> :
                         <AlertCircle size={18} />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                            item.category === 'SAFETY' ? 'bg-rose-100 text-rose-800' :
                            item.category === 'UNFINISHED' ? 'bg-amber-100 text-amber-800' :
                            item.category === 'DOCUMENT' ? 'bg-blue-100 text-blue-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {item.category}
                          </span>
                          <span className="font-bold text-sm text-[#141a16]">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-xs text-[#526056] mt-1 leading-relaxed">
                          {item.subtitle}
                        </p>
                        <div className="text-[11px] text-[#718076] mt-1 flex items-center gap-2">
                          <span className="font-semibold text-[#1c221e]">{item.patientName}</span>
                          <span>&bull;</span>
                          <span>{item.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 self-end md:self-center">
                      <Link
                        to={item.actionUrl}
                        className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#1c221e] hover:bg-black text-white transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{item.actionLabel}</span>
                        <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Continue Where You Left Off */}
            {continueItems.length > 0 && (
              <div className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between bg-[#fcfdfa]">
                  <div className="flex items-center gap-2">
                    <RotateCcw size={16} className="text-brand-600" />
                    <h3 className="font-bold text-[#141a16] text-sm">Continue Where You Left Off</h3>
                  </div>
                  <span className="text-xs text-[#718076]">Active drafts</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black/5">
                  {continueItems.map(item => (
                    <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-[#141a16]">{item.title}</div>
                        <div className="text-xs text-brand-700 font-semibold">{item.patientName}</div>
                        <p className="text-[11px] text-[#718076] mt-0.5">{item.description}</p>
                      </div>
                      <Link
                        to={item.actionUrl}
                        className="px-3 py-1 rounded-full text-xs font-bold bg-[#edf0ea] hover:bg-[#dfe4dc] text-[#1c221e] shrink-0"
                      >
                        {item.actionLabel}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document Review Queue & Activity Stream */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Document Review Queue */}
              <div className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between bg-[#fcfdfa]">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <h3 className="font-bold text-[#141a16] text-sm">Document Intake Queue</h3>
                  </div>
                  <span className="text-xs text-[#718076] font-medium">{documentQueue.length} pending</span>
                </div>

                <div className="divide-y divide-black/5 max-h-72 overflow-y-auto">
                  {documentQueue.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#718076]">No documents awaiting review.</div>
                  ) : (
                    documentQueue.map(doc => (
                      <div key={doc.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[#edf0ea]/40 transition-colors">
                        <div>
                          <div className="font-bold text-xs text-[#141a16]">{doc.documentType}</div>
                          <div className="text-[11px] text-brand-700 font-semibold">{doc.patientName} &bull; {doc.date}</div>
                          <span className="text-[10px] text-emerald-700 font-medium">{doc.confidence}</span>
                        </div>
                        <Link
                          to={doc.actionUrl}
                          className="px-3 py-1 rounded-full text-xs font-bold bg-[#edf0ea] hover:bg-[#dfe4dc] text-[#1c221e] shrink-0"
                        >
                          Review
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Practice Feed */}
              <div className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between bg-[#fcfdfa]">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-[#1c221e]" />
                    <h3 className="font-bold text-[#141a16] text-sm">Practice Clinical Feed</h3>
                  </div>
                  <span className="text-xs text-[#718076] font-medium">Recent events</span>
                </div>

                <div className="divide-y divide-black/5 max-h-72 overflow-y-auto">
                  {recentActivities.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#718076]">No recent activity recorded.</div>
                  ) : (
                    recentActivities.map(act => (
                      <Link
                        key={`${act.type}-${act.id}`}
                        to={`/patients/${act.patientId}`}
                        className="p-3.5 block hover:bg-[#edf0ea]/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-bold text-[#141a16] flex items-center gap-1.5">
                            {act.type === 'consultation' ? <Stethoscope size={13} className="text-brand-600" /> :
                             act.type === 'prescription' ? <PillIcon size={13} className="text-purple-600" /> :
                             act.type === 'lab' ? <FlaskConical size={13} className="text-emerald-600" /> :
                             <FileText size={13} className="text-amber-600" />}
                            {act.title}
                          </span>
                          <span className="text-[10px] text-[#718076]">{act.date.toLocaleDateString()}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-brand-700">{act.patientName}</div>
                        <p className="text-[11px] text-[#526056] line-clamp-1 mt-0.5">{act.description}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: VISITS & ENCOUNTERS */}
        {activeTab === 'visits' && (
          <div className="proton-dashboard-visits bg-white rounded-3xl border border-black/5 p-6 shadow-xs space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <div>
                <h3 className="text-lg font-bold text-[#141a16]">Longitudinal Visits &amp; Consultations</h3>
                <p className="text-xs text-[#718076]">Chronological encounter history for {activePatientName}</p>
              </div>
              <button
                onClick={() => navigate(`/consultation?patient=${activePatient?.id || 'demo-eleanor-vance'}`)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#171717] text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} /> New Visit
              </button>
            </div>

            <div className="space-y-3">
              {[
                {
                  date: 'Today &bull; Oct 13, 2022',
                  type: 'Cardiology Ambulatory Follow-Up',
                  doctor: 'Dr. Alex Morgan, MD',
                  assessment: 'Stable on triple therapy (Lisinopril 20mg, Bisoprolol 5mg, Aspirin 81mg). BP 142/88 mmHg. Repeat HbA1c screening recommended.',
                  status: 'Completed & Signed'
                },
                {
                  date: 'Sep 10, 2022',
                  type: 'Medication Titration Encounter',
                  doctor: 'Dr. Alex Morgan, MD',
                  assessment: 'Step-up titration with Bisoprolol 5mg initiated. BP improved from 180/120 to 135/92 mmHg. Headache fully resolved.',
                  status: 'Completed & Signed'
                },
                {
                  date: 'Aug 5, 2022',
                  type: 'Initial Cardiology Evaluation',
                  doctor: 'Dr. Alex Morgan, MD',
                  assessment: 'Severe uncontrolled Stage 2 Hypertension with exertional cephalalgia. Ordered brain MRI and initiated baseline cardioprotection.',
                  status: 'Completed & Signed'
                }
              ].map((v, i) => (
                <div key={i} className="proton-visit-row p-4 bg-[#f8f9f6] rounded-2xl border border-black/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#141a16]">{v.type}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                        {v.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#718076] mt-0.5">{v.doctor} &bull; {v.date}</div>
                    <p className="text-xs text-[#526056] mt-1.5 leading-relaxed">{v.assessment}</p>
                  </div>
                  <div className="shrink-0">
                    <Link
                      to={`/consultation?patient=${activePatient?.id || 'demo-eleanor-vance'}`}
                      className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white hover:bg-slate-50 text-[#141a16] border border-black/10 inline-block shadow-2xs"
                    >
                      View Note
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: MEDICATIONS & TITRATIONS */}
        {activeTab === 'medications' && (
          <div className="bg-white rounded-3xl border border-black/5 p-6 shadow-xs space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <div>
                <h3 className="text-lg font-bold text-[#141a16]">Active Prescriptions &amp; Titration Trajectory</h3>
                <p className="text-xs text-[#718076]">Longitudinal pharmacotherapy for {activePatientName}</p>
              </div>
              <button
                onClick={() => navigate(`/patients/${activePatient?.id || 'demo-eleanor-vance'}`)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#171717] text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} /> Order Medication
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: 'Lisinopril',
                  dose: '20 mg oral tablet daily',
                  indication: 'Hypertension & Endothelial / Renal Protection',
                  titration: 'Baseline 10 mg &rarr; Titrated to 20 mg on Sep 2',
                  safety: 'Serum K+ 4.8 mEq/L (Normal) &bull; eGFR 68 mL/min'
                },
                {
                  name: 'Bisoprolol Fumarate',
                  dose: '5 mg oral tablet daily in morning',
                  indication: 'Rate Control & Afterload Reduction in Stage 2 HTN',
                  titration: 'Step 1: 2.5 mg (Aug 28) &rarr; Step 2: 5 mg (Sep 10)',
                  safety: 'Resting HR 84 bpm &bull; Negative bronchospasm history'
                },
                {
                  name: 'Metformin HCl',
                  dose: '500 mg oral tablet twice daily with meals',
                  indication: 'Type 2 Diabetes Mellitus Glycemic Control',
                  titration: 'Maintained on current dose &bull; HbA1c 7.1%',
                  safety: 'Stable renal function &bull; eGFR > 60 mL/min'
                },
                {
                  name: 'Aspirin (Delayed-Release)',
                  dose: '81 mg oral enteric-coated tablet daily',
                  indication: 'Secondary Cardiovascular Prophylaxis',
                  titration: 'Long-term maintenance &bull; Started Aug 5',
                  safety: 'No gastric distress &bull; Platelet count normal'
                }
              ].map((m, i) => (
                <div key={i} className="p-4 bg-[#f8f9f6] rounded-2xl border border-black/5 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#141a16] flex items-center gap-1.5">
                        <PillIcon size={14} className="text-[#3a443e]" />
                        <span>{m.name}</span>
                      </h4>
                      <p className="text-xs text-[#718076] font-medium">{m.dose}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <div className="text-xs text-[#526056] space-y-1 pt-1 border-t border-black/5">
                    <div><strong>Indication:</strong> {m.indication}</div>
                    <div><strong>Titration:</strong> {m.titration}</div>
                    <div className="text-[11px] text-emerald-800 font-medium"><strong>Safety check:</strong> {m.safety}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Medication safety note */}
            <div className="p-4 rounded-2xl bg-[#edf0ea] border border-black/5 flex items-start gap-3 text-xs text-[#455249]">
              <ShieldAlert size={18} className="text-[#454545] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#141a16] block mb-0.5">Medication safety review:</span>
                <p className="leading-relaxed">
                  Dual antihypertensive therapy (Lisinopril + Bisoprolol) achieves synergism with complementary renin-angiotensin-aldosterone and sympathetic nervous system inhibition. Baseline serum potassium monitoring confirmed safe.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: LABS & DIAGNOSTICS */}
        {activeTab === 'labs' && (
          <div className="bg-white rounded-3xl border border-black/5 p-6 shadow-xs space-y-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <div>
                <h3 className="text-lg font-bold text-[#141a16]">Longitudinal Laboratory Trends &amp; Diagnostics</h3>
                <p className="text-xs text-[#718076]">Diagnostic telemetry for {activePatientName}</p>
              </div>
              <button
                onClick={() => navigate(`/document-review?patient=${activePatient?.id || 'demo-eleanor-vance'}`)}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#1c221e] text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileText size={13} /> View Documents
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-[#f8f9f6] rounded-2xl border border-black/5">
                <span className="text-[#718076] font-medium block">Hemoglobin A1c</span>
                <div className="text-2xl font-bold text-[#141a16] my-1">7.1 %</div>
                <span className="text-emerald-700 font-bold text-[11px]">&darr; 0.3% from Aug (7.4%)</span>
              </div>

              <div className="p-4 bg-[#f8f9f6] rounded-2xl border border-black/5">
                <span className="text-[#718076] font-medium block">Serum Creatinine</span>
                <div className="text-2xl font-bold text-[#141a16] my-1">1.1 mg/dL</div>
                <span className="text-[#718076] text-[11px]">eGFR 68 mL/min (Stable)</span>
              </div>

              <div className="p-4 bg-[#f8f9f6] rounded-2xl border border-black/5">
                <span className="text-[#718076] font-medium block">Serum Potassium (K+)</span>
                <div className="text-2xl font-bold text-[#141a16] my-1">4.8 mEq/L</div>
                <span className="text-emerald-700 font-bold text-[11px]">Target normal range</span>
              </div>

              <div className="p-4 bg-[#f8f9f6] rounded-2xl border border-black/5">
                <span className="text-[#718076] font-medium block">LDL Cholesterol</span>
                <div className="text-2xl font-bold text-[#141a16] my-1">112 mg/dL</div>
                <span className="text-amber-800 font-bold text-[11px]">Lipid management target</span>
              </div>
            </div>

            <div className="p-4 bg-[#f8f9f6] rounded-2xl border border-black/5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img src="/assets/mri-scan.png" alt="Brain MRI" className="w-16 h-16 rounded-xl object-cover bg-black" />
                <div>
                  <h4 className="font-bold text-sm text-[#141a16]">Brain MRI (Axial T2 / FLAIR)</h4>
                  <p className="text-xs text-[#718076]">Aug 12, 2022 &bull; DICOM Reference #MR-9041</p>
                  <p className="text-xs text-[#526056] mt-0.5">Mild chronic microvascular ischemic changes (Fazekas Grade 1). No acute infarct.</p>
                </div>
              </div>
              <span className="text-xs font-bold text-brand-700 bg-white px-3 py-1 rounded-full border border-black/5 shadow-2xs">
                Verified by Radiology
              </span>
            </div>
          </div>
        )}

        {/* TAB 6: ALLERGIES */}
        {activeTab === 'allergies' && (
          <div className="bg-white rounded-3xl border border-black/5 p-6 shadow-xs space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <div>
                <h3 className="text-lg font-bold text-[#141a16]">Immunology &amp; Allergy Intolerances</h3>
                <p className="text-xs text-[#718076]">Safety-critical contraindication profile for {activePatientName}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-3.5">
                <ShieldAlert size={20} className="text-rose-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-rose-900">Penicillin &bull; Critical Allergy</h4>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-rose-200 text-rose-900">
                      High Severity / Anaphylaxis Risk
                    </span>
                  </div>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    Documented reaction: Urticaria, laryngeal edema, and respiratory distress during intravenous ampicillin treatment in 2018. Contraindicated for all beta-lactam antibiotics.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3.5">
                <AlertCircle size={20} className="text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-amber-900">Sulfa Antibiotics</h4>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-200 text-amber-900">
                      Moderate / Cutaneous Rash
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Maculopapular cutaneous rash noted with sulfamethoxazole/trimethoprim.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: GENETICS */}
        {activeTab === 'genetics' && (
          <div className="bg-white rounded-3xl border border-black/5 p-6 shadow-xs space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-black/5">
              <div>
                <h3 className="text-lg font-bold text-[#141a16]">Pharmacogenomics &amp; Precision Oncology / Cardiology</h3>
                <p className="text-xs text-[#718076]">Genotypic allele markers for {activePatientName}</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-700">
                Clinical decision support
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#f8f9f6] rounded-2xl border border-black/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-purple-900">CYP2C19</span>
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.2 rounded">*1/*2</span>
                </div>
                <div className="text-xs font-bold text-[#141a16]">Intermediate Metabolizer</div>
                <p className="text-[11px] text-[#718076] leading-relaxed">
                  Moderate reduction in clopidogrel active metabolite formation. Alternative antiplatelet agents (e.g., ticagrelor) recommended if stenting required.
                </p>
              </div>

              <div className="p-4 bg-[#f8f9f6] rounded-2xl border border-black/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-purple-900">VKORC1</span>
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.2 rounded">-1639G&gt;A</span>
                </div>
                <div className="text-xs font-bold text-[#141a16]">Increased Sensitivity</div>
                <p className="text-[11px] text-[#718076] leading-relaxed">
                  Heightened sensitivity to vitamin K antagonists. Requires 30% lower starting dose if warfarin is prescribed.
                </p>
              </div>

              <div className="p-4 bg-[#f8f9f6] rounded-2xl border border-black/5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-purple-900">SLCO1B1</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded">*5 Negative</span>
                </div>
                <div className="text-xs font-bold text-[#141a16]">Normal Statin Transport</div>
                <p className="text-[11px] text-[#718076] leading-relaxed">
                  Normal hepatic uptake of statins. Low risk of statin-induced myopathy on standard atorvastatin or rosuvastatin doses.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: START CONSULTATION PATIENT SELECTOR                      */}
        {/* ============================================================== */}
        {isConsultModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-[#f7f8f5] max-w-lg w-full rounded-3xl overflow-hidden shadow-2xl border border-black/10 animate-in zoom-in-95 duration-200">
              <div className="bg-[#e9ede4] px-6 py-4 border-b border-black/5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[#141a16] text-lg tracking-tight">Start New Consultation</h3>
                  <p className="text-xs text-[#718076] mt-0.5">Select a patient from your panel to launch the clinical copilot.</p>
                </div>
                <button 
                  onClick={() => setIsConsultModalOpen(false)}
                  className="text-[#718076] hover:text-[#141a16] p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6">
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3.5 top-3 text-[#718076] pointer-events-none" />
                  <input
                    type="text"
                    value={consultModalSearch}
                    onChange={(e) => setConsultModalSearch(e.target.value)}
                    placeholder="Search by patient name or MRN..."
                    className="w-full bg-white text-xs pl-10 pr-4 py-2.5 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black/10 font-medium"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-black/5 border border-black/5 rounded-2xl bg-white">
                  {filteredModalPatients.length === 0 ? (
                    <div className="p-6 text-center text-[#718076] text-xs">
                      No patients match your search.
                    </div>
                  ) : (
                    filteredModalPatients.map(p => {
                      const name = getPatientName(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setIsConsultModalOpen(false);
                            navigate(`/consultation?patient=${p.id}`);
                          }}
                          className="p-3.5 flex items-center justify-between hover:bg-[#edf0ea] cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-bold text-[#141a16] text-xs">{name}</div>
                            <div className="text-[11px] text-[#718076]">DOB: {p.birthDate || 'Unknown'} &bull; {p.gender || 'Unknown'}</div>
                          </div>
                          <span className="text-xs font-semibold text-brand-700 flex items-center gap-1">
                            Launch <ChevronRight size={14} />
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-[#e9ede4] px-6 py-3 border-t border-black/5 flex justify-end">
                <button
                  onClick={() => setIsConsultModalOpen(false)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold bg-white text-[#141a16] hover:bg-slate-100 transition-colors cursor-pointer border border-black/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ONBOARDING FLOW MODAL                                          */}
        {/* ============================================================== */}
        {showOnboarding && (
          <OnboardingFlow
            onComplete={() => {
              localStorage.setItem('proton_onboarding_complete', 'true');
              setShowOnboarding(false);
            }}
            onSkip={() => {
              localStorage.setItem('proton_onboarding_complete', 'true');
              setShowOnboarding(false);
            }}
          />
        )}

      </div>
    </Layout>
  );
}
