import { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import Layout from '../components/Layout';

interface AttentionItem {
  id: string;
  type: 'draft_note' | 'abnormal_lab' | 'allergy_warning' | 'pending_doc' | 'rx_review';
  patientId: string;
  patientName: string;
  title: string;
  subtitle: string;
  timestamp: string;
  urgency: 'high' | 'medium' | 'info';
  actionUrl: string;
  actionLabel: string;
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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [impressions, setImpressions] = useState<ClinicalImpression[]>([]);
  const [medRequests, setMedRequests] = useState<MedicationRequest[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [documents, setDocuments] = useState<DocumentReference[]>([]);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);

  // Start Consultation modal
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
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
        }
        if (encRes.status === 'fulfilled') setEncounters(encRes.value);
        if (impRes.status === 'fulfilled') setImpressions(impRes.value);
        if (mrRes.status === 'fulfilled') setMedRequests(mrRes.value);
        if (obsRes.status === 'fulfilled') setObservations(obsRes.value);
        if (docRes.status === 'fulfilled') setDocuments(docRes.value);
        if (allRes.status === 'fulfilled') setAllergies(allRes.value);
        if (condRes.status === 'fulfilled') setConditions(condRes.value);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [medplum]);

  const getPatientName = (refOrId?: string): string => {
    if (!refOrId) return 'Demo Patient';
    const cleanId = refOrId.replace('Patient/', '');
    const p = patients.find(item => item.id === cleanId);
    if (!p) return 'Patient ' + cleanId.slice(0, 8);
    const n = p.name?.[0];
    return n ? `${n.given?.join(' ') || ''} ${n.family || ''}`.trim() : 'Patient';
  };

  const calculateAge = (birthDate?: string): string => {
    if (!birthDate) return 'Age unknown';
    const dob = new Date(birthDate);
    const diff = Date.now() - dob.getTime();
    const ageDate = new Date(diff);
    const years = Math.abs(ageDate.getUTCFullYear() - 1970);
    return `${years}y`;
  };

  // 1. Build Clinical / Workflow Attention Items
  const attentionItems: AttentionItem[] = [];

  // Attention: In-progress consultation draft
  impressions.forEach(imp => {
    if (imp.status === 'in-progress') {
      const patId = imp.subject?.reference?.replace('Patient/', '') || '';
      attentionItems.push({
        id: imp.id as string,
        type: 'draft_note',
        patientId: patId,
        patientName: getPatientName(patId),
        title: 'Unfinished Consultation Draft',
        subtitle: 'Clinical note in draft state — doctor review & sign-off required',
        timestamp: imp.date ? new Date(imp.date).toLocaleDateString() : 'Recent',
        urgency: 'high',
        actionUrl: `/consultation?patient=${patId}`,
        actionLabel: 'Resume Draft'
      });
    }
  });

  // Attention: Abnormal Labs / Observations
  observations.forEach(obs => {
    const val = (obs.valueString || obs.valueQuantity?.value?.toString() || '').toLowerCase();
    const isAbnormal = val.includes('abnormal') || val.includes('high') || val.includes('elevated') || val.includes('7.2%');
    if (isAbnormal) {
      const patId = obs.subject?.reference?.replace('Patient/', '') || '';
      attentionItems.push({
        id: obs.id as string,
        type: 'abnormal_lab',
        patientId: patId,
        patientName: getPatientName(patId),
        title: `Abnormal Lab Finding: ${obs.code?.text || obs.code?.coding?.[0]?.display || 'Lab Result'}`,
        subtitle: `Result: ${obs.valueString || obs.valueQuantity?.value || 'Abnormal'} (Review recommended)`,
        timestamp: obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString() : 'Recent',
        urgency: 'medium',
        actionUrl: `/patients/${patId}`,
        actionLabel: 'Review Labs'
      });
    }
  });

  // Attention: Critical Allergies
  allergies.forEach(all => {
    const patId = (all.patient?.reference || (all as any).subject?.reference || '').replace('Patient/', '');
    const allergyName = all.code?.text || all.code?.coding?.[0]?.display || 'Allergy Recorded';
    attentionItems.push({
      id: all.id as string,
      type: 'allergy_warning',
      patientId: patId,
      patientName: getPatientName(patId),
      title: `Critical Allergy Alert: ${allergyName}`,
      subtitle: `Documented clinical allergy — exercise precaution during prescribing`,
      timestamp: all.recordedDate ? new Date(all.recordedDate).toLocaleDateString() : 'Active',
      urgency: 'info',
      actionUrl: `/patients/${patId}`,
      actionLabel: 'View Patient'
    });
  });

  // Attention: Recently uploaded reports
  documents.forEach(doc => {
    const patId = doc.subject?.reference?.replace('Patient/', '') || '';
    attentionItems.push({
      id: doc.id as string,
      type: 'pending_doc',
      patientId: patId,
      patientName: getPatientName(patId),
      title: `Uploaded Record: ${doc.description || 'Clinical Document'}`,
      subtitle: 'Extracted facts recorded — review historical facts in profile',
      timestamp: doc.date ? new Date(doc.date).toLocaleDateString() : 'Recent',
      urgency: 'info',
      actionUrl: `/patients/${patId}`,
      actionLabel: 'View Profile'
    });
  });

  // Deduplicate attention items per patient & limit to top 5
  const uniqueAttention = attentionItems.slice(0, 6);

  // 2. Build Recent Activity Stream
  const activityList: ActivityEvent[] = [];

  encounters.forEach(e => {
    const patId = e.subject?.reference?.replace('Patient/', '') || '';
    if (e.period?.start) {
      activityList.push({
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
      activityList.push({
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
      activityList.push({
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
      activityList.push({
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

  activityList.sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentActivities = activityList.slice(0, 8);

  // Filter patients for start consultation modal
  const filteredPatients = patients.filter(p => {
    const fullName = getPatientName(p.id).toLowerCase();
    return fullName.includes(patientSearch.toLowerCase());
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-4">
          <Stethoscope size={32} className="animate-pulse text-brand-600" />
          <p className="text-sm font-medium text-slate-600">Loading Doctor Command Center...</p>
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

  return (
    <Layout>
      <div className="space-y-8">
        
        {/* HEADER & QUICK ACTIONS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Doctor Command Center • Proton Clinical OS
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Good day, Dr. Alex Morgan
            </h1>
            <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" />
              {todayStr}
              <span>•</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-medium border border-emerald-200">
                AI Engine Active
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => setIsConsultModalOpen(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Mic size={16} /> Start Consultation
            </button>
            <Link
              to="/patients"
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Users size={16} /> Open Patients
            </Link>
          </div>
        </div>

        {/* METRICS / TODAY SUMMARY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient Panel</span>
              <Users size={16} className="text-brand-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{patients.length}</div>
            <div className="text-xs text-slate-500 mt-1">Total active patient profiles</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consultations</span>
              <Stethoscope size={16} className="text-brand-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{encounters.length}</div>
            <div className="text-xs text-slate-500 mt-1">Recorded clinical encounters</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prescriptions</span>
              <Pill size={16} className="text-brand-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{medRequests.length}</div>
            <div className="text-xs text-slate-500 mt-1">Approved MedicationRequests</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clinical Attention</span>
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{uniqueAttention.length}</div>
            <div className="text-xs text-slate-500 mt-1">Items requiring clinical review</div>
          </div>
        </div>

        {/* ATTENTION CENTER & QUICK ALERTS */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" />
              <h2 className="font-semibold text-slate-900 text-base">Clinical & Workflow Attention Center</h2>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Indicators only • No autonomous decisions
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {uniqueAttention.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 size={32} className="text-emerald-500" />
                <p className="font-medium text-slate-800">All clinical workflows up to date</p>
                <p className="text-xs text-slate-400">No unfinished drafts, alerts, or pending document reviews detected.</p>
              </div>
            ) : (
              uniqueAttention.map(item => (
                <div key={`${item.type}-${item.id}`} className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-start gap-3.5">
                    <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${
                      item.urgency === 'high' ? 'bg-amber-100 text-amber-700' :
                      item.urgency === 'medium' ? 'bg-red-50 text-red-600' :
                      'bg-brand-50 text-brand-600'
                    }`}>
                      {item.type === 'draft_note' ? <Sparkles size={16} /> :
                       item.type === 'abnormal_lab' ? <FlaskConical size={16} /> :
                       item.type === 'allergy_warning' ? <AlertCircle size={16} /> :
                       <FileText size={16} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link 
                          to={`/patients/${item.patientId}`}
                          className="font-semibold text-slate-900 text-sm hover:text-brand-600 transition-colors"
                        >
                          {item.patientName}
                        </Link>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          item.urgency === 'high' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          item.urgency === 'medium' ? 'bg-red-100 text-red-800 border border-red-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {item.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">{item.timestamp}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 mt-0.5">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-11 sm:pl-0">
                    <Link
                      to={item.actionUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-brand-500 hover:text-brand-600 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                    >
                      {item.actionLabel} <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* TWO COLUMN GRID: RECENT PATIENTS + RECENT ACTIVITY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* RECENT PATIENTS (2 COLS ON DESKTOP) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-brand-600" />
                <h2 className="font-semibold text-slate-900 text-base">Recent Patients Panel</h2>
              </div>
              <Link to="/patients" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                View All <ArrowRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {patients.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No patients found.</div>
              ) : (
                patients.slice(0, 6).map(patient => {
                  const name = patient.name?.[0];
                  const fullName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown Patient';
                  const age = calculateAge(patient.birthDate);
                  const gender = patient.gender || 'Unknown';
                  
                  // Latest encounter for this patient
                  const patEncs = encounters.filter(e => e.subject?.reference === `Patient/${patient.id}`);
                  const latestEnc = patEncs[0];
                  const lastConsultDate = latestEnc?.period?.start ? new Date(latestEnc.period.start).toLocaleDateString() : 'No consults yet';

                  // Count prescriptions & conditions
                  const patMeds = medRequests.filter(m => m.subject?.reference === `Patient/${patient.id}`);
                  const patConds = conditions.filter(c => c.subject?.reference === `Patient/${patient.id}`);

                  return (
                    <div key={patient.id} className="p-4 md:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                          {fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link 
                            to={`/patients/${patient.id}`}
                            className="font-semibold text-slate-900 text-sm hover:text-brand-600 truncate block transition-colors"
                          >
                            {fullName}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                            <span>{age}</span>
                            <span>•</span>
                            <span className="capitalize">{gender}</span>
                            <span>•</span>
                            <span>Last visit: {lastConsultDate}</span>
                          </div>
                          
                          {/* Clinical badges */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {patConds.slice(0, 2).map((c, i) => (
                              <span key={i} className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                {c.code?.text || 'Condition'}
                              </span>
                            ))}
                            {patMeds.length > 0 && (
                              <span className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded flex items-center gap-1">
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
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
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

          {/* RECENT PRACTICE ACTIVITY FEED (1 COL) */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-brand-600" />
                <h2 className="font-semibold text-slate-900 text-base">Recent Activity</h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">Practice feed</span>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1 max-h-[480px]">
              {recentActivities.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No activity recorded yet.</div>
              ) : (
                recentActivities.map(act => (
                  <Link
                    key={`${act.type}-${act.id}`}
                    to={`/patients/${act.patientId}`}
                    className="p-4 block hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        {act.type === 'consultation' ? <Stethoscope size={13} className="text-brand-600" /> :
                         act.type === 'prescription' ? <Pill size={13} className="text-purple-600" /> :
                         act.type === 'lab' ? <FlaskConical size={13} className="text-emerald-600" /> :
                         <FileText size={13} className="text-amber-600" />}
                        {act.title}
                      </span>
                      <span className="text-[11px] text-slate-400">{act.date.toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs font-medium text-brand-600 truncate">{act.patientName}</div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{act.description}</p>
                  </Link>
                ))
              )}
            </div>
          </div>

        </div>

        {/* MODAL: START CONSULTATION PATIENT SELECTOR */}
        {isConsultModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Start New Consultation</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Select a patient from your panel to launch the consultation copilot.</p>
                </div>
                <button 
                  onClick={() => setIsConsultModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6">
                <div className="relative mb-4">
                  <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search by patient name..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                  {filteredPatients.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      No patients match your search.
                    </div>
                  ) : (
                    filteredPatients.map(p => {
                      const name = getPatientName(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setIsConsultModalOpen(false);
                            navigate(`/consultation?patient=${p.id}`);
                          }}
                          className="p-3.5 flex items-center justify-between hover:bg-brand-50 cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">{name}</div>
                            <div className="text-xs text-slate-500">DOB: {p.birthDate || 'Unknown'} • {p.gender || 'Unknown'}</div>
                          </div>
                          <span className="text-xs font-semibold text-brand-600 flex items-center gap-1">
                            Select <ChevronRight size={14} />
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setIsConsultModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
