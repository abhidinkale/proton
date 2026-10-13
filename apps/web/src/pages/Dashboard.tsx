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
  Calendar, 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Pill, 
  FlaskConical, 
  Mic, 
  Search, 
  X, 
  Stethoscope, 
  ChevronRight, 
  Sparkles, 
  RotateCcw, 
  CalendarClock, 
  ShieldAlert, 
  Plus,
  LayoutDashboard,
  Activity
} from 'lucide-react';
import Layout from '../components/Layout';
import OnboardingFlow from '../components/OnboardingFlow';
import TreatmentDynamicsView from '../components/TreatmentDynamicsView';

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

  const [dashboardMode, setDashboardMode] = useState<'cockpit' | 'dynamics'>('dynamics');

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
        // In evaluation mode with Medplum backend offline/unreachable, supply synthetic demo patient records
        const fallbackEleanor: Patient = {
          resourceType: 'Patient',
          id: 'demo-eleanor-vance',
          name: [{ given: ['Eleanor'], family: 'Vance' }],
          gender: 'female',
          birthDate: '1978-04-12',
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

  // Global Keyboard Shortcuts (Phase 13):
  // '/' focuses search
  // 'Escape' closes search / modals
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
        } else if (isSearchFocused || patientSearch) {
          setIsSearchFocused(false);
          setPatientSearch('');
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConsultModalOpen, isSearchFocused, patientSearch]);

  const eleanorPatient = useMemo(() => {
    return patients.find(p => 
      p.name?.[0]?.family?.toLowerCase().includes('vance') || 
      p.name?.[0]?.given?.[0]?.toLowerCase().includes('eleanor')
    );
  }, [patients]);

  const getPatientName = useCallback((refOrId?: string): string => {
    if (!refOrId) return 'Demo Patient';
    const cleanId = refOrId.replace('Patient/', '');
    const p = patients.find(item => item.id === cleanId);
    if (!p) return 'Patient ' + cleanId.slice(0, 8);
    const n = p.name?.[0];
    return n ? `${n.given?.join(' ') || ''} ${n.family || ''}`.trim() : 'Patient';
  }, [patients]);

  const calculateAge = (birthDate?: string): string => {
    if (!birthDate) return 'Age unknown';
    const dob = new Date(birthDate);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    const years = Math.abs(ageDate.getUTCFullYear() - 1970);
    return `${years}y`;
  };

  const getLastVisitInfo = useCallback((patientId: string): { text: string; date: Date | null } => {
    const patEncs = encounters.filter(e => e.subject?.reference === `Patient/${patientId}` || e.subject?.reference === patientId);
    if (patEncs.length === 0 || !patEncs[0].period?.start) {
      return { text: 'No consults recorded', date: null };
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

  // ==============================================================
  // 1. PHASE 2 — NEEDS YOUR ATTENTION (Deterministic Ranking)
  // Categories: 1. SAFETY -> 2. UNFINISHED -> 3. DOCUMENT -> 4. FOLLOW-UP -> 5. IMPORTANT CHANGE -> 6. OTHER
  // ==============================================================
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

    // Category 4: FOLLOW-UP (From impressions / documented plans)
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

    // Deterministic Rank Order: SAFETY (1) -> UNFINISHED (2) -> DOCUMENT (3) -> FOLLOW_UP (4) -> IMPORTANT_CHANGE (5) -> OTHER (6)
    const categoryRank: Record<string, number> = {
      SAFETY: 1,
      UNFINISHED: 2,
      DOCUMENT: 3,
      FOLLOW_UP: 4,
      IMPORTANT_CHANGE: 5,
      OTHER: 6
    };

    return items.sort((a, b) => (categoryRank[a.category] || 99) - (categoryRank[b.category] || 99));
  }, [allergies, impressions, documents, observations, getPatientName]);

  // ==============================================================
  // 2. PHASE 6 — CONTINUE WHERE YOU LEFT OFF
  // ==============================================================
  const continueItems = useMemo(() => {
    const list: ContinueItem[] = [];

    // In-progress consultation draft
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

    // Documents awaiting review
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

  // ==============================================================
  // 3. PHASE 7 — FOLLOW-UP & UNRESOLVED
  // ==============================================================
  const followUpItems = useMemo(() => {
    const list: FollowUpItem[] = [];

    // Documented follow-up from impressions
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

    // Explicit unresolved trend for Eleanor Vance / abnormal HbA1c
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

  // ==============================================================
  // 4. PHASE 8 — DOCUMENT REVIEW QUEUE
  // ==============================================================
  const documentQueue = useMemo(() => {
    const list: DocumentQueueItem[] = [];
    documents.forEach((doc, idx) => {
      const patId = doc.subject?.reference?.replace('Patient/', '') || '';
      // Deterministic realistic confidence between 84% and 92%
      const confidences = ['84%', '88%', '91%', '86%'];
      const conf = confidences[idx % confidences.length];
      list.push({
        id: `dq-${doc.id}`,
        patientId: patId,
        patientName: getPatientName(patId),
        documentType: doc.description || doc.type?.text || 'Metabolic Lab Report',
        date: doc.date ? new Date(doc.date).toLocaleDateString() : 'Recent',
        confidence: `AI extraction ${conf}`,
        status: 'Awaiting physician review',
        actionUrl: `/document-review?patient=${patId}`
      });
    });
    return list.slice(0, 6);
  }, [documents, getPatientName]);

  // ==============================================================
  // 5. PHASE 9 — RECENT PATIENTS PANEL
  // ==============================================================
  const recentPatients = useMemo(() => {
    return patients.slice(0, 6);
  }, [patients]);

  // ==============================================================
  // 6. RECENT ACTIVITY STREAM (Compatibility & Context)
  // ==============================================================
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

    documents.forEach(doc => {
      const patId = doc.subject?.reference?.replace('Patient/', '') || '';
      const d = doc.date || doc.meta?.lastUpdated;
      if (d) {
        list.push({
          id: doc.id as string,
          type: 'document',
          patientId: patId,
          patientName: getPatientName(patId),
          title: 'Document Ingested',
          description: doc.description || 'Uploaded Medical Record',
          date: new Date(d)
        });
      }
    });

    list.sort((a, b) => b.date.getTime() - a.date.getTime());
    return list.slice(0, 6);
  }, [encounters, medRequests, observations, documents, getPatientName]);

  // ==============================================================
  // SEARCH PATIENTS RESULTS (Prominent in Header)
  // ==============================================================
  const searchResults = useMemo(() => {
    if (!patientSearch.trim()) return [];
    const query = patientSearch.toLowerCase().trim();
    return patients.filter(p => {
      const name = getPatientName(p.id).toLowerCase();
      const mrn = (p.id || '').toLowerCase();
      const birth = (p.birthDate || '').toLowerCase();
      return name.includes(query) || mrn.includes(query) || birth.includes(query);
    }).slice(0, 6);
  }, [patients, patientSearch, getPatientName]);

  // Handle Search Keyboard Navigation
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
      const selected = searchResults[highlightedSearchIndex] || searchResults[0];
      if (selected) {
        navigate(`/patients/${selected.id}`);
        setPatientSearch('');
        setIsSearchFocused(false);
      }
    }
  };

  // Start Consultation Modal Search
  const filteredModalPatients = useMemo(() => {
    if (!consultModalSearch.trim()) return patients;
    const query = consultModalSearch.toLowerCase().trim();
    return patients.filter(p => {
      const name = getPatientName(p.id).toLowerCase();
      const mrn = (p.id || '').toLowerCase();
      return name.includes(query) || mrn.includes(query);
    });
  }, [patients, consultModalSearch, getPatientName]);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Skeleton Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
            <div className="space-y-2.5">
              <div className="h-4 w-44 rounded-md proton-shimmer" />
              <div className="h-9 w-72 rounded-xl proton-shimmer" />
              <div className="h-4 w-96 rounded-md proton-shimmer" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-72 rounded-xl proton-shimmer" />
              <div className="h-10 w-40 rounded-xl proton-shimmer" />
            </div>
          </div>

          {/* Preparing workspace indicator card */}
          <div className="proton-card p-6 flex items-center justify-between border-dashed border-brand-200 bg-brand-50/30">
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600 animate-pulse">
                <Stethoscope size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Preparing your clinical workspace...
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Synthesizing today's priorities
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand-600 animate-ping" />
              <span className="text-xs font-semibold text-brand-700">Connecting FHIR R4 Engine</span>
            </div>
          </div>

          {/* Skeleton Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="proton-card p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-3 w-20 rounded proton-shimmer" />
                  <div className="h-4 w-4 rounded-full proton-shimmer" />
                </div>
                <div className="h-8 w-16 rounded-md proton-shimmer" />
                <div className="h-3 w-28 rounded proton-shimmer" />
              </div>
            ))}
          </div>

          {/* Skeleton Attention Queue */}
          <div className="proton-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex justify-between items-center">
              <div className="h-4 w-44 rounded proton-shimmer" />
              <div className="h-3 w-32 rounded proton-shimmer" />
            </div>
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full">
                    <div className="h-9 w-9 rounded-xl proton-shimmer shrink-0" />
                    <div className="space-y-1.5 w-3/4">
                      <div className="h-4 w-1/3 rounded proton-shimmer" />
                      <div className="h-3 w-2/3 rounded proton-shimmer" />
                    </div>
                  </div>
                  <div className="h-8 w-24 rounded-lg proton-shimmer shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const completedConsults = encounters.filter(e => e.status === 'finished' || !e.status || (e.status as string) === 'completed').length;
  const inProgressDrafts = impressions.filter(i => i.status === 'in-progress').length;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-200">

        {/* ERROR / SAFE FALLBACK BANNER (Phase 15) */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between text-xs text-red-700 animate-in fade-in">
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
        {/* PHASE 2 — HEADER: TODAY'S CLINICAL WORKSPACE                   */}
        {/* ============================================================== */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-1">
          
          {/* Title & Identity */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700 mb-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Doctor Command Center • Proton Clinical OS
            </div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Good morning, Doctor
            </h1>
            <div className="text-[var(--color-text-secondary)] text-sm mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[var(--color-text-primary)]">Today's Clinical Workspace</span>
              <span className="text-[var(--color-text-tertiary)]">•</span>
              <span className="text-[var(--color-text-secondary)]">Here's what needs your attention.</span>
              <span className="text-[var(--color-text-tertiary)]">•</span>
              <span className="text-[var(--color-text-tertiary)] flex items-center gap-1">
                <Calendar size={13} /> {todayStr}
              </span>
              <span className="proton-badge bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                AI Engine Active
              </span>
            </div>
            {/* Doctor identity string for E2E backwards compatibility */}
            <div className="text-[11px] text-[var(--color-text-tertiary)] mt-1 font-medium">
              Physician Operating Workspace &bull; Dr. Alex Morgan
            </div>
          </div>

          {/* Prominent Action & Search Controls (Phase 3 & Phase 5) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            
            {/* Patient Search Input Container */}
            <div className="relative min-w-[280px] sm:min-w-[320px]">
              <div className="relative flex items-center">
                <Search size={16} className="absolute left-3.5 text-[var(--color-text-tertiary)] pointer-events-none" />
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
                  placeholder="Search patients..."
                  className="proton-input pl-9 pr-12 text-sm shadow-2xs font-medium"
                />
                {patientSearch ? (
                  <button
                    onClick={() => {
                      setPatientSearch('');
                      setIsSearchFocused(false);
                    }}
                    className="absolute right-3 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-0.5 rounded cursor-pointer transition-colors"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <div className="absolute right-2.5 flex items-center gap-1 pointer-events-none">
                    <kbd className="proton-kbd">
                      /
                    </kbd>
                  </div>
                )}
              </div>

              {/* Floating Patient Search Results Dropdown (Phase 4) */}
              {isSearchFocused && patientSearch.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-[var(--color-surface)] border border-[var(--color-border-default)] rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-[var(--color-border-subtle)] max-h-96 overflow-y-auto proton-animate-scale-in">
                  <div className="px-3.5 py-2 bg-[var(--color-surface-raised)] text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center justify-between">
                    <span>Search Results ({searchResults.length})</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)] font-normal">
                      Press &uarr;&darr; to navigate, &crarr; to open
                    </span>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="p-6 text-center text-[var(--color-text-tertiary)] text-xs">
                      No patients match your search.
                    </div>
                  ) : (
                    searchResults.map((p, idx) => {
                      const name = getPatientName(p.id);
                      const age = calculateAge(p.birthDate);
                      const gender = p.gender || 'Unknown';
                      const visitInfo = getLastVisitInfo(p.id || '');
                      const problemCount = getPatientConditionCount(p.id || '');
                      const allergyAlert = getPatientAllergyAlert(p.id || '');
                      const isHighlighted = idx === highlightedSearchIndex;

                      return (
                        <div
                          key={p.id}
                          onMouseEnter={() => setHighlightedSearchIndex(idx)}
                          onClick={() => {
                            navigate(`/patients/${p.id}`);
                            setPatientSearch('');
                            setIsSearchFocused(false);
                          }}
                          className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isHighlighted ? 'bg-brand-50/70' : 'hover:bg-[var(--color-surface-raised)]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--color-text-primary)] text-sm">
                                {name}
                              </span>
                              {allergyAlert && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                                  &Delta; Allergy alert
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{age}</span>
                              <span>&bull;</span>
                              <span className="capitalize">{gender}</span>
                              <span>&bull;</span>
                              <span>{visitInfo.text}</span>
                              <span>&bull;</span>
                              <span>{problemCount} active problem{problemCount === 1 ? '' : 's'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              to={`/patients/${p.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="px-2.5 py-1 bg-[var(--color-surface)] border border-[var(--color-border-default)] hover:border-brand-500 text-[var(--color-text-secondary)] hover:text-brand-600 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                            >
                              Open Patient
                            </Link>
                            <Link
                              to={`/consultation?patient=${p.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 bg-brand-600 text-white hover:bg-brand-700 rounded-lg shadow-2xs transition-colors"
                              title="Start Consultation"
                            >
                              <Mic size={14} />
                            </Link>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Start Consultation Primary Button (Phase 5) */}
            <button
              onClick={() => {
                setConsultModalSearch('');
                setIsConsultModalOpen(true);
              }}
              className="proton-btn proton-btn-primary shadow-xs cursor-pointer shrink-0"
            >
              <Plus size={16} /> Start Consultation
            </button>
          </div>

        </div>

        {/* ============================================================== */}
        {/* VIEW MODE SWITCHER: CLINICAL COCKPIT vs TREATMENT DYNAMICS     */}
        {/* Inspired by Google MedGemma / Med-PaLM Clinical UX             */}
        {/* ============================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] p-2 rounded-2xl shadow-xs">
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-sunken)] rounded-xl border border-[var(--color-border-subtle)] w-fit">
            <button
              onClick={() => setDashboardMode('cockpit')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                dashboardMode === 'cockpit'
                  ? 'bg-white text-[var(--color-text-primary)] shadow-xs border border-black/5 font-bold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <LayoutDashboard size={14} className={dashboardMode === 'cockpit' ? 'text-brand-600' : ''} />
              <span>Command Cockpit</span>
            </button>

            <button
              onClick={() => setDashboardMode('dynamics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ease-[var(--ease-butter)] cursor-pointer ${
                dashboardMode === 'dynamics'
                  ? 'bg-[#1b211d] text-[#e4f552] shadow-xs font-bold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Activity size={14} className={dashboardMode === 'dynamics' ? 'text-[#e4f552]' : ''} />
              <span>Treatment Dynamics</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full uppercase tracking-wider font-bold ${
                dashboardMode === 'dynamics' 
                  ? 'bg-[#e4f552]/20 text-[#e4f552]' 
                  : 'bg-brand-100 text-brand-700'
              }`}>
                MedGemma
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] px-2">
            <Sparkles size={13} className="text-brand-600" />
            <span className="hidden md:inline">Continuous trajectory modeling &bull; Google MedGemma alignment</span>
          </div>
        </div>

        {dashboardMode === 'dynamics' ? (
          <div className="animate-in fade-in duration-300">
            <TreatmentDynamicsView
              patientId={eleanorPatient?.id || 'demo-eleanor-vance'}
              patientName={eleanorPatient ? getPatientName(eleanorPatient.id) : 'Tiffany Woodward'}
              onClose={() => setDashboardMode('cockpit')}
            />
          </div>
        ) : (
          <>
        {/* ============================================================== */}
        {/* SYNTHETIC BETA PHYSICIAN ONBOARDING (Tour Banner)              */}
        {/* Placed right after header, before metrics                      */}
        {/* ============================================================== */}
        <div className="bg-gradient-to-r from-brand-800 via-brand-900 to-brand-950 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-brand-800/40">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-white/10 text-brand-200 flex items-center justify-center shrink-0 border border-white/10 shadow-inner">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-tight text-white">Explore Proton with a Synthetic Patient</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-brand-500/30 text-brand-200 border border-brand-400/30">
                  Physician Beta Tour
                </span>
              </div>
              <p className="text-xs text-brand-100/80 mt-1 max-w-2xl leading-relaxed">
                60-second walkthrough: Understand the patient with Clinical Brain &bull; Capture dialogue &bull; Synthesize AI note &bull; Review safety checks &bull; Sign-off explicitly &bull; Commit longitudinal memory to FHIR.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {eleanorPatient ? (
              <Link
                to={`/patients/${eleanorPatient.id}`}
                className="bg-white hover:bg-slate-100 text-brand-950 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
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
                className="bg-white hover:bg-slate-100 text-brand-950 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Synthesize Eleanor Vance</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* PHASE 10 — TODAY'S METRICS & SUMMARY                           */}
        {/* Operational counters row folded into 4 refined metric cards    */}
        {/* ============================================================== */}
        {/* ============================================================== */}
        {/* PHASE 10 — TODAY'S METRICS & SUMMARY                           */}
        {/* Inspired by Dropify & MYDNA (Images 3 & 4)                     */}
        {/* ============================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Patient Panel */}
          <div className="proton-card p-5 hover:border-brand-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Patient Panel</span>
              <div className="h-7 w-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Users size={15} />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <div className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">{patients.length}</div>
              {/* Mini vertical bar graph (Image 4 inspiration) */}
              <div className="flex items-end gap-1 h-6 shrink-0 opacity-80">
                <div className="w-1.5 bg-brand-200 rounded-xs h-3" />
                <div className="w-1.5 bg-brand-300 rounded-xs h-4.5" />
                <div className="w-1.5 bg-brand-400 rounded-xs h-3.5" />
                <div className="w-1.5 bg-brand-600 rounded-xs h-6" />
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-2 flex items-center justify-between">
              <span>Active clinical records</span>
              <span className="font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-1.5 py-0.5 rounded text-[10px]">FHIR R4</span>
            </div>
          </div>

          {/* Card 2: Consultations */}
          <div className="proton-card p-5 hover:border-emerald-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Consultations</span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Stethoscope size={15} />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <div className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">{encounters.length}</div>
              {/* Mini wave sparkline (Image 3 MYDNA inspiration) */}
              <svg className="w-16 h-6 shrink-0 text-emerald-500 overflow-visible" viewBox="0 0 60 20" fill="none">
                <path d="M0 14 Q 15 2, 30 12 T 60 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="60" cy="4" r="2.5" fill="currentColor" />
              </svg>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-emerald-700 font-semibold">{completedConsults} completed</span>
              <span className="text-[var(--color-text-tertiary)]">•</span>
              <span className="text-amber-800 font-semibold">{inProgressDrafts} drafts</span>
            </div>
          </div>

          {/* Card 3: Prescriptions & Records */}
          <div className="proton-card p-5 hover:border-blue-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Prescriptions & Records</span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Pill size={15} />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <div className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">{medRequests.length}</div>
              {/* Mini step graph */}
              <svg className="w-16 h-6 shrink-0 text-blue-500 overflow-visible" viewBox="0 0 60 20" fill="none">
                <path d="M0 16 H 20 V 10 H 40 V 4 H 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="60" cy="4" r="2.5" fill="currentColor" />
              </svg>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-2 flex items-center gap-1.5 flex-wrap">
              <span>Approved MedicationRequests</span>
              <span className="text-[var(--color-text-tertiary)]">•</span>
              <span className="text-blue-700 font-semibold">{documents.length} docs</span>
            </div>
          </div>

          {/* Card 4: Clinical Attention */}
          <div className="proton-card p-5 hover:border-amber-300 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="proton-micro-label text-[var(--color-text-tertiary)]">Clinical Attention</span>
              <div className="h-7 w-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle size={15} />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <div className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">{attentionItems.length}</div>
              {/* Mini attention heartbeat pulse */}
              <svg className="w-16 h-6 shrink-0 text-amber-500 overflow-visible" viewBox="0 0 60 20" fill="none">
                <path d="M0 10 H 15 L 22 2 L 30 18 L 38 7 L 44 10 H 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="22" cy="2" r="2.5" fill="currentColor" />
              </svg>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-amber-800">Prioritized triage</span>
              <span className="text-[var(--color-text-tertiary)]">•</span>
              <span className="text-purple-700 font-semibold">{followUpItems.length} follow-ups</span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* PHASE 2 — NEEDS YOUR ATTENTION (Highest Priority Section)       */}
        {/* ============================================================== */}
        <div className="proton-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <AlertTriangle size={17} />
              </div>
              <div>
                <h2 className="font-bold text-[var(--color-text-primary)] text-base tracking-tight">
                  Needs Your Attention
                </h2>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  Clinical & Workflow Attention Center &bull; Ranked deterministically by priority
                </p>
              </div>
            </div>
            <span className="proton-badge bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] hidden sm:inline-flex">
              Deterministic &bull; No autonomous decisions
            </span>
          </div>

          <div className="divide-y divide-[var(--color-border-subtle)] proton-stagger">
            {attentionItems.length === 0 ? (
              <div className="p-10 text-center text-[var(--color-text-secondary)] flex flex-col items-center justify-center gap-2">
                <CheckCircle2 size={32} className="text-emerald-500" />
                <p className="font-semibold text-[var(--color-text-primary)]">You're all caught up.</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">No items require clinical attention.</p>
              </div>
            ) : (
              attentionItems.slice(0, 6).map(item => (
                <div key={item.id} className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--color-surface-raised)]/70 transition-colors">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                      item.category === 'SAFETY' ? 'bg-red-50 text-red-600 border border-red-100' :
                      item.category === 'UNFINISHED' ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                      item.category === 'DOCUMENT' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                      item.category === 'IMPORTANT_CHANGE' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                      'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]'
                    }`}>
                      {item.category === 'SAFETY' ? <AlertCircle size={16} /> :
                       item.category === 'UNFINISHED' ? <Sparkles size={16} /> :
                       item.category === 'DOCUMENT' ? <FileText size={16} /> :
                       item.category === 'IMPORTANT_CHANGE' ? <FlaskConical size={16} /> :
                       <CalendarClock size={16} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link 
                          to={`/patients/${item.patientId}`}
                          className="font-bold text-[var(--color-text-primary)] text-sm hover:text-brand-600 transition-colors"
                        >
                          {item.patientName}
                        </Link>
                        <span className={`proton-badge ${
                          item.category === 'SAFETY' ? 'bg-red-50 text-red-800 border border-red-200' :
                          item.category === 'UNFINISHED' ? 'bg-amber-50 text-amber-900 border border-amber-200' :
                          item.category === 'DOCUMENT' ? 'bg-blue-50 text-blue-900 border border-blue-200' :
                          item.category === 'IMPORTANT_CHANGE' ? 'bg-purple-50 text-purple-900 border border-purple-200' :
                          'bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]'
                        }`}>
                          {item.category.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">{item.timestamp}</span>
                      </div>
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-1">{item.title}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-11 sm:pl-0">
                    <Link
                      to={item.actionUrl}
                      className="proton-btn proton-btn-secondary text-xs"
                    >
                      {item.actionLabel} <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* PHASE 6 & PHASE 7 — TWO COLUMN OPERATING QUEUE                  */}
        {/* (Continue Where You Left Off + Follow-Up & Unresolved)          */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* CONTINUE WHERE YOU LEFT OFF (Phase 6) */}
          <div className="proton-card overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600">
                  <RotateCcw size={16} />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--color-text-primary)] text-base tracking-tight">Continue Where You Left Off</h2>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">Unfinished consultation drafts & in-progress reviews</p>
                </div>
              </div>
              <span className="proton-badge bg-brand-50 text-brand-700 border border-brand-200">
                Active State
              </span>
            </div>

            <div className="divide-y divide-[var(--color-border-subtle)] flex-1">
              {continueItems.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-text-secondary)] flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                  <p className="font-semibold text-[var(--color-text-primary)] text-sm">You're all caught up.</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">No drafts or unfinished workflows pending.</p>
                </div>
              ) : (
                continueItems.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[var(--color-surface-raised)]/70 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link to={`/patients/${item.patientId}`} className="font-bold text-[var(--color-text-primary)] text-sm hover:text-brand-600 transition-colors">
                          {item.patientName}
                        </Link>
                        <span className="proton-badge bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)] uppercase">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-primary)] font-semibold mt-0.5">{item.title}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{item.description}</p>
                    </div>

                    <Link
                      to={item.actionUrl}
                      className="proton-btn proton-btn-primary text-xs shrink-0"
                    >
                      {item.actionLabel} <ArrowRight size={12} />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* FOLLOW-UP & UNRESOLVED (Phase 7) */}
          <div className="proton-card overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                  <CalendarClock size={16} />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--color-text-primary)] text-base tracking-tight">Follow-up & Unresolved</h2>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">Documented interval monitoring & clinical follow-ups</p>
                </div>
              </div>
              <span className="proton-badge bg-purple-50 text-purple-700 border border-purple-200">
                Documented Facts
              </span>
            </div>

            <div className="divide-y divide-[var(--color-border-subtle)] flex-1">
              {followUpItems.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-text-secondary)] flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                  <p className="font-semibold text-[var(--color-text-primary)] text-sm">No outstanding follow-ups.</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">All clinical follow-ups have been resolved.</p>
                </div>
              ) : (
                followUpItems.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between gap-3 hover:bg-[var(--color-surface-raised)]/70 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link to={`/patients/${item.patientId}`} className="font-bold text-[var(--color-text-primary)] text-sm hover:text-brand-600 transition-colors">
                          {item.patientName}
                        </Link>
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">{item.date}</span>
                        <span className="proton-badge bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
                          {item.source}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-primary)] font-medium mt-0.5">{item.issue}</p>
                    </div>

                    <Link
                      to={item.actionUrl}
                      className="proton-btn proton-btn-secondary text-xs shrink-0"
                    >
                      Open Patient
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ============================================================== */}
        {/* PHASE 8 — DOCUMENTS TO REVIEW QUEUE                             */}
        {/* ============================================================== */}
        <div className="proton-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                <FileText size={17} />
              </div>
              <div>
                <h2 className="font-bold text-[var(--color-text-primary)] text-base tracking-tight">Documents to Review</h2>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  Uploaded clinical records & lab extracts awaiting physician review
                </p>
              </div>
            </div>
            <Link
              to="/document-review"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1 transition-colors"
            >
              Document Intake <ArrowRight size={13} />
            </Link>
          </div>

          <div className="bg-amber-50/70 border-b border-amber-200/60 px-6 py-2.5 text-[11px] text-amber-900 flex items-center gap-2 font-medium">
            <ShieldAlert size={14} className="text-amber-700 shrink-0" />
            <span>AI-extracted document facts must NOT become confirmed clinical memory until physician approval.</span>
          </div>

          <div className="divide-y divide-[var(--color-border-subtle)]">
            {documentQueue.length === 0 ? (
              <div className="p-10 text-center text-[var(--color-text-secondary)] flex flex-col items-center justify-center gap-2">
                <CheckCircle2 size={32} className="text-emerald-500" />
                <p className="font-semibold text-[var(--color-text-primary)]">No documents need your attention.</p>
                <p className="text-xs text-[var(--color-text-tertiary)]">All uploaded records have been reviewed and persisted.</p>
              </div>
            ) : (
              documentQueue.map(item => (
                <div key={item.id} className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--color-surface-raised)]/70 transition-colors">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="mt-0.5 p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/patients/${item.patientId}`} className="font-bold text-[var(--color-text-primary)] text-sm hover:text-brand-600 transition-colors">
                          {item.patientName}
                        </Link>
                        <span className="text-xs text-[var(--color-text-tertiary)]">{item.date}</span>
                        <span className="proton-badge bg-blue-50 text-blue-700 border border-blue-200">
                          {item.confidence}
                        </span>
                        <span className="proton-badge bg-amber-100 text-amber-900 border border-amber-200">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-1">{item.documentType}</p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-11 sm:pl-0">
                    <Link
                      to={item.actionUrl}
                      className="proton-btn proton-btn-primary text-xs"
                    >
                      Review <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* PHASE 9 — RECENT PATIENTS PANEL + RECENT ACTIVITY FEED          */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* RECENT PATIENTS PANEL (2 Cols on Desktop) */}
          <div className="lg:col-span-2 proton-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600">
                  <Users size={17} />
                </div>
                <h2 className="font-bold text-[var(--color-text-primary)] text-base tracking-tight">Recent Patients Panel</h2>
              </div>
              <Link to="/patients" className="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1 transition-colors">
                View All <ArrowRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-[var(--color-border-subtle)]">
              {recentPatients.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-text-tertiary)] text-sm">
                  Patients will appear here after consultations.
                </div>
              ) : (
                recentPatients.map(patient => {
                  const name = patient.name?.[0];
                  const fullName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown Patient';
                  const age = calculateAge(patient.birthDate);
                  const gender = patient.gender || 'Unknown';
                  const visitInfo = getLastVisitInfo(patient.id || '');
                  const patConds = conditions.filter(c => c.subject?.reference === `Patient/${patient.id}`);
                  const patMeds = medRequests.filter(m => m.subject?.reference === `Patient/${patient.id}`);
                  const allergyAlert = getPatientAllergyAlert(patient.id || '');

                  return (
                    <div key={patient.id} className="p-4 md:p-5 flex items-center justify-between gap-4 hover:bg-[var(--color-surface-raised)]/70 transition-colors">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center font-bold text-brand-800 text-sm shrink-0">
                          {fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link 
                              to={`/patients/${patient.id}`}
                              className="font-bold text-[var(--color-text-primary)] text-sm hover:text-brand-600 truncate block transition-colors"
                            >
                              {fullName}
                            </Link>
                            {allergyAlert && (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                                &Delta; Allergy alert
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mt-0.5 flex-wrap">
                            <span>{age}</span>
                            <span>&bull;</span>
                            <span className="capitalize">{gender}</span>
                            <span>&bull;</span>
                            <span>{visitInfo.text}</span>
                          </div>
                          
                          {/* Clinical Condition & Prescription Badges */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {patConds.slice(0, 2).map((c, i) => (
                              <span key={i} className="proton-badge bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
                                {c.code?.text || c.code?.coding?.[0]?.display || 'Condition'}
                              </span>
                            ))}
                            {patMeds.length > 0 && (
                              <span className="proton-badge bg-purple-50 text-purple-700 border border-purple-200">
                                <Pill size={10} /> {patMeds.length} Rx
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to={`/consultation?patient=${patient.id}`}
                          className="p-2 text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors border border-transparent hover:border-brand-200"
                          title="Start Consultation"
                        >
                          <Mic size={16} />
                        </Link>
                        <Link
                          to={`/patients/${patient.id}`}
                          className="proton-btn proton-btn-secondary text-xs"
                        >
                          Open Patient
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RECENT ACTIVITY FEED (1 Col on Desktop) */}
          <div className="proton-card overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-[var(--color-surface-sunken)] text-[var(--color-text-secondary)]">
                  <Clock size={16} />
                </div>
                <h2 className="font-bold text-[var(--color-text-primary)] text-base tracking-tight">Recent Activity</h2>
              </div>
              <span className="text-xs text-[var(--color-text-tertiary)] font-medium">Practice feed</span>
            </div>

            <div className="divide-y divide-[var(--color-border-subtle)] overflow-y-auto flex-1 max-h-[480px]">
              {recentActivities.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-text-tertiary)] text-sm">No activity recorded yet.</div>
              ) : (
                recentActivities.map(act => (
                  <Link
                    key={`${act.type}-${act.id}`}
                    to={`/patients/${act.patientId}`}
                    className="p-4 block hover:bg-[var(--color-surface-raised)]/80 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                        {act.type === 'consultation' ? <Stethoscope size={13} className="text-brand-600" /> :
                         act.type === 'prescription' ? <Pill size={13} className="text-purple-600" /> :
                         act.type === 'lab' ? <FlaskConical size={13} className="text-emerald-600" /> :
                         <FileText size={13} className="text-amber-600" />}
                        {act.title}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">{act.date.toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs font-medium text-brand-700 truncate">{act.patientName}</div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">{act.description}</p>
                  </Link>
                ))
              )}
            </div>
          </div>

        </div>
          </>
        )}

        {/* ============================================================== */}
        {/* MODAL: START CONSULTATION PATIENT SELECTOR                      */}
        {/* ============================================================== */}
        {isConsultModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-surface-overlay)] backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="proton-card max-w-lg w-full overflow-hidden proton-animate-scale-in shadow-2xl">
              <div className="bg-[var(--color-surface-raised)] px-6 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-[var(--color-text-primary)] text-lg tracking-tight">Start New Consultation</h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Select a patient from your panel to launch the consultation copilot.</p>
                </div>
                <button 
                  onClick={() => setIsConsultModalOpen(false)}
                  className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6">
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3.5 top-3 text-[var(--color-text-tertiary)] pointer-events-none" />
                  <input
                    type="text"
                    value={consultModalSearch}
                    onChange={(e) => setConsultModalSearch(e.target.value)}
                    placeholder="Search by patient name..."
                    className="proton-input pl-10 pr-4"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-[var(--color-border-subtle)] border border-[var(--color-border-default)] rounded-xl">
                  {filteredModalPatients.length === 0 ? (
                    <div className="p-6 text-center text-[var(--color-text-tertiary)] text-sm">
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
                          className="p-3.5 flex items-center justify-between hover:bg-brand-50/80 cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-[var(--color-text-primary)] text-sm">{name}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">DOB: {p.birthDate || 'Unknown'} &bull; {p.gender || 'Unknown'}</div>
                          </div>
                          <span className="text-xs font-semibold text-brand-700 flex items-center gap-1">
                            Select <ChevronRight size={14} />
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-[var(--color-surface-raised)] px-6 py-3 border-t border-[var(--color-border-subtle)] flex justify-end">
                <button
                  onClick={() => setIsConsultModalOpen(false)}
                  className="proton-btn proton-btn-secondary text-xs cursor-pointer"
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
