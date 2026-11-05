import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMedplum } from '@medplum/react';
import type { 
  Patient, 
  Condition, 
  MedicationStatement, 
  AllergyIntolerance, 
  Encounter, 
  Observation, 
  DocumentReference, 
  ClinicalImpression, 
  MedicationRequest 
} from '@medplum/fhirtypes';
import { 
  ArrowLeft, Mic, FileText, LayoutList, Square, Check, Loader2, 
  AlertCircle, ShieldCheck, Pill, Plus, Trash2, Edit2,
  Printer, CheckCircle2, X, AlertTriangle, FlaskConical, AlertOctagon, Activity
} from 'lucide-react';
import Layout from '../components/Layout';
import { RealSpeechService } from '../services/speech';
import { RealAIService, formatNoteToText } from '../services/ai';
import type { PrescriptionItem } from '../types/prescription';
import PrescriptionPDFModal from '../components/PrescriptionPDFModal';
import { verifyClinicalNote, verifyPrescriptions, type VerificationReport } from '../services/verification';
import { auditService } from '../services/audit';
import ClinicalVerificationPanel from '../components/ClinicalVerificationPanel';
import PreConsultationBrief from '../components/PreConsultationBrief';
import MemoryProposalPanel from '../components/MemoryProposalPanel';
import EvidenceModal from '../components/EvidenceModal';
import DuringConsultIntelligence from '../components/DuringConsultIntelligence';
import { 
  synthesizePatientIntelligence, 
  detectMedicationDiscrepancies, 
  generateMemoryProposals,
  matchClinicalContext,
  detectConsultationChanges
} from '../services/clinicalBrain';
import type { 
  MemoryProposal, 
  MedicationDiscrepancy, 
  ClinicalEvidence, 
  RelevantContext, 
  ConsultationChangesSummary 
} from '../types/clinicalBrain';

type ConsultState = 'idle' | 'recording' | 'transcribing' | 'generating' | 'review' | 'saving' | 'complete' | 'error';

const ROUTE_OPTIONS = ['Oral', 'Sublingual', 'Topical', 'Inhalation', 'Subcutaneous', 'Intramuscular', 'Intravenous', 'Ophthalmic', 'Otic'];
const FREQUENCY_OPTIONS = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 4-6 hours PRN', 'Every 8 hours', 'Once weekly', 'At bedtime'];

const DEFAULT_MED_FORM: Omit<PrescriptionItem, 'id'> = {
  name: '',
  strength: '',
  dose: '1 tablet',
  route: 'Oral',
  frequency: 'Once daily',
  duration: '30 days',
  instructions: 'Take after meals with water'
};


export interface LegacyEncounterWorkspaceProps {
  patientId: string | null;
  onSwitchToDesk: () => void;
}

export default function LegacyEncounterWorkspace({
  patientId: initialPatientId,
  onSwitchToDesk
}: LegacyEncounterWorkspaceProps) {
  const medplum = useMedplum();
  const [searchParams] = useSearchParams();
  const patientId = initialPatientId || searchParams.get('patient');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [panelPatients, setPanelPatients] = useState<Patient[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [meds, setMeds] = useState<MedicationStatement[]>([]);
  const [allergies, setAllergies] = useState<AllergyIntolerance[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [impressions, setImpressions] = useState<ClinicalImpression[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [documents, setDocuments] = useState<DocumentReference[]>([]);
  const [medRequests, setMedRequests] = useState<MedicationRequest[]>([]);
  const [memoryProposals, setMemoryProposals] = useState<MemoryProposal[]>([]);
  const [discrepancies, setDiscrepancies] = useState<MedicationDiscrepancy[]>([]);

  const [template, setTemplate] = useState('General Consultation');
  const [status, setStatus] = useState<ConsultState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [transcript, setTranscript] = useState('');
  const [note, setNote] = useState('');

  // Provenance & Safety Verification States
  const [noteProvenance, setNoteProvenance] = useState<'ai_draft' | 'doctor_edited' | 'doctor_approved'>('ai_draft');
  const [acknowledgedWarningIds, setAcknowledgedWarningIds] = useState<Set<string>>(new Set());
  const [medProvenanceMap, setMedProvenanceMap] = useState<Record<string, 'ai_suggested' | 'doctor_added' | 'doctor_edited'>>({});

  // Prescription Workflow States
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<PrescriptionItem[]>([]);
  const [reviewedConfirmed, setReviewedConfirmed] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [medForm, setMedForm] = useState<Omit<PrescriptionItem, 'id'>>(DEFAULT_MED_FORM);
  const [formError, setFormError] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [approvalInfo, setApprovalInfo] = useState<{ doctor: string; timestamp: string; count: number } | null>(null);
  
  // Draft Autosave & Feedback Loop States
  const [draftRestored, setDraftRestored] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackCorrections, setFeedbackCorrections] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState('');
    
  // Doctor Intelligence Layer (Phases 3, 4, 7, 9)
  const [selectedEvidence, setSelectedEvidence] = useState<ClinicalEvidence | null>(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [matchedContexts, setMatchedContexts] = useState<RelevantContext[]>([]);
  const [dismissedContextIds, setDismissedContextIds] = useState<string[]>([]);
  const [consultChanges, setConsultChanges] = useState<ConsultationChangesSummary | null>(null);
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);

  const handleOpenEvidence = (ev?: ClinicalEvidence) => {
    if (!ev) return;
    setSelectedEvidence(ev);
    setIsEvidenceModalOpen(true);
  };

  const handleDismissContext = (id: string) => {
    setDismissedContextIds(prev => [...prev, id]);
    setMatchedContexts(prev => prev.filter(c => c.id !== id));
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (patientId) {
      medplum.readResource('Patient', patientId).then(setPatient).catch(console.error);
      medplum.searchResources('Condition', { subject: `Patient/${patientId}` }).then(setConditions).catch(console.error);
      medplum.searchResources('MedicationStatement', { subject: `Patient/${patientId}` }).then(setMeds).catch(console.error);
      medplum.searchResources('MedicationRequest', { subject: `Patient/${patientId}` }).then(setMedRequests).catch(console.error);
      medplum.searchResources('AllergyIntolerance', { patient: `Patient/${patientId}` }).then(setAllergies).catch(console.error);
      medplum.searchResources('Observation', { subject: `Patient/${patientId}` }).then(setObservations).catch(console.error);
      medplum.searchResources('DocumentReference', { subject: `Patient/${patientId}` }).then(setDocuments).catch(console.error);
      medplum.searchResources('Encounter', { subject: `Patient/${patientId}` }).then(setEncounters).catch(console.error);
      medplum.searchResources('ClinicalImpression', { subject: `Patient/${patientId}` }).then(setImpressions).catch(console.error);
    } else {
      medplum.searchResources('Patient', { _count: 10, _sort: '-_lastUpdated' })
        .then(setPanelPatients)
        .catch(() => {});
    }
  }, [medplum, patientId]);

  // Restore active draft from session storage if available
  useEffect(() => {
    if (!patientId) return;
    try {
      const saved = sessionStorage.getItem(`proton_draft_consultation_${patientId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.status !== 'complete' && (parsed.transcript || parsed.note || (parsed.prescriptions && parsed.prescriptions.length > 0))) {
          if (parsed.transcript) setTranscript(parsed.transcript);
          if (parsed.note) setNote(parsed.note);
          if (parsed.status && parsed.status !== 'complete') setStatus(parsed.status);
          if (parsed.noteProvenance) setNoteProvenance(parsed.noteProvenance);
          if (parsed.prescriptions) setPrescriptions(parsed.prescriptions);
          if (parsed.aiSuggestions) setAiSuggestions(parsed.aiSuggestions);
          if (parsed.medProvenanceMap) setMedProvenanceMap(parsed.medProvenanceMap);
          if (parsed.template) setTemplate(parsed.template);
          setDraftRestored(true);
          auditService.record('draft_autosaved', 'Restored draft consultation from browser session', {
            patientId
          });
        }
      }
    } catch {
      // Ignore parse failure
    }
  }, [patientId]);

  // Continuously autosave active consultation to protect against data loss
  useEffect(() => {
    if (!patientId || status === 'idle' || status === 'complete') return;
    try {
      const draft = {
        transcript,
        note,
        status,
        noteProvenance,
        prescriptions,
        aiSuggestions,
        medProvenanceMap,
        template,
        timestamp: new Date().toISOString()
      };
      sessionStorage.setItem(`proton_draft_consultation_${patientId}`, JSON.stringify(draft));
    } catch {
      // Ignore quota error
    }
  }, [patientId, status, transcript, note, noteProvenance, prescriptions, aiSuggestions, medProvenanceMap, template]);

  const intelligence = useMemo(() => {
    return synthesizePatientIntelligence(
      patient,
      encounters,
      impressions,
      conditions,
      meds,
      medRequests,
      allergies,
      observations,
      documents
    );
  }, [patient, encounters, impressions, conditions, meds, medRequests, allergies, observations, documents]);

  // Passive background matching of clinical context against longitudinal history (Phases 3, 4, 6)
  useEffect(() => {
    if (!intelligence) return;
    const activeText = (transcript + ' ' + note).trim();
    if (activeText.length < 8) {
      setMatchedContexts([]);
      return;
    }
    const timer = setTimeout(() => {
      const matches = matchClinicalContext(
        activeText,
        intelligence,
        conditions,
        medRequests,
        allergies,
        observations,
        impressions
      );
      setMatchedContexts(matches.filter(m => !dismissedContextIds.includes(m.id)));
    }, 250);
    return () => clearTimeout(timer);
  }, [transcript, note, intelligence, conditions, medRequests, allergies, observations, impressions, dismissedContextIds]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await handleAudioCaptured(audioBlob);
      };
      
      mediaRecorder.start();
      setStatus('recording');
      setErrorMessage('');
    } catch (err) {
      console.error('Failed to start recording:', err);
      setStatus('error');
      setErrorMessage('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const generateNoteFromDialogue = async (transcribedText: string) => {
    try {
      setStatus('generating');
      setTranscript(transcribedText);
      const aiService = new RealAIService();
      const patientContext = (patient ? `Patient: ${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}, DOB: ${patient.birthDate}, Gender: ${patient.gender}\n` : 'Unknown Patient\n') +
        `Active Conditions: ${conditions.map(c => c.code?.coding?.[0]?.display || 'Unknown').join(', ') || 'None'}\n` +
        `Medications: ${meds.map(m => m.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown').join(', ') || 'None'}\n` +
        `Allergies: ${allergies.map(a => a.code?.coding?.[0]?.display || 'Unknown').join(', ') || 'None'}`;
      
      const jsonNote = await aiService.generateNote(transcribedText, patientContext, template);
      setNote(formatNoteToText(jsonNote, template));

      // Extract / produce deterministic AI suggestions based on clinical context and note
      const suggestions: PrescriptionItem[] = [];
      const noteContent = (transcribedText + ' ' + JSON.stringify(jsonNote)).toLowerCase();

      if (noteContent.includes('ibuprofen') || noteContent.includes('headache') || noteContent.includes('pain')) {
        suggestions.push({
          id: `sug-${Date.now()}-1`,
          name: 'Ibuprofen',
          strength: '400 mg',
          dose: '1 tablet',
          route: 'Oral',
          frequency: 'Three times daily with meals',
          duration: '5 days',
          instructions: 'Take after meals with water. Discontinue if gastric discomfort occurs.'
        });
      }

      if (noteContent.includes('acetaminophen') || noteContent.includes('headache') || noteContent.includes('migraine')) {
        suggestions.push({
          id: `sug-${Date.now()}-2`,
          name: 'Acetaminophen',
          strength: '500 mg',
          dose: '1 tablet',
          route: 'Oral',
          frequency: 'Every 6 hours as needed',
          duration: '7 days',
          instructions: 'For tension headache. Do not exceed 3,000 mg in 24 hours.'
        });
      }

      if (noteContent.includes('metformin') || noteContent.includes('diabetes')) {
        suggestions.push({
          id: `sug-${Date.now()}-3`,
          name: 'Metformin',
          strength: '500 mg',
          dose: '1 tablet',
          route: 'Oral',
          frequency: 'Twice daily',
          duration: '30 days',
          instructions: 'Take with breakfast and dinner.'
        });
      }

      // Fallback deterministic clinical suggestion
      if (suggestions.length === 0) {
        suggestions.push({
          id: `sug-${Date.now()}-default`,
          name: 'Acetaminophen',
          strength: '500 mg',
          dose: '1 tablet',
          route: 'Oral',
          frequency: 'Every 6-8 hours as needed',
          duration: '5 days',
          instructions: 'Take with full glass of water.'
        });
      }

      setAiSuggestions(suggestions);
      
      // Clinical Brain: Detect medication discrepancies against active orders
      const formattedNote = formatNoteToText(jsonNote, template);
      const discs = detectMedicationDiscrepancies(transcribedText, formattedNote, medRequests, intelligence.evidenceStore);
      setDiscrepancies(discs);

      // Clinical Brain: Synthesize post-consultation memory proposals
      const proposals = generateMemoryProposals(
        transcribedText,
        formattedNote,
        suggestions,
        conditions,
        meds
      );
      setMemoryProposals(proposals);

      // Clinical Brain: Detect post-consultation changes (Phase 7)
      if (intelligence) {
        const cChanges = detectConsultationChanges(intelligence, formattedNote, suggestions);
        setConsultChanges(cChanges);
      }

      setNoteProvenance('ai_draft');
      auditService.record('ai_draft_generated', 'Synthesized AI clinical note and prescription draft', {
        patientId: patientId || undefined,
        details: { template }
      });
      auditService.record('memory_proposal_generated', `Generated ${proposals.length} memory update proposals for physician review`, {
        patientId: patientId || undefined,
        details: { count: proposals.length }
      });
      setStatus('review');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'An error occurred during processing.');
    }
  };

  const handleAudioCaptured = async (blob: Blob) => {
    try {
      setStatus('transcribing');
      const speechService = new RealSpeechService();
      const transcribedText = await speechService.transcribe(blob);
      if (!transcribedText || !transcribedText.trim()) {
        setStatus('error');
        setErrorMessage('No speech could be recognized from the captured audio. Please try speaking clearly or enter dialogue manually.');
        return;
      }
      await generateNoteFromDialogue(transcribedText);
    } catch (sttErr: any) {
      console.error('Audio transcription error:', sttErr);
      setStatus('error');
      setErrorMessage(sttErr.message || 'Audio transcription failed. No valid clinical audio received.');
    }
  };

  const handleDiscardDraft = () => {
    if (!patientId) return;
    sessionStorage.removeItem(`proton_draft_consultation_${patientId}`);
    setTranscript('');
    setNote('');
    setStatus('idle');
    setPrescriptions([]);
    setAiSuggestions([]);
    setMedProvenanceMap({});
    setDraftRestored(false);
  };

  const handleRetryAI = async () => {
    if (!transcript) {
      setStatus('idle');
      setErrorMessage('');
      return;
    }
    try {
      setStatus('generating');
      setErrorMessage('');
      const aiService = new RealAIService();
      const patientContext = (patient ? `Patient: ${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}, DOB: ${patient.birthDate}, Gender: ${patient.gender}\n` : 'Unknown Patient\n') +
        `Active Conditions: ${conditions.map(c => c.code?.coding?.[0]?.display || 'Unknown').join(', ') || 'None'}\n` +
        `Medications: ${meds.map(m => m.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown').join(', ') || 'None'}\n` +
        `Allergies: ${allergies.map(a => a.code?.coding?.[0]?.display || 'Unknown').join(', ') || 'None'}`;
      
      const jsonNote = await aiService.generateNote(transcript, patientContext, template);
      setNote(formatNoteToText(jsonNote, template));
      setStatus('review');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage('AI note generation failed. You can edit the note directly or retry.');
    }
  };

  const handleSubmitFeedback = () => {
    if (feedbackRating === 0) return;
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    auditService.record('physician_feedback_submitted', `Physician rated consultation: ${feedbackRating}/5 stars`, {
      patientId: patientId || undefined,
      actor: 'Dr. Alex Morgan, MD',
      details: {
        rating: feedbackRating,
        corrections: feedbackCorrections,
        comment: feedbackComment || undefined,
        noteEdited: noteProvenance === 'doctor_edited',
        prescriptionsCount: prescriptions.length,
        durationSeconds: duration
      }
    });
    setFeedbackSubmitted(true);
  };

  // Memory proposal action handlers
  const handleApproveProposal = (id: string) => {
    setMemoryProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'APPROVED' } : p));
    auditService.record('memory_proposal_approved', `Physician approved memory proposal ${id}`, { patientId: patientId || undefined });
  };

  const handleRejectProposal = (id: string) => {
    setMemoryProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'REJECTED' } : p));
    auditService.record('memory_proposal_rejected', `Physician rejected memory proposal ${id}`, { patientId: patientId || undefined });
  };

  const handleEditProposal = (id: string, newContent: string) => {
    setMemoryProposals(prev => prev.map(p => p.id === id ? { ...p, status: 'EDITED', editedContent: newContent } : p));
    auditService.record('memory_proposal_edited', `Physician edited memory proposal ${id}`, { patientId: patientId || undefined });
  };

  const handleApproveAllProposals = () => {
    setMemoryProposals(prev => prev.map(p => ({ ...p, status: 'APPROVED' })));
    auditService.record('memory_proposal_approved', `Physician approved all memory proposals (${memoryProposals.length})`, { patientId: patientId || undefined });
  };

  const handleSimulateDiscrepancy = () => {
    const simDisc: MedicationDiscrepancy = {
      id: `sim-disc-${Date.now()}`,
      medicationName: 'Metformin',
      approvedOrder: 'Metformin 500 mg: 1 tablet Oral Once daily with breakfast',
      patientReported: 'Metformin: Patient reports taking 10 mg / twice daily',
      sourceEncounterDate: new Date().toLocaleDateString(),
      evidence: {
        id: 'MedicationRequest/sim-met',
        sourceType: 'medication',
        sourceId: 'sim-met',
        resourceType: 'MedicationRequest',
        date: new Date().toLocaleDateString(),
        title: 'Approved Order: Metformin',
        excerpt: '1 tablet Oral Once daily with breakfast for 30 days',
        provenance: 'PHYSICIAN ENTERED'
      }
    };
    setDiscrepancies([simDisc]);
    auditService.record('warning_generated', 'Simulated medication discrepancy: Metformin', { patientId: patientId || undefined });
  };

  const handleSimulateMemoryProposal = () => {
    const simProp: MemoryProposal = {
      id: `sim-prop-${Date.now()}`,
      category: 'NEW',
      targetResourceType: 'Condition',
      title: 'New Clinical Concern: Tension-type Headache',
      proposedChange: 'Tension-type headache (frequent episodic)',
      reasoning: 'Assessment documented recurring moderate frontal headache with nausea.',
      evidence: [{
        id: 'draft-note-sim',
        sourceType: 'encounter',
        sourceId: 'cur-enc',
        resourceType: 'Encounter',
        date: new Date().toLocaleDateString(),
        title: 'Consultation Assessment',
        excerpt: '1. Headache, likely tension-type or mild migraine.',
        provenance: 'AI SYNTHESIS'
      }],
      status: 'PROPOSED'
    };
    setMemoryProposals(prev => [...prev, simProp]);
    auditService.record('warning_generated', 'Simulated memory proposal: Tension-type Headache', { patientId: patientId || undefined });
  };

  // Verification Reports
  const noteReport = useMemo<VerificationReport>(() => {
    return verifyClinicalNote(note, template, patient, acknowledgedWarningIds);
  }, [note, template, patient, acknowledgedWarningIds]);

  const rxReport = useMemo<VerificationReport>(() => {
    return verifyPrescriptions(prescriptions, patient, allergies, meds, acknowledgedWarningIds);
  }, [prescriptions, patient, allergies, meds, acknowledgedWarningIds]);

  const canApprove = 
    status !== 'saving' &&
    status !== 'complete' &&
    noteReport.canApprove &&
    rxReport.canApprove;

  // Global Physician Keyboard Shortcuts (⌘↵ Sign-off, ⌘S Save Draft, Esc Close Modals, ⌘⇧C Copy Note)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // 1. Esc to close active modals
      if (e.key === 'Escape') {
        if (showPdfModal) setShowPdfModal(false);
        if (isComposerOpen) setIsComposerOpen(false);
        if (isEvidenceModalOpen) setIsEvidenceModalOpen(false);
        return;
      }

      // 2. Cmd/Ctrl + S: Save Draft
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        try {
          const draft = {
            transcript,
            note,
            status,
            noteProvenance,
            prescriptions,
            aiSuggestions,
            medProvenanceMap,
            template,
            timestamp: new Date().toISOString()
          };
          sessionStorage.setItem(`proton_draft_consultation_${patientId}`, JSON.stringify(draft));
          setShortcutFeedback('Draft safely saved (⌘S)');
          setTimeout(() => setShortcutFeedback(null), 2500);
        } catch {
          // ignore
        }
        return;
      }

      // 3. Cmd/Ctrl + Enter: Quick Sign-off & FHIR Commit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (status === 'review' && canApprove) {
          e.preventDefault();
          setShortcutFeedback('Signing off and persisting (⌘↵)...');
          setTimeout(() => setShortcutFeedback(null), 2500);
          handleApproveAndSave();
        }
        return;
      }

      // 4. Cmd/Ctrl + Shift + C: Quick Copy Formatted Note
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        if (note) {
          e.preventDefault();
          navigator.clipboard.writeText(note);
          setShortcutFeedback('SOAP note copied to clipboard');
          setTimeout(() => setShortcutFeedback(null), 2000);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPdfModal, isComposerOpen, isEvidenceModalOpen, status, canApprove, transcript, note, noteProvenance, prescriptions, aiSuggestions, medProvenanceMap, template, patientId]);

  const handleToggleAcknowledge = (warningId: string) => {
    setAcknowledgedWarningIds(prev => {
      const next = new Set(prev);
      if (next.has(warningId)) {
        next.delete(warningId);
      } else {
        next.add(warningId);
        auditService.record('warning_acknowledged', `Physician acknowledged warning: ${warningId}`, {
          patientId: patientId || undefined,
          actor: 'Dr. Alex Morgan, MD',
          details: { warningId }
        });
      }
      return next;
    });
  };

  const handleAcknowledgeAll = (report: VerificationReport) => {
    setAcknowledgedWarningIds(prev => {
      const next = new Set(prev);
      report.checks.filter(c => c.severity === 'warning').forEach(c => next.add(c.id));
      auditService.record('warning_acknowledged', `Physician acknowledged all warnings (${report.warningCount})`, {
        patientId: patientId || undefined,
        actor: 'Dr. Alex Morgan, MD'
      });
      return next;
    });
  };

  // Test simulation scenarios
  const handleSimulateIncompleteNote = () => {
    setNote(prev => prev.replace(/PLAN:[\s\S]*/i, '').trim());
    setNoteProvenance('doctor_edited');
    auditService.record('warning_generated', 'Simulated incomplete note for safety verification', { patientId: patientId || undefined });
  };

  const handleSimulateAllergyConflict = () => {
    if (!allergies.some(a => (a.code?.text || '').toLowerCase().includes('penicillin'))) {
      const simAllergy: AllergyIntolerance = {
        resourceType: 'AllergyIntolerance',
        patient: { reference: `Patient/${patientId}` },
        code: { text: 'Penicillin (Anaphylaxis risk)' },
        clinicalStatus: { coding: [{ code: 'active' }] }
      };
      setAllergies(prev => [...prev, simAllergy]);
    }
    const amoxItem: PrescriptionItem = {
      id: `rx-allergy-${Date.now()}`,
      name: 'Amoxicillin',
      strength: '500 mg',
      dose: '1 capsule',
      route: 'Oral',
      frequency: 'Three times daily',
      duration: '7 days',
      instructions: 'Take with food.'
    };
    setPrescriptions(prev => [...prev, amoxItem]);
    setMedProvenanceMap(prev => ({ ...prev, [amoxItem.id]: 'doctor_added' }));
    auditService.record('warning_generated', 'Potential allergy conflict simulated: Amoxicillin vs Penicillin', { patientId: patientId || undefined });
  };

  const handleSimulateDuplicateMed = () => {
    const dupItem: PrescriptionItem = {
      id: `rx-dup-${Date.now()}`,
      name: 'Ibuprofen',
      strength: '400 mg',
      dose: '1 tablet',
      route: 'Oral',
      frequency: 'Three times daily',
      duration: '5 days',
      instructions: 'Duplicate test.'
    };
    setPrescriptions(prev => [...prev, dupItem]);
    setMedProvenanceMap(prev => ({ ...prev, [dupItem.id]: 'doctor_added' }));
    auditService.record('warning_generated', 'Duplicate medication order simulated: Ibuprofen', { patientId: patientId || undefined });
  };

  const handleSimulateMissingField = () => {
    const missingItem: PrescriptionItem = {
      id: `rx-missing-${Date.now()}`,
      name: 'Lisinopril',
      strength: '',
      dose: '', // triggers block
      route: 'Oral',
      frequency: 'Once daily',
      duration: '',
      instructions: 'Missing dose field simulation.'
    };
    setPrescriptions(prev => [...prev, missingItem]);
    setMedProvenanceMap(prev => ({ ...prev, [missingItem.id]: 'doctor_added' }));
    auditService.record('warning_generated', 'Missing prescription field simulated: Lisinopril', { patientId: patientId || undefined });
  };

  const handleNoteChange = (newVal: string) => {
    setNote(newVal);
    if (noteProvenance === 'ai_draft') {
      setNoteProvenance('doctor_edited');
      auditService.record('doctor_edited_note', 'Physician modified AI clinical note draft', {
        patientId: patientId || undefined
      });
    }
  };

  // Prescription Builder Handlers
  const handleOpenAddMedicine = () => {
    setEditingId(null);
    setMedForm(DEFAULT_MED_FORM);
    setFormError('');
    setIsComposerOpen(true);
  };

  const handleEditMedicine = (item: PrescriptionItem) => {
    setEditingId(item.id);
    setMedForm({
      name: item.name,
      strength: item.strength,
      dose: item.dose,
      route: item.route,
      frequency: item.frequency,
      duration: item.duration,
      instructions: item.instructions
    });
    setFormError('');
    setIsComposerOpen(true);
  };

  const handleSaveMedicine = () => {
    if (!medForm.name.trim()) {
      setFormError('Medicine name is required.');
      return;
    }
    if (!medForm.strength.trim()) {
      setFormError('Strength is required (e.g. 500 mg).');
      return;
    }
    if (!medForm.dose.trim()) {
      setFormError('Dose is required (e.g. 1 tablet).');
      return;
    }
    if (!medForm.duration.trim()) {
      setFormError('Duration is required (e.g. 30 days).');
      return;
    }

    if (editingId) {
      setPrescriptions(prev => prev.map(p => p.id === editingId ? { ...medForm, id: editingId } : p));
      setMedProvenanceMap(prev => ({ ...prev, [editingId]: 'doctor_edited' }));
      setAiSuggestions(prev => prev.filter(s => s.id !== editingId));
      auditService.record('prescription_edited', `Physician updated medication order: ${medForm.name}`, {
        patientId: patientId || undefined
      });
    } else {
      const newId = `rx-${Date.now()}`;
      const newItem: PrescriptionItem = { ...medForm, id: newId };
      setPrescriptions(prev => [...prev, newItem]);
      setMedProvenanceMap(prev => ({ ...prev, [newId]: 'doctor_added' }));
      auditService.record('prescription_added', `Physician manually added medication order: ${medForm.name}`, {
        patientId: patientId || undefined
      });
    }

    setIsComposerOpen(false);
    setEditingId(null);
    setMedForm(DEFAULT_MED_FORM);
    setFormError('');
  };

  const handleRemoveMedicine = (id: string) => {
    setPrescriptions(prev => prev.filter(p => p.id !== id));
  };

  // AI Suggestion Actions
  const handleAcceptSuggestion = (suggestion: PrescriptionItem) => {
    const newId = `rx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setPrescriptions(prev => [...prev, { ...suggestion, id: newId }]);
    setMedProvenanceMap(prev => ({ ...prev, [newId]: 'ai_suggested' }));
    setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    auditService.record('prescription_added', `Physician accepted AI prescription suggestion: ${suggestion.name}`, {
      patientId: patientId || undefined,
      details: { medication: suggestion.name }
    });
  };

  const handleEditSuggestion = (suggestion: PrescriptionItem) => {
    setEditingId(suggestion.id);
    setMedForm({
      name: suggestion.name,
      strength: suggestion.strength,
      dose: suggestion.dose,
      route: suggestion.route,
      frequency: suggestion.frequency,
      duration: suggestion.duration,
      instructions: suggestion.instructions
    });
    setFormError('');
    setIsComposerOpen(true);
  };

  const handleRejectSuggestion = (id: string) => {
    setAiSuggestions(prev => prev.filter(s => s.id !== id));
  };

  // FHIR Atomic Save
  const handleApproveAndSave = async () => {
    if (!patientId || status === 'saving' || status === 'complete') return;
    
    // Strict safety check: all verification gates must pass
    if (!canApprove) {
      if (rxReport.blockedCount > 0 || noteReport.blockedCount > 0) {
        setErrorMessage('Cannot save: Resolve blocked verification errors before proceeding.');
        return;
      }
      if (rxReport.unacknowledgedWarningCount > 0 || noteReport.unacknowledgedWarningCount > 0) {
        setErrorMessage('Please acknowledge all clinical warnings before approving.');
        return;
      }
      if (prescriptions.length > 0 && !reviewedConfirmed) {
        setErrorMessage('Please confirm physician review of medications before saving.');
        return;
      }
    }

    setStatus('saving');
    try {
      // 1. Create Encounter first to establish concrete FHIR resource ID
      const createdEncounter = await medplum.createResource<Encounter>({
        resourceType: 'Encounter',
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
        type: [{ text: 'Ambulatory Consultation' }],
        subject: { reference: `Patient/${patientId}` },
        period: { start: new Date().toISOString() }
      });

      const encounterRef = `Encounter/${createdEncounter.id}`;

      // 2. Create batch transaction for ClinicalImpression and all approved MedicationRequests
      const bundle: import('@medplum/fhirtypes').Bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            request: { method: 'POST', url: 'ClinicalImpression' },
            resource: {
              resourceType: 'ClinicalImpression',
              status: 'completed',
              subject: { reference: `Patient/${patientId}` },
              encounter: { reference: encounterRef },
              date: new Date().toISOString(),
              summary: note,
              investigation: [{
                code: { text: 'Consultation Transcript' },
                item: [{ display: transcript }]
              }]
            }
          }
        ]
      };

      // Add each approved prescription as an atomic MedicationRequest
      prescriptions.forEach((med, idx) => {
        bundle.entry!.push({
          fullUrl: `urn:uuid:med-${idx}`,
          request: { method: 'POST', url: 'MedicationRequest' },
          resource: {
            resourceType: 'MedicationRequest',
            status: 'active',
            intent: 'order',
            subject: { reference: `Patient/${patientId}` },
            encounter: { reference: encounterRef },
            authoredOn: new Date().toISOString(),
            medicationCodeableConcept: {
              text: `${med.name} ${med.strength}`,
              coding: [
                {
                  system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                  display: `${med.name} ${med.strength}`
                }
              ]
            },
            dosageInstruction: [
              {
                text: `${med.dose} ${med.route} ${med.frequency} for ${med.duration}. ${med.instructions}`,
                route: {
                  text: med.route,
                  coding: [{ system: 'http://snomed.info/sct', display: med.route }]
                },
                timing: {
                  code: { text: med.frequency }
                },
                doseAndRate: [
                  {
                    doseQuantity: {
                      value: 1,
                      unit: med.dose
                    }
                  }
                ],
                patientInstruction: med.instructions
              }
            ],
            dispenseRequest: {
              expectedSupplyDuration: {
                value: parseInt(med.duration) || 30,
                unit: 'days',
                system: 'http://unitsofmeasure.org',
                code: 'd'
              }
            },
            note: [
              {
                text: `Approved by treating physician. Instructions: ${med.instructions}`
              }
            ]
          }
        });
      });

      // 3. Commit ONLY APPROVED memory proposals to permanent FHIR memory
      const approvedProposals = memoryProposals.filter(p => p.status === 'APPROVED');
      approvedProposals.forEach((p, idx) => {
        if (p.targetResourceType === 'Condition') {
          bundle.entry!.push({
            fullUrl: `urn:uuid:prop-cond-${idx}`,
            request: { method: 'POST', url: 'Condition' },
            resource: {
              resourceType: 'Condition',
              subject: { reference: `Patient/${patientId}` },
              code: { text: p.editedContent || p.proposedChange },
              clinicalStatus: { coding: [{ code: p.category === 'RESOLVED' ? 'resolved' : 'active' }] },
              recordedDate: new Date().toISOString(),
              note: [{ text: `Committed via approved memory proposal from consultation: ${p.reasoning}` }]
            } as Condition
          });
        }
      });

      const batchRes = await medplum.executeBatch(bundle);
      console.log('BATCH RESULT: Success. Entries persisted:', batchRes.entry?.length || 0);
      medplum.invalidateAll();
      
      const now = new Date();
      setApprovalInfo({
        doctor: 'Dr. Alex Morgan, MD',
        timestamp: now.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        count: prescriptions.length
      });
      setNoteProvenance('doctor_approved');

      auditService.record('note_approved', `Clinical consultation note approved by Dr. Alex Morgan, MD`, {
        patientId,
        encounterId: createdEncounter.id
      });
      if (prescriptions.length > 0) {
        auditService.record('prescription_approved', `${prescriptions.length} medication orders approved by Dr. Alex Morgan, MD`, {
          patientId,
          encounterId: createdEncounter.id
        });
      }

      if (intelligence) {
        const finalChanges = detectConsultationChanges(intelligence, note, prescriptions);
        setConsultChanges(finalChanges);
      }

      if (patientId) {
        sessionStorage.removeItem(`proton_draft_consultation_${patientId}`);
      }
      setDraftRestored(false);
      setStatus('complete');
    } catch (err: any) {
      console.error('Save failed:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to save to patient record.');
    }
  };

  return (
    <Layout>
      <div className="proton-consultation-workspace h-[calc(100vh-80px)] flex flex-col bg-paper-2 rounded-xl overflow-hidden border border-rule">
        
        {/* Switch back to desk banner */}
        <div className="bg-solid text-white px-4 py-2 flex items-center justify-between text-xs border-b border-rule-strong">
          <span>Viewing Legacy Verification Screen.</span>
          <button
            onClick={onSwitchToDesk}
            className="bg-accent hover:bg-accent text-white px-3 py-1 rounded-lg font-semibold text-xs cursor-pointer"
          >
            ← Back to Doctor's Desk
          </button>
        </div>
        
        {/* Header */}
        <header className="proton-consultation-header bg-paper border-b border-rule px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link to={patientId ? `/patients/${patientId}` : "/patients"} className="text-ink-3 hover:text-ink-2 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-brand-100 text-brand-600 rounded-lg flex items-center justify-center">
                <Mic size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-3 font-medium mb-0.5">
                  <Link to="/dashboard" className="hover:text-brand-600 transition-colors">Command Center</Link>
                  <span>&rarr;</span>
                  {patient ? (
                    <>
                      <Link to={`/patients/${patient.id}`} className="hover:text-brand-600 transition-colors">
                        {patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}
                      </Link>
                      <span>&rarr;</span>
                    </>
                  ) : (
                    <>
                      <Link to="/patients" className="hover:text-brand-600 transition-colors">Patients</Link>
                      <span>&rarr;</span>
                    </>
                  )}
                  <span className="text-ink-2 font-semibold">Consultation</span>
                </div>
                <h1 className="font-semibold text-ink text-lg tracking-tight">Active Consultation</h1>
                <p className="text-xs text-ink-3">Record, review note draft & compose prescriptions</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {shortcutFeedback && (
              <span className="px-3 py-1 bg-solid text-white rounded-lg text-xs font-medium shadow-md flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-settled-on-solid" />
                {shortcutFeedback}
              </span>
            )}
            {status === 'review' && (
              <button 
                onClick={handleApproveAndSave}
                disabled={!canApprove}
                className={`px-5 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 ${
                  !canApprove
                    ? 'bg-rule text-ink-3 cursor-not-allowed'
                    : 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer'
                }`}
              >
                <ShieldCheck size={18} /> Approve & Save to FHIR <span className="text-[11px] opacity-80 font-mono ml-0.5">⌘↵</span>
              </button>
            )}
            {status === 'saving' && (
              <button disabled className="bg-rule text-on-solid0 px-5 py-2 rounded-lg font-medium flex items-center gap-2 cursor-not-allowed">
                <Loader2 size={16} className="animate-spin"/> Saving atomically...
              </button>
            )}
            {status === 'complete' && (
              <div className="flex items-center gap-2">
                {prescriptions.length > 0 && (
                  <button
                    onClick={() => setShowPdfModal(true)}
                    className="bg-paper border border-rule text-ink-2 hover:bg-paper-2 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Printer size={16} className="text-brand-600" /> Print Prescription PDF
                  </button>
                )}
                <div className="bg-settled-wash text-settled px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 border border-settled-line">
                  <Check size={18} /> Consultation Approved & Saved
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Primary Action Guidance Banner */}
        <div className="proton-consultation-stage bg-paper-2/80 border-b border-rule px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-on-solid0 uppercase tracking-wider text-[10px]">
              Current Stage:
            </span>
            <div className="flex items-center gap-2 font-semibold">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${status === 'idle' ? 'bg-brand-700 text-white shadow-2xs' : 'bg-rule/80 text-ink-2'}`}>
                1. Capture
              </span>
              <span className="text-ink-3 font-bold">&rarr;</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${['recording', 'transcribing', 'generating'].includes(status) ? 'bg-brand-700 text-white animate-pulse' : 'bg-rule/80 text-ink-2'}`}>
                2. AI Synthesis
              </span>
              <span className="text-ink-3 font-bold">&rarr;</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${status === 'review' ? 'bg-caution text-white shadow-2xs' : 'bg-rule/80 text-ink-2'}`}>
                3. Physician Review & Safety
              </span>
              <span className="text-ink-3 font-bold">&rarr;</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${status === 'complete' ? 'bg-settled text-white shadow-2xs' : 'bg-rule/80 text-ink-2'}`}>
                4. Approved
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {draftRestored && status !== 'complete' && (
              <div className="flex items-center gap-2 bg-accent-wash text-accent-ink border border-accent-line px-2.5 py-0.5 rounded-md text-[11px]">
                <span>Draft restored from local session</span>
                <button
                  onClick={handleDiscardDraft}
                  className="text-accent-ink underline font-semibold hover:text-critical cursor-pointer"
                >
                  Discard Draft
                </button>
              </div>
            )}

            {status === 'idle' && (
              <span className="text-ink-2">
                Primary Action: <strong className="text-brand-700">Start Recording or Load Sample Dialogue</strong>
              </span>
            )}
            {status === 'recording' && (
              <span className="text-critical font-semibold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-critical-wash0" /> Live audio active &mdash; Click "Stop & Generate Note" when done
              </span>
            )}
            {status === 'review' && (
              <span className="text-ink-2">
                {!canApprove ? (
                  <span className="text-caution font-medium">Action: Review draft, acknowledge warnings & confirm review checkbox</span>
                ) : (
                  <span className="text-settled font-semibold">Ready: Click "Approve & Save to FHIR" above</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Workspace Grid */}
        <div className="proton-consultation-grid flex-1 flex overflow-hidden">
          
          {/* Left Context Panel */}
          <div className="w-80 bg-paper border-r border-rule overflow-y-auto shrink-0 flex flex-col">
            <div className="p-5 border-b border-rule">
              <h2 className="text-xs font-bold tracking-wider text-ink-3 uppercase mb-3">Patient Context</h2>
              {patient ? (
                <div>
                  <p className="font-semibold text-ink text-lg">{patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}</p>
                  <p className="text-sm text-on-solid0 mt-1 capitalize">{patient.birthDate} &bull; {patient.gender}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-on-solid0 italic mb-2">No patient assigned</p>
                  {panelPatients.length > 0 ? (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          window.location.href = `/consultation?patient=${e.target.value}`;
                        }
                      }}
                      defaultValue=""
                      className="w-full text-xs bg-paper-2 border border-rule rounded-lg p-2 font-medium text-ink"
                    >
                      <option value="" disabled>Select patient...</option>
                      {panelPatients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name?.[0]?.given?.join(' ')} {p.name?.[0]?.family}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Link to="/patients" className="text-xs text-brand-600 hover:underline">
                      Open Patient Directory &rarr;
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 border-b border-rule space-y-4">
              <div>
                <h2 className="text-xs font-bold tracking-wider text-ink-3 uppercase mb-1">Key Conditions</h2>
                <div className="text-sm text-ink-2">{conditions.length ? conditions.map(c => c.code?.coding?.[0]?.display).join(', ') : 'None recorded'}</div>
              </div>
              
              <div>
                <h2 className="text-xs font-bold tracking-wider text-ink-3 uppercase mb-1">Current Medications</h2>
                <div className="text-sm text-ink-2">{meds.length ? meds.map(m => m.medicationCodeableConcept?.coding?.[0]?.display).join(', ') : 'None recorded'}</div>
              </div>
              
              <div>
                <h2 className="text-xs font-bold tracking-wider text-ink-3 uppercase mb-1">Allergies</h2>
                <div className="text-sm text-ink-2">{allergies.length ? allergies.map(a => a.code?.coding?.[0]?.display).join(', ') : 'None recorded'}</div>
              </div>
            </div>

            <div className="p-5 border-b border-rule bg-paper-2">
              <h2 className="text-xs font-bold tracking-wider text-ink-3 uppercase mb-3">Note Template</h2>
              <select 
                className="w-full text-sm bg-paper border border-rule rounded-lg px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                disabled={status !== 'idle' && status !== 'error'}
              >
                <option value="General Consultation">General Consultation</option>
                <option value="SOAP">SOAP Note</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div className="p-5">
              <h2 className="text-xs font-bold tracking-wider text-ink-3 uppercase mb-3">Workflow Progress</h2>
              <div className="space-y-4 text-xs font-medium">
                <div className={`flex items-center gap-3 ${status !== 'idle' ? 'text-brand-600 font-semibold' : 'text-ink-3'}`}>
                  <div className={`h-2.5 w-2.5 rounded-full ${status !== 'idle' ? 'bg-brand-500 ring-2 ring-brand-100' : 'bg-rule'}`}></div>
                  1. Capture Audio
                </div>
                <div className={`flex items-center gap-3 ${['generating', 'review', 'saving', 'complete'].includes(status) ? 'text-brand-600 font-semibold' : 'text-ink-3'}`}>
                  <div className={`h-2.5 w-2.5 rounded-full ${['generating', 'review', 'saving', 'complete'].includes(status) ? 'bg-brand-500 ring-2 ring-brand-100' : 'bg-rule'}`}></div>
                  2. AI Note & Rx Synthesis
                </div>
                <div className={`flex items-center gap-3 ${['review', 'saving', 'complete'].includes(status) ? 'text-brand-600 font-semibold' : 'text-ink-3'}`}>
                  <div className={`h-2.5 w-2.5 rounded-full ${['review', 'saving', 'complete'].includes(status) ? 'bg-brand-500 ring-2 ring-brand-100' : 'bg-rule'}`}></div>
                  3. Doctor Review & Rx Builder
                </div>
                <div className={`flex items-center gap-3 ${status === 'complete' ? 'text-settled font-semibold' : 'text-ink-3'}`}>
                  <div className={`h-2.5 w-2.5 rounded-full ${status === 'complete' ? 'bg-settled-wash0 ring-2 ring-settled-line' : 'bg-rule'}`}></div>
                  4. Approved & FHIR Persisted
                </div>
              </div>
            </div>
          </div>

          {/* Main Scrollable Workspace */}
          <div className="flex-1 overflow-y-auto flex flex-col p-6 space-y-6">
            
            {/* Pre-Consultation Patient Brief */}
            <PreConsultationBrief
              intelligence={intelligence}
              patientName={patient ? `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}` : 'Patient'}
              onProceedToConsultation={startRecording}
              onSelectEvidence={handleOpenEvidence}
            />

            {/* During-Consultation Clinical Context Stream (Phases 3, 4, 6) */}
            <DuringConsultIntelligence
              contexts={matchedContexts}
              onDismissContext={handleDismissContext}
              onSelectEvidence={handleOpenEvidence}
              isRecording={status === 'recording'}
            />

            {/* Real-time Medication Discrepancy Alert */}
            {discrepancies.length > 0 && (
              <div className="bg-caution-wash border border-caution-line rounded-xl p-4 shadow-xs space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertOctagon size={18} className="text-caution shrink-0" />
                  <h3 className="text-xs font-bold text-caution uppercase tracking-wider">
                    Medication Discrepancy Detected ({discrepancies.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {discrepancies.map(d => (
                    <div key={d.id} className="bg-paper/80 p-3 rounded-lg border border-caution-line text-xs text-ink">
                      <div className="font-semibold text-caution flex items-center justify-between">
                        <span>{d.medicationName}</span>
                        <span className="text-[10px] text-caution bg-caution-wash px-2 py-0.5 rounded font-mono">Flag &bull; Doctor Decision</span>
                      </div>
                      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div><strong className="text-on-solid0">Approved Order:</strong> {d.approvedOrder}</div>
                        <div><strong className="text-caution">Patient-Reported:</strong> {d.patientReported}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message & Recovery Alert */}
            {status === 'error' && errorMessage && (
              <div className="p-4 bg-critical-wash border border-critical-line rounded-xl text-xs text-critical flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={18} className="text-critical shrink-0" />
                  <div>
                    <p className="font-bold text-critical">Processing Interrupted</p>
                    <p className="font-medium text-critical">{errorMessage}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {transcript && (
                    <button 
                      onClick={handleRetryAI}
                      className="px-3 py-1.5 bg-critical hover:bg-critical text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                    >
                      Retry AI Generation
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (!note) {
                        setNote(template === 'SOAP' ? "SUBJECTIVE:\n\nOBJECTIVE:\n\nASSESSMENT:\n\nPLAN:\n" : "CHIEF COMPLAINT:\n\nHISTORY OF PRESENT ILLNESS:\n\nASSESSMENT:\n\nPLAN:\n");
                      }
                      setStatus('review');
                      setErrorMessage('');
                    }}
                    className="px-3 py-1.5 bg-solid hover:bg-solid text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    Continue Note Manually
                  </button>
                  <button 
                    onClick={() => { setStatus('idle'); setErrorMessage(''); }}
                    className="px-3 py-1.5 bg-paper hover:bg-critical-wash text-critical border border-critical-line rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Reset to Ready
                  </button>
                </div>
              </div>
            )}

            {/* 1. Transcript Section */}
            <div className="bg-paper border border-rule rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-ink">
                  <LayoutList size={18} className="text-ink-3"/>
                  <h2 className="font-semibold text-base">Consultation Transcript</h2>
                  {(status === 'recording' || status === 'transcribing') && (
                    <span className="flex items-center gap-1.5 ml-2">
                      <span className="inline-flex h-2 w-2 rounded-full bg-critical-wash0"></span>
                      <span className="text-xs text-on-solid0 font-medium">Recording</span>
                    </span>
                  )}
                </div>
              </div>
              
              <div>
                {transcript && status !== 'idle' ? (
                  <div className="bg-paper-2 p-4 rounded-lg border border-rule text-ink-2 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                    {transcript}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-paper-2 border border-dashed border-rule rounded-xl">
                    <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-3 transition-colors ${status === 'recording' ? 'bg-critical-wash text-critical-on-solid0 ring-4 ring-critical-line' : 'bg-paper text-ink-3 border border-rule'}`}>
                      {status === 'recording' ? <Mic size={28} className="animate-pulse" /> : <Mic size={28} />}
                    </div>
                    {(status === 'idle' || status === 'error') && (
                      <>
                        <h3 className="text-sm font-semibold text-ink-2">Ready to capture consultation</h3>
                        <p className="text-xs text-on-solid0 mt-1 mb-4">Speak naturally with the patient. Proton captures clinical dialogue securely.</p>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                          <button 
                            onClick={startRecording}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                          >
                            <Mic size={16} /> Start Recording
                          </button>
                          <button 
                            onClick={() => {
                              const sampleDialogue = "Patient presents with a 3-day history of moderate frontal headache and mild nausea. They have taken ibuprofen with minimal relief. No recent travel. No fever.";
                              void generateNoteFromDialogue(sampleDialogue);
                            }}
                            className="bg-paper border border-rule hover:bg-paper-2 text-ink-2 px-5 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                            title="Simulate dialogue without microphone hardware"
                          >
                            <FileText size={16} className="text-brand-600" /> Use Sample Dialogue
                          </button>
                        </div>
                        <div className="mt-4 pt-3 border-t border-rule max-w-md mx-auto w-full">
                          <input
                            type="text"
                            placeholder="Or type consultation dialogue (e.g., patient mentions diabetes control)..."
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            className="w-full text-xs px-3 py-1.5 border border-rule rounded-lg text-ink-2 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-paper"
                          />
                        </div>
                      </>
                    )}
                    {status === 'recording' && (
                      <>
                        <h3 className="text-sm font-bold text-critical">Recording live consultation...</h3>
                        <p className="text-xs text-on-solid0 mt-1 mb-4">Audio stream active.</p>
                        <button 
                          onClick={stopRecording}
                          className="bg-solid hover:bg-solid text-white px-6 py-2.5 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                        >
                          <Square size={14} fill="currentColor" /> Stop & Generate Note
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Clinical Note Area */}
            <div className="bg-paper border border-rule rounded-xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-ink">
                  <FileText size={18} className="text-brand-600"/>
                  <h2 className="font-semibold text-base">Clinical Note Draft</h2>
                </div>
                {status === 'review' && (
                  <div className="flex items-center gap-2">
                    {noteProvenance === 'doctor_edited' ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-ink bg-accent-wash px-3 py-1 rounded-full border border-accent-line">
                        <Edit2 size={13} /> Edited by physician
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-caution bg-caution-wash px-3 py-1 rounded-full border border-caution-line">
                        <FileText size={13} /> Clinical draft: physician review required
                      </span>
                    )}
                  </div>
                )}
                {status === 'complete' && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-settled bg-settled-wash px-3 py-1 rounded-full border border-settled-line">
                    <ShieldCheck size={14} /> Physician approved
                  </span>
                )}
              </div>

              <div className={`border ${status === 'review' ? 'border-caution-line ring-2 ring-caution-line' : 'border-rule'} rounded-xl overflow-hidden min-h-[160px] flex flex-col`}>
                {status === 'idle' || status === 'recording' ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-ink-3">
                    <FileText size={36} className="mb-2 opacity-20" />
                    <p className="text-xs">Clinical note draft will be synthesized automatically when recording stops.</p>
                  </div>
                ) : status === 'transcribing' || status === 'generating' ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-brand-50/20 text-center">
                    <Loader2 size={32} className="text-brand-500 animate-spin mb-3" />
                    <h3 className="text-brand-700 font-semibold text-sm">
                      {status === 'transcribing' ? 'Transcribing Dialogue...' : 'Synthesizing Clinical Note...'}
                    </h3>
                    <p className="text-brand-600/70 text-xs mt-1">Formatting into clinical structure.</p>
                  </div>
                ) : (
                  <>
                    {status === 'error' && (
                      <div className="p-3 bg-critical-wash/90 border-b border-critical-line flex items-center justify-between text-xs text-critical">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={16} className="text-critical-on-solid0 shrink-0" />
                          <span>{errorMessage || 'Action could not be processed. Your note is safely preserved.'}</span>
                        </div>
                        <button 
                          onClick={() => { setStatus('review'); setErrorMessage(''); }}
                          className="px-2.5 py-1 bg-paper border border-critical-line rounded font-semibold text-[11px] hover:bg-critical-wash cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    <textarea
                      className={`w-full p-4 text-sm leading-relaxed resize-y min-h-[180px] focus:outline-none border-0 ${status === 'complete' ? 'bg-paper-2 text-ink-2 cursor-default' : 'text-ink focus:ring-1 focus:ring-brand-200 font-mono text-xs'}`}
                      value={note}
                      onChange={(e) => handleNoteChange(e.target.value)}
                      placeholder="Clinical note draft..."
                      readOnly={status === 'complete'}
                    />
                  </>
                )}
              </div>

              {/* Note Verification Panel */}
              {status === 'review' && (
                <div className="mt-4">
                  <ClinicalVerificationPanel
                    report={noteReport}
                    title="Draft safety checks"
                    subtitle="Template structure, required clinical sections & patient linkage"
                    onToggleAcknowledge={handleToggleAcknowledge}
                    onAcknowledgeAll={() => handleAcknowledgeAll(noteReport)}
                  />
                </div>
              )}
            </div>

            {/* 3. Prescription Section */}
            {['review', 'saving', 'complete'].includes(status) && (
              <div className="bg-paper border border-rule rounded-xl p-6 shadow-xs space-y-6">
                
                <div className="flex items-center justify-between border-b border-rule pb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                      <Pill size={16} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-base text-ink">Prescription Builder</h2>
                      <p className="text-xs text-on-solid0">Compose and verify structured medication orders</p>
                    </div>
                  </div>
                  {status === 'review' && (
                    <button
                      onClick={handleOpenAddMedicine}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus size={14} /> Add Medicine
                    </button>
                  )}
                </div>

                {/* AI Suggestions (if any) */}
                {aiSuggestions.length > 0 && status === 'review' && (
                  <div className="bg-caution-wash/70 border border-caution-line rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-caution-line text-caution px-2 py-0.5 rounded">
                          AI DRAFT &mdash; REVIEW REQUIRED
                        </span>
                        <h3 className="text-xs font-bold text-caution">
                          AI-generated prescription suggestions
                        </h3>
                      </div>
                      <span className="text-[11px] text-caution font-medium">
                        Treating physician must accept, edit, or reject
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {aiSuggestions.map(sug => (
                        <div key={sug.id} className="bg-paper border border-caution-line rounded-lg p-3.5 shadow-xs flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between">
                              <span className="font-bold text-ink text-sm">{sug.name}</span>
                              <span className="text-xs font-semibold bg-paper-2 text-ink-2 px-2 py-0.5 rounded">{sug.strength}</span>
                            </div>
                            <div className="text-xs text-ink-2 mt-1 space-y-0.5">
                              <p><span className="font-medium text-on-solid0">Dose:</span> {sug.dose} &bull; <span className="font-medium text-on-solid0">Route:</span> {sug.route}</p>
                              <p><span className="font-medium text-on-solid0">Freq:</span> {sug.frequency} &bull; <span className="font-medium text-on-solid0">Duration:</span> {sug.duration}</p>
                              {sug.instructions && (
                                <p className="text-on-solid0 italic mt-1">{sug.instructions}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-rule">
                            <button
                              onClick={() => handleAcceptSuggestion(sug)}
                              className="flex-1 bg-settled-wash text-settled hover:bg-settled-wash border border-settled-line py-1 rounded text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleEditSuggestion(sug)}
                              className="flex-1 bg-paper-2 text-ink-2 hover:bg-paper-2 border border-rule py-1 rounded text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRejectSuggestion(sug.id)}
                              className="px-2 py-1 text-ink-3 hover:text-critical hover:bg-critical-wash rounded text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prescription List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-ink-3 uppercase tracking-wider">
                      Prescription Orders ({prescriptions.length})
                    </h3>
                  </div>

                  {prescriptions.length === 0 ? (
                    <div className="p-8 text-center bg-paper-2 border border-dashed border-rule rounded-xl text-ink-3 text-xs">
                      <Pill size={28} className="mx-auto mb-2 opacity-30 text-ink-3" />
                      <p className="font-medium text-ink-2">No medications added yet.</p>
                      <p className="text-ink-3 mt-0.5">Accept AI suggestions above or click "+ Add Medicine" to prescribe.</p>
                    </div>
                  ) : (
                    <div className="border border-rule rounded-xl overflow-hidden divide-y divide-rule">
                      {prescriptions.map(med => (
                        <div key={med.id} className="p-4 bg-paper flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-paper-2/50 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-ink text-sm">{med.name}</span>
                              <span className="text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded">
                                {med.strength || 'No strength'}
                              </span>
                              <span className="text-xs text-on-solid0 font-medium">
                                ({med.route || 'No route'})
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                medProvenanceMap[med.id] === 'ai_suggested' 
                                  ? 'bg-caution-wash text-caution border-caution-line' 
                                  : medProvenanceMap[med.id] === 'doctor_edited' 
                                    ? 'bg-accent-wash text-accent-ink border-accent-line' 
                                    : 'bg-accent-wash text-accent-ink border-accent-line'
                              }`}>
                                {medProvenanceMap[med.id] === 'ai_suggested' ? 'AI suggestion' :
                                 medProvenanceMap[med.id] === 'doctor_edited' ? 'Edited by physician' : 'Added by physician'}
                              </span>
                            </div>
                            <div className="text-xs text-ink-2 flex flex-wrap gap-x-4 gap-y-1">
                              <span><strong className="text-on-solid0">Dose:</strong> {med.dose || <span className="text-critical-on-solid0 font-bold">Missing</span>}</span>
                              <span><strong className="text-on-solid0">Frequency:</strong> {med.frequency || <span className="text-critical-on-solid0 font-bold">Missing</span>}</span>
                              <span><strong className="text-on-solid0">Duration:</strong> {med.duration || <span className="text-caution">Unspecified</span>}</span>
                            </div>
                            {med.instructions && (
                              <p className="text-xs text-on-solid0 italic mt-0.5">Instructions: {med.instructions}</p>
                            )}
                          </div>
                          {status === 'review' && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleEditMedicine(med)}
                                className="p-1.5 text-ink-3 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit medication"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleRemoveMedicine(med.id)}
                                className="p-1.5 text-ink-3 hover:text-critical hover:bg-critical-wash rounded-lg transition-colors cursor-pointer"
                                title="Remove medication"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prescription Safety Check Verification Panel */}
                {status === 'review' && (
                  <div className="space-y-4">
                    <ClinicalVerificationPanel
                      report={rxReport}
                      title="Prescription Safety Check"
                      subtitle="Dosage, frequency, duration, duplicates & allergy conflicts"
                      onToggleAcknowledge={handleToggleAcknowledge}
                      onAcknowledgeAll={() => handleAcknowledgeAll(rxReport)}
                    />

                    {/* Safety Scenarios Toolbar for Simulation */}
                    <div className="bg-paper-2 border border-rule rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-ink-2 font-semibold">
                        <FlaskConical size={14} className="text-brand-600" />
                        <span>Safety Test Scenarios:</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleSimulateIncompleteNote}
                          className="px-2.5 py-1 bg-paper hover:bg-paper-2 text-ink-2 border border-rule rounded text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Test: Incomplete Note
                        </button>
                        <button
                          onClick={handleSimulateAllergyConflict}
                          className="px-2.5 py-1 bg-caution-wash hover:bg-caution-wash text-caution border border-caution-line rounded text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Test: Allergy Conflict
                        </button>
                        <button
                          onClick={handleSimulateDuplicateMed}
                          className="px-2.5 py-1 bg-paper hover:bg-paper-2 text-ink-2 border border-rule rounded text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Test: Duplicate Med
                        </button>
                        <button
                          onClick={handleSimulateMissingField}
                          className="px-2.5 py-1 bg-critical-wash hover:bg-critical-wash text-critical border border-critical-line rounded text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Test: Missing Field
                        </button>
                        <button
                          onClick={handleSimulateDiscrepancy}
                          className="px-2.5 py-1 bg-caution-wash hover:bg-caution-wash text-caution border border-caution-line rounded text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Test: Discrepancy Flag
                        </button>
                        <button
                          onClick={handleSimulateMemoryProposal}
                          className="px-2.5 py-1 bg-accent-wash hover:bg-accent-wash text-accent-ink border border-accent-line rounded text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Test: Memory Proposal
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Post-Consultation Intelligence: Consultation Changes (Phase 7) */}
                {consultChanges && (status === 'review' || status === 'complete') && (
                  <div className="bg-paper border border-rule rounded-xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-rule pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-settled-wash text-settled flex items-center justify-center">
                          <Activity size={16} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                            Consultation Changes & Longitudinal Delta
                          </h3>
                          <p className="text-[11px] text-on-solid0">
                            Synthesized clinical trajectory changes from current encounter
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-on-solid0 bg-paper-2 px-2 py-0.5 rounded">
                        Clinical Delta
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      {/* NEW */}
                      <div className="bg-paper-2 border border-rule rounded-lg p-3 space-y-1.5">
                        <span className="font-bold text-[11px] text-settled uppercase tracking-wider block">
                          NEW ({consultChanges.newItems.length})
                        </span>
                        {consultChanges.newItems.length > 0 ? (
                          <ul className="space-y-1 text-ink-2">
                            {consultChanges.newItems.map((item, idx) => (
                              <li key={idx} className="truncate">
                                &bull; <strong className="text-ink">{item.title}:</strong> {item.statement}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-ink-3 italic">None newly recorded</span>
                        )}
                      </div>

                      {/* CHANGED */}
                      <div className="bg-paper-2 border border-rule rounded-lg p-3 space-y-1.5">
                        <span className="font-bold text-[11px] text-brand-700 uppercase tracking-wider block">
                          CHANGED ({consultChanges.changedItems.length})
                        </span>
                        {consultChanges.changedItems.length > 0 ? (
                          <ul className="space-y-1 text-ink-2">
                            {consultChanges.changedItems.map((item, idx) => (
                              <li key={idx} className="truncate">
                                &bull; <strong className="text-ink">{item.title}:</strong> {item.statement}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-ink-3 italic">No dosage adjustments</span>
                        )}
                      </div>

                      {/* RESOLVED */}
                      <div className="bg-paper-2 border border-rule rounded-lg p-3 space-y-1.5">
                        <span className="font-bold text-[11px] text-accent-ink uppercase tracking-wider block">
                          RESOLVED ({consultChanges.resolvedItems.length})
                        </span>
                        {consultChanges.resolvedItems.length > 0 ? (
                          <ul className="space-y-1 text-ink-2">
                            {consultChanges.resolvedItems.map((item, idx) => (
                              <li key={idx} className="truncate">
                                &bull; <strong className="text-ink">{item.title}:</strong> {item.statement}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-ink-3 italic">No conditions resolved</span>
                        )}
                      </div>

                      {/* FOLLOW-UP */}
                      <div className="bg-paper-2 border border-rule rounded-lg p-3 space-y-1.5">
                        <span className="font-bold text-[11px] text-caution uppercase tracking-wider block">
                          FOLLOW-UP ({consultChanges.followUpItems.length})
                        </span>
                        {consultChanges.followUpItems.length > 0 ? (
                          <ul className="space-y-1 text-ink-2">
                            {consultChanges.followUpItems.map((item, idx) => (
                              <li key={idx} className="truncate">
                                &bull; <strong className="text-ink">{item.title}:</strong> {item.statement}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-ink-3 italic">Routine schedule</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Post-Consultation Memory Proposal Review Panel */}
                {status !== 'idle' && status !== 'recording' && status !== 'transcribing' && (
                  <MemoryProposalPanel
                    proposals={memoryProposals}
                    onApprove={handleApproveProposal}
                    onReject={handleRejectProposal}
                    onEdit={handleEditProposal}
                    onApproveAll={handleApproveAllProposals}
                  />
                )}

                {/* Doctor Approval & Sign-Off Block */}
                <div className="border-t border-rule pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-ink text-sm">Physician Review & Approval</h3>
                      <p className="text-xs text-on-solid0 mt-0.5">
                        Explicit physician review and confirmation are required before prescribing.
                      </p>
                    </div>
                    {status === 'complete' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-settled bg-settled-wash px-2.5 py-1 rounded-full border border-settled-line">
                        <CheckCircle2 size={14} /> APPROVED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-caution bg-caution-wash px-2.5 py-1 rounded-full border border-caution-line">
                        <FileText size={14} /> DRAFT &mdash; REVIEW REQUIRED
                      </span>
                    )}
                  </div>

                  {status !== 'complete' ? (
                    <div className="space-y-4">
                      {prescriptions.length > 0 && (
                        <label className="flex items-start gap-3 p-3.5 bg-paper-2 border border-rule rounded-lg cursor-pointer hover:bg-paper-2/70 transition-colors">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded text-brand-600 focus:ring-brand-500 border-rule cursor-pointer"
                            checked={reviewedConfirmed}
                            onChange={(e) => setReviewedConfirmed(e.target.checked)}
                          />
                          <span className="text-xs font-semibold text-ink">
                            I have reviewed the medications, dosage, frequency and duration.
                          </span>
                        </label>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                        <div className="text-xs text-on-solid0">
                          {rxReport.blockedCount > 0 ? (
                            <span className="text-critical font-semibold flex items-center gap-1">
                              <AlertCircle size={13} /> Action blocked: Resolve missing required fields before saving.
                            </span>
                          ) : (rxReport.unacknowledgedWarningCount > 0 || noteReport.unacknowledgedWarningCount > 0) ? (
                            <span className="text-caution font-semibold flex items-center gap-1">
                              <AlertTriangle size={13} /> Physician review required: Acknowledge flagged warnings above.
                            </span>
                          ) : prescriptions.length === 0 ? (
                            'No medications in prescription. Approving will commit clinical note only.'
                          ) : (
                            `${prescriptions.length} medication${prescriptions.length > 1 ? 's' : ''} prepared for order.`
                          )}
                        </div>
                        <button
                          onClick={handleApproveAndSave}
                          disabled={!canApprove}
                          className={`px-6 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-all ${
                            !canApprove
                              ? 'bg-rule text-ink-3 cursor-not-allowed'
                              : 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer'
                          }`}
                        >
                          {status === 'saving' ? (
                            <><Loader2 size={16} className="animate-spin" /> Saving atomically...</>
                          ) : (
                            <><ShieldCheck size={16} /> Approve & Save to FHIR</>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-settled-wash border border-settled-line rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-settled flex items-center gap-1.5">
                          <CheckCircle2 size={15} /> Approved by doctor
                        </p>
                        <p className="text-xs text-settled mt-1">
                          {approvalInfo?.doctor || 'Dr. Alex Morgan, MD'} &bull; {approvalInfo?.timestamp || new Date().toLocaleString()}
                        </p>
                        <p className="text-xs font-medium text-ink-2 mt-0.5">
                          {prescriptions.length} medication{prescriptions.length === 1 ? '' : 's'} recorded as active FHIR MedicationRequest orders.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {prescriptions.length > 0 && (
                          <button
                            onClick={() => setShowPdfModal(true)}
                            className="bg-paper border border-settled-line text-settled hover:bg-settled-wash/70 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                          >
                            <Printer size={15} /> View / Print Prescription PDF
                          </button>
                        )}
                        <Link
                          to={`/patients/${patientId}`}
                          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          Back to Patient Profile
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Post-Consultation Physician Feedback Widget (Phase 6) */}
                {status === 'complete' && (
                  <div className="mt-6 pt-5 border-t border-rule">
                    <div className="bg-paper-2 border border-rule rounded-xl p-5 shadow-xs">
                      <div className="flex items-center justify-between mb-3 border-b border-rule pb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                            <Activity size={16} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm text-ink">Physician Feedback Loop</h3>
                            <p className="text-[11px] text-on-solid0">How useful was Proton for this consultation?</p>
                          </div>
                        </div>
                        {feedbackSubmitted && (
                          <span className="text-xs font-semibold text-settled bg-settled-wash border border-settled-line px-2.5 py-1 rounded-full flex items-center gap-1">
                            <Check size={13} /> Feedback Recorded
                          </span>
                        )}
                      </div>

                      {!feedbackSubmitted ? (
                        <div className="space-y-4 text-xs">
                          <div>
                            <label className="font-semibold text-ink-2 block mb-1.5">
                              Clinical Utility Rating (1 = Poor, 5 = Essential)
                            </label>
                            <div className="flex items-center gap-2 flex-wrap">
                              {[1, 2, 3, 4, 5].map((score) => (
                                <button
                                  key={score}
                                  type="button"
                                  onClick={() => setFeedbackRating(score)}
                                  className={`px-3.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors cursor-pointer ${
                                    feedbackRating === score
                                      ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                                      : 'bg-paper text-ink-2 border-rule hover:bg-paper-2'
                                  }`}
                                >
                                  {score} {score === 1 ? ' (Poor)' : score === 2 ? ' (Fair)' : score === 3 ? ' (Useful)' : score === 4 ? ' (Very Useful)' : ' (Essential)'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="font-semibold text-ink-2 block mb-1.5">
                              What did you have to correct? (Select all that apply)
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                'Note Phrasing',
                                'Dosage Adjustment',
                                'Added Missing Medicine',
                                'Removed Suggested Medicine',
                                'Diagnosis Refinement',
                                'None: Accepted Directly'
                              ].map((tag) => {
                                const isSelected = feedbackCorrections.includes(tag);
                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                      setFeedbackCorrections(prev =>
                                        isSelected ? prev.filter(t => t !== tag) : [...prev, tag]
                                      );
                                    }}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-brand-50 border-brand-300 text-brand-800'
                                        : 'bg-paper border-rule text-ink-2 hover:bg-paper-2'
                                    }`}
                                  >
                                    {isSelected ? '✓ ' : '+ '}{tag}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <label className="font-semibold text-ink-2 block mb-1">
                              Physician Notes (Optional)
                            </label>
                            <input
                              type="text"
                              value={feedbackComment}
                              onChange={(e) => setFeedbackComment(e.target.value)}
                              placeholder="e.g., Note generated accurately; adjusted ibuprofen duration."
                              className="w-full text-xs bg-paper border border-rule rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            />
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              disabled={feedbackRating === 0}
                              onClick={handleSubmitFeedback}
                              className={`px-4 py-2 rounded-lg font-semibold text-xs transition-colors shadow-xs ${
                                feedbackRating === 0
                                  ? 'bg-rule text-ink-3 cursor-not-allowed'
                                  : 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer'
                              }`}
                            >
                              Submit Feedback
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-settled-wash border border-settled-line rounded-lg text-xs text-settled">
                          Thank you. Your feedback has been recorded into the clinical verification audit trail.
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>

        {/* Modal: Medicine Composer */}
        {isComposerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-solid/50 backdrop-blur-xs p-4">
            <div className="bg-paper rounded-xl shadow-xl border border-rule w-full max-w-lg overflow-hidden">
              <div className="bg-paper-2 px-5 py-4 border-b border-rule flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill size={18} className="text-brand-600" />
                  <h3 className="font-semibold text-ink text-sm">
                    {editingId ? 'Edit Medication' : 'Add Medication to Prescription'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsComposerOpen(false)}
                  className="text-ink-3 hover:text-ink-2 p-1 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {formError && (
                  <div className="p-2.5 bg-critical-wash border border-critical-line rounded-lg text-xs text-critical font-medium">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-ink-2 mb-1">Medicine Name *</label>
                    <input
                      type="text"
                      className="w-full text-xs border border-rule rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. Metformin"
                      value={medForm.name}
                      onChange={(e) => setMedForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-ink-2 mb-1">Strength *</label>
                    <input
                      type="text"
                      className="w-full text-xs border border-rule rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. 500 mg"
                      value={medForm.strength}
                      onChange={(e) => setMedForm(prev => ({ ...prev, strength: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">Dose *</label>
                    <input
                      type="text"
                      className="w-full text-xs border border-rule rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. 1 tablet"
                      value={medForm.dose}
                      onChange={(e) => setMedForm(prev => ({ ...prev, dose: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">Route *</label>
                    <select
                      className="w-full text-xs bg-paper border border-rule rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      value={medForm.route}
                      onChange={(e) => setMedForm(prev => ({ ...prev, route: e.target.value }))}
                    >
                      {ROUTE_OPTIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">Frequency *</label>
                    <input
                      list="freq-options"
                      type="text"
                      className="w-full text-xs border border-rule rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. Twice daily"
                      value={medForm.frequency}
                      onChange={(e) => setMedForm(prev => ({ ...prev, frequency: e.target.value }))}
                    />
                    <datalist id="freq-options">
                      {FREQUENCY_OPTIONS.map(f => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-2 mb-1">Duration *</label>
                    <input
                      type="text"
                      className="w-full text-xs border border-rule rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="e.g. 30 days"
                      value={medForm.duration}
                      onChange={(e) => setMedForm(prev => ({ ...prev, duration: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">Patient Instructions</label>
                  <input
                    type="text"
                    className="w-full text-xs border border-rule rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Take after meals with plenty of water"
                    value={medForm.instructions}
                    onChange={(e) => setMedForm(prev => ({ ...prev, instructions: e.target.value }))}
                  />
                </div>
              </div>

              <div className="bg-paper-2 px-6 py-3 border-t border-rule flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-ink-2 hover:bg-rule rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMedicine}
                  className="px-5 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  {editingId ? 'Update Medicine' : 'Add to Prescription'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Prescription PDF Preview */}
        <PrescriptionPDFModal
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          patient={patient}
          doctorName="Dr. Alex Morgan, MD"
          date={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          medications={prescriptions}
        />

        {/* Modal: Clinical Evidence & Provenance Preview (Phase 9) */}
        <EvidenceModal
          evidence={selectedEvidence}
          isOpen={isEvidenceModalOpen}
          onClose={() => setIsEvidenceModalOpen(false)}
        />

      </div>
    </Layout>
  );
}
