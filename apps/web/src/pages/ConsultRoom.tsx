import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileText,
  Mic,
  Plus,
  ShieldAlert,
  Sparkles,
  Square,
  X
} from 'lucide-react';

import { scheduleService } from '../services/scheduleService';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';
import type { DoctorDeskPatient } from '../components/DoctorDeskEncounter';
import { clinicApi, type ClinicNote, type PatientChart } from '../lib/clinicApi';
import { apiFetch } from '../lib/api';
import { API_BASE_URL } from '../config';
import { RealSpeechService } from '../services/speech';
import { authService } from '../services/auth';
import type { Appointment } from '../domain/schedule/types';

/**
 * ConsultRoom — one patient, one uninterrupted line.
 *
 * summary → listen → note → sign. Nothing else on screen.
 * The signed note is the case: it lands in /api/clinic notes and in the
 * patient's history in the same transaction.
 */

type Phase = 'summary' | 'listening' | 'note' | 'signed';

interface Rx {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  duration: string;
}

interface NoteFields {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface EvidenceItem {
  title?: string;
  source?: string;
  summary?: string;
  grade?: string;
  url?: string;
}

const EMPTY_NOTE: NoteFields = { subjective: '', objective: '', assessment: '', plan: '' };

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pickNote(payload: unknown): Partial<NoteFields> {
  if (!payload || typeof payload !== 'object') return {};
  const node = payload as Record<string, unknown>;
  const read = (key: string): string => {
    const value = node[key];
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const inner = value as Record<string, unknown>;
      const text = inner.text || inner.content || inner.summary || inner.value;
      if (typeof text === 'string') return text;
    }
    return '';
  };
  return {
    subjective: read('subjective'),
    objective: read('objective'),
    assessment: read('assessment'),
    plan: read('plan')
  };
}

export default function ConsultRoom() {
  const { appointmentId = '' } = useParams();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [chart, setChart] = useState<PatientChart | null>(null);
  const [demoPatient, setDemoPatient] = useState<DoctorDeskPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('summary');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const [note, setNote] = useState<NoteFields>(EMPTY_NOTE);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [rx, setRx] = useState<Rx[]>([]);
  const [rxDraft, setRxDraft] = useState({ name: '', dose: '', frequency: '', duration: '' });

  const [draftId, setDraftId] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [signed, setSigned] = useState<ClinicNote | null>(null);
  const [mirrorWarning, setMirrorWarning] = useState<string | null>(null);

  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  /* ── load ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const today = await scheduleService.getTodayAppointments();
        let found = today.find((a) => a.id === appointmentId) || null;

        if (!found) {
          const { appointments } = await clinicApi.listAppointments({ date: 'all' });
          const match = appointments.find((a) => a.id === appointmentId);
          if (match) {
            found = {
              id: match.id,
              patientId: match.patientId,
              patientName: match.patientName,
              patientAge: match.patientAge || 0,
              patientGender: 'unknown',
              mrn: match.mrn || '',
              time: match.time,
              durationMinutes: match.durationMinutes,
              appointmentType: 'Consultation',
              status: 'READY',
              queueCategory: match.queueCategory,
              roomOrVirtual: match.roomOrVirtual,
              priority: match.priority,
              chiefComplaint: match.chiefComplaint || '',
              criticalAllergies: match.criticalAllergies || []
            } as Appointment;
          }
        }

        if (!alive) return;
        setAppointment(found);

        if (found?.patientId) {
          const synthetic = TODAY_CLINIC_SCHEDULE.find((entry) => entry.id === found?.patientId) || null;
          if (alive) setDemoPatient(synthetic);
          clinicApi
            .getPatient(found.patientId)
            .then((data) => {
              if (alive) setChart(data);
            })
            .catch(() => undefined);
        }
      } catch {
        if (alive) setLoadError('This appointment could not be opened.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [appointmentId]);

  /* ── timer ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== 'listening') return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopTracks(), [stopTracks]);

  /* ── facts ────────────────────────────────────────────────────────────── */
  const allergies = useMemo(() => {
    const list = chart?.patient?.allergies;
    if (Array.isArray(list) && list.length > 0) return list;
    if (demoPatient?.allergies?.length) return demoPatient.allergies;
    return appointment?.criticalAllergies || [];
  }, [chart, appointment, demoPatient]);

  const conditions = useMemo(() => {
    const list = chart?.patient?.conditions;
    if (Array.isArray(list) && list.length > 0) return list;
    return demoPatient?.conditions || [];
  }, [chart, demoPatient]);

  const medications = useMemo(() => {
    const list = chart?.patient?.medications;
    if (Array.isArray(list) && list.length > 0) return list;
    return demoPatient?.medications || [];
  }, [chart, demoPatient]);

  const vitalLabel = (key: string) =>
    ({ bp: 'BP', hr: 'HR', spo2: 'SpO2', temp: 'Temp', bmi: 'BMI', rr: 'RR' })[
      key.toLowerCase()
    ] || key.toUpperCase();

  const vanta = chart?.patient?.vitals;
  const vitals = vanta
    ? Object.entries(vanta)
        .slice(0, 4)
        .map(([key, value]) => `${vitalLabel(key)} ${value}`)
        .join(' · ')
    : demoPatient?.vitals
      ? Object.entries(demoPatient.vitals)
          .slice(0, 4)
          .map(([key, value]) => `${vitalLabel(key)} ${value}`)
          .join(' · ')
      : '';

  const labs = chart?.patient?.recentLabs?.length
    ? chart.patient.recentLabs
    : demoPatient?.recentLabs || [];
  const labLine = labs
    .slice(0, 3)
    .map((lab) => {
      const name = String(lab.name || '');
      const value = String(lab.value || '');
      return `${name} ${value}`.trim();
    })
    .filter(Boolean)
    .join(' · ');

  const hasRealAllergy = allergies.some((allergy) => !/no known/i.test(allergy));

  const lastVisit = chart?.notes?.[0];

  const plannedMedNames = rx.map((r) => r.name).join(' ');

  const hardStop = useMemo(() => {
    const penicillinAllergy = allergies.some(
      (a) => /penicillin|anaphyla/i.test(a)
    );
    const betaLactam = /amoxicillin|ampicillin|augmentin|penicillin/i.test(plannedMedNames);
    return penicillinAllergy && betaLactam;
  }, [allergies, plannedMedNames]);

  const renalWarning = useMemo(() => {
    const ckd = conditions.some((c) => /ckd|kidney|renal/i.test(c));
    const nsaid = /ibuprofen|naproxen|meloxicam|ketorolac/i.test(plannedMedNames);
    return ckd && nsaid;
  }, [conditions, plannedMedNames]);

  /* ── context ──────────────────────────────────────────────────────────── */
  const patientContext = useMemo(() => {
    if (!appointment) return '';
    return [
      `Patient: ${appointment.patientName}`,
      appointment.patientAge ? `Age: ${appointment.patientAge}` : '',
      appointment.chiefComplaint ? `Reason: ${appointment.chiefComplaint}` : '',
      conditions.length ? `Conditions: ${conditions.join(', ')}` : '',
      medications.length ? `Medications: ${medications.join(', ')}` : '',
      allergies.length ? `Allergies: ${allergies.join(', ')}` : '',
      vitals ? `Vitals: ${vitals}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }, [appointment, conditions, medications, allergies, vitals]);

  /* ── draft ────────────────────────────────────────────────────────────── */
  const generateFrom = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setDrafting(true);
      setDraftError(null);
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/generate-note`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ transcript: text, patientContext, template: 'SOAP' })
        });
        if (!response.ok) throw new Error('draft unavailable');
        const data = (await response.json()) as { note?: unknown };
        const parsed = pickNote(data.note);
        setNote((current) => ({
          subjective: parsed.subjective || current.subjective,
          objective: parsed.objective || current.objective,
          assessment: parsed.assessment || current.assessment,
          plan: parsed.plan || current.plan
        }));
      } catch {
        setDraftError('Draft unavailable. Your words are still here — write it yourself.');
      } finally {
        setDrafting(false);
      }
    },
    [patientContext]
  );

  const draftNote = useCallback(() => {
    if (!transcript.trim()) {
      setDraftError('Nothing to draft from. Record or type the visit first.');
      return;
    }
    void generateFrom(transcript);
  }, [transcript, generateFrom]);

  /* ── listen ───────────────────────────────────────────────────────────── */
  const startListening = useCallback(async () => {
    setTranscribeError(null);
    setTranscript('');
    setSeconds(0);

    // The case opens now, not at signing: a draft note and an in-room status.
    if (appointment) {
      void clinicApi
        .saveDraft({
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          appointmentId: appointment.id,
          title: appointment.chiefComplaint || 'Consultation',
          note: EMPTY_NOTE,
          template: 'SOAP'
        })
        .then((result) => setDraftId(result.note.id))
        .catch(() => undefined);
      void clinicApi.updateAppointment(appointment.id, { status: 'IN_ROOM' }).catch(() => undefined);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
      );

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setPhase('note');
        if (blob.size < 800) {
          setTranscribeError('No audio captured. Type the note below.');
          return;
        }
        setTranscribing(true);
        try {
          const text = await new RealSpeechService().transcribe(blob);
          setTranscript(text || '');
          setNote((current) => ({ ...current, subjective: text || current.subjective }));
          if (text) void generateFrom(text);
        } catch {
          setTranscribeError('Transcription unavailable. Type the note below.');
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setPhase('listening');
    } catch {
      setTranscribeError('Microphone unavailable. Type the note instead.');
      setPhase('note');
    }
  }, [stopTracks, generateFrom, appointment]);

  const stopListening = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorderRef.current = null;
  }, []);

  /* ── evidence ─────────────────────────────────────────────────────────── */
  const loadEvidence = useCallback(async () => {
    setEvidenceLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/clinical/evidence/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: note.assessment || appointment?.chiefComplaint || '',
          condition: conditions[0] || '',
          limit: 4
        })
      });
      const data = (await response.json()) as { evidence?: EvidenceItem[] };
      setEvidence(Array.isArray(data.evidence) ? data.evidence : []);
    } catch {
      setEvidence([]);
    } finally {
      setEvidenceLoading(false);
    }
  }, [note.assessment, appointment, conditions]);

  /* ── sign ─────────────────────────────────────────────────────────────── */
  const sign = useCallback(async () => {
    if (!appointment) return;
    if (!note.assessment.trim()) {
      setSignError('Write the assessment before signing.');
      return;
    }
    setSigning(true);
    setSignError(null);
    try {
      const result = await clinicApi.signNote({
        noteId: draftId || undefined,
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        appointmentId: appointment.id,
        title: appointment.chiefComplaint || 'Consultation',
        note,
        diagnoses: note.assessment
          .split('\n')[0]
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean),
        prescriptions: rx.map(({ id, ...rest }) => ({ ...rest, instructions: `${rest.dose} ${rest.frequency} for ${rest.duration}` })),
        attestation:
          'I reviewed the transcript, the generated draft, the medication safety checks, and I sign this note as the attending clinician.'
      });
      setSigned(result.note);
      if (result.mirrorStatus === 'failed') {
        setMirrorWarning(result.mirrorError || 'Durable mirror pending');
      } else {
        setMirrorWarning(null);
      }
      setPhase('signed');
      void clinicApi.updateAppointment(appointment.id, { status: 'COMPLETED' }).catch(() => undefined);
    } catch {
      setSignError('Could not sign. The note is still here — retry.');
    } finally {
      setSigning(false);
    }
  }, [appointment, note, rx, draftId]);

  /* ── render ───────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-studio-void">
        <span className="font-mono text-[11px] tracking-[0.24em] text-white/30 uppercase">opening</span>
      </div>
    );
  }

  if (loadError || !appointment) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-studio-void px-6 text-center">
        <p className="font-display text-3xl text-white/80">This room is empty.</p>
        <p className="max-w-sm text-sm text-white/35">{loadError || 'The appointment no longer exists.'}</p>
        <button
          onClick={() => navigate('/today')}
          className="mt-2 rounded-full border border-white/15 px-5 py-2 font-mono text-[11px] tracking-[0.18em] text-white/70 uppercase hover:bg-white/5"
        >
          back to today
        </button>
      </div>
    );
  }

  const initials = appointment.patientName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-studio-void text-white">
      <style>{`
        @keyframes studioRise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .room-rise { animation: studioRise 500ms cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes bar { 0%,100% { transform: scaleY(.28) } 50% { transform: scaleY(1) } }
        .bar { transform-origin: center; animation: bar 1.15s ease-in-out infinite; }
      `}</style>

      <div className="mx-auto max-w-[1180px] px-4 pt-5 pb-24 sm:px-8">
        {/* header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/today')}
            className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-white/35 uppercase transition-colors hover:text-white/80"
          >
            <ArrowLeft size={14} /> today
          </button>
          <span className="font-mono text-[11px] tracking-[0.18em] text-white/30 uppercase">
            {appointment.time} · {appointment.roomOrVirtual}
          </span>
        </div>

        {/* identity */}
        <div className="room-rise mt-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 font-mono text-[10px] text-white/50">
                {initials}
              </span>
              <span className="font-mono text-[10px] tracking-[0.22em] text-white/30 uppercase">
                {appointment.patientAge ? `${appointment.patientAge} yrs` : 'age not on file'}
                {appointment.mrn ? ` · ${appointment.mrn}` : ''}
              </span>
            </div>
            <h1 className="mt-4 font-display text-4xl leading-none tracking-[-0.02em] sm:text-6xl">
              {appointment.patientName}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/40">
              {appointment.chiefComplaint || 'No reason recorded.'}
            </p>
          </div>

          {phase === 'summary' && (
            <button
              onClick={startListening}
              className="group flex items-center gap-3 rounded-full bg-studio-ember px-7 py-4 text-sm font-medium text-studio-ink transition-transform hover:scale-[1.02] active:scale-[0.99]"
            >
              <Mic size={17} />
              Start consult
            </button>
          )}
        </div>

        {/* ── summary ─────────────────────────────────────────────────── */}
        {phase === 'summary' && (
          <div className="room-rise mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.06] sm:grid-cols-3">
            <Fact label="Allergies" tone={hasRealAllergy ? 'critical' : 'quiet'}>
              {allergies.length ? allergies.join(' · ') : 'None recorded'}
            </Fact>
            <Fact label="Conditions">{conditions.length ? conditions.join(' · ') : 'No active problems'}</Fact>
            <Fact label="Medications">{medications.length ? medications.join(' · ') : 'None active'}</Fact>
            {vitals && (
              <div className="sm:col-span-3">
                <Fact label="Last vitals">{vitals}</Fact>
              </div>
            )}
            {labLine && (
              <div className="sm:col-span-3">
                <Fact label="Recent labs">{labLine}</Fact>
              </div>
            )}
            {lastVisit && (
              <div className="sm:col-span-3">
                <Fact label={`Last visit · ${new Date(lastVisit.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}`}>
                  {[lastVisit.note?.assessment, lastVisit.note?.plan].filter(Boolean).join(' — ') || 'Signed encounter on file.'}
                </Fact>
              </div>
            )}
          </div>
        )}

        {/* ── listening ───────────────────────────────────────────────── */}
        {phase === 'listening' && (
          <div className="room-rise mt-12 rounded-3xl border border-white/[0.08] bg-white/[0.03] px-6 py-12 sm:px-10">
            <div className="flex flex-col items-center gap-8">
              <div className="flex h-16 items-end gap-[3px]">
                {Array.from({ length: 36 }).map((_, i) => (
                  <span
                    key={i}
                    className="bar w-[3px] rounded-full bg-studio-ember"
                    style={{
                      height: `${18 + ((i * 37) % 46)}px`,
                      animationDelay: `${(i % 12) * 0.08}s`,
                      opacity: 0.35 + (i % 5) * 0.13
                    }}
                  />
                ))}
              </div>

              <div className="text-center">
                <div className="font-mono text-5xl tracking-[0.08em] text-white/85 tabular-nums">
                  {formatTimer(seconds)}
                </div>
                <p className="mt-3 font-mono text-[10px] tracking-[0.24em] text-studio-ember/80 uppercase">
                  listening
                </p>
              </div>

              <button
                onClick={stopListening}
                className="flex items-center gap-2.5 rounded-full border border-white/15 px-6 py-3 text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Square size={13} /> Stop
              </button>
            </div>
          </div>
        )}

        {/* ── note ────────────────────────────────────────────────────── */}
        {(phase === 'note' || phase === 'signed') && (
          <div className="room-rise mt-12 grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-8">
              {/* transcript */}
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-[10px] tracking-[0.24em] text-white/30 uppercase">
                    What was said
                  </h2>
                  {transcribing && (
                    <span className="font-mono text-[10px] tracking-[0.18em] text-studio-ember/70 uppercase">
                      transcribing
                    </span>
                  )}
                </div>
                {transcribeError ? (
                  <p className="mt-3 text-sm text-studio-caution">{transcribeError}</p>
                ) : null}
                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  placeholder="The conversation lands here. Edit anything."
                  rows={5}
                  className="mt-3 w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-sm leading-relaxed text-white/70 outline-none placeholder:text-white/20 focus:border-white/20"
                />
              </section>

              {/* note */}
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-[10px] tracking-[0.24em] text-white/30 uppercase">
                    The note
                  </h2>
                  <button
                    onClick={draftNote}
                    disabled={drafting || phase === 'signed'}
                    className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase transition-colors hover:text-studio-ember disabled:opacity-30"
                  >
                    <Sparkles size={12} /> {drafting ? 'drafting' : 'draft'}
                  </button>
                </div>
                {draftError && <p className="mt-2 text-xs text-studio-caution">{draftError}</p>}

                <div className="mt-3 divide-y divide-white/[0.06] border-y border-white/[0.06]">
                  {(
                    [
                      ['subjective', 'Subjective'],
                      ['objective', 'Objective'],
                      ['assessment', 'Assessment'],
                      ['plan', 'Plan']
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block py-4">
                      <span className="font-mono text-[9px] tracking-[0.22em] text-white/25 uppercase">
                        {label}
                      </span>
                      <textarea
                        value={note[key]}
                        onChange={(event) =>
                          setNote((current) => ({ ...current, [key]: event.target.value }))
                        }
                        disabled={phase === 'signed'}
                        rows={key === 'subjective' ? 3 : 2}
                        placeholder={key === 'assessment' ? 'What is going on, in one line.' : ''}
                        className="mt-1.5 w-full resize-none bg-transparent text-[15px] leading-relaxed text-white/80 outline-none placeholder:text-white/15 disabled:opacity-60"
                      />
                    </label>
                  ))}
                </div>
              </section>

              {/* evidence */}
              <section>
                <button
                  onClick={loadEvidence}
                  className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase transition-colors hover:text-white/70"
                >
                  <FileText size={12} /> {evidenceLoading ? 'searching' : 'evidence'}
                </button>
                {evidence && (
                  <div className="mt-3 space-y-2">
                    {evidence.length === 0 && (
                      <p className="text-xs text-white/30">No matching guideline for this assessment.</p>
                    )}
                    {evidence.map((item, index) => (
                      <a
                        key={index}
                        href={item.url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-white/[0.07] px-4 py-3 transition-colors hover:bg-white/[0.04]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-white/70">{item.title || 'Untitled source'}</p>
                          <ArrowUpRight size={13} className="mt-0.5 shrink-0 text-white/25" />
                        </div>
                        <p className="mt-1 font-mono text-[9px] tracking-[0.14em] text-white/25 uppercase">
                          {[item.source, item.grade].filter(Boolean).join(' · ') || 'guideline'}
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* right rail */}
            <aside className="space-y-6">
              {(hardStop || renalWarning) && (
                <div className="rounded-2xl border border-studio-critical/50 bg-studio-critical/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-studio-critical-soft">
                    <ShieldAlert size={14} />
                    <span className="font-mono text-[10px] tracking-[0.18em] uppercase">
                      {hardStop ? 'blocked' : 'caution'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">
                    {hardStop
                      ? 'This allergy conflicts with the proposed medication. Remove it or document an override rationale before signing.'
                      : 'Renal caution: NSAID with a kidney diagnosis. Consider an alternative.'}
                  </p>
                </div>
              )}

              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <h2 className="font-mono text-[10px] tracking-[0.22em] text-white/30 uppercase">
                  Prescription
                </h2>

                <div className="mt-3 space-y-2">
                  {rx.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white/80">{item.name}</p>
                        <p className="truncate font-mono text-[9px] tracking-[0.1em] text-white/30 uppercase">
                          {[item.dose, item.frequency, item.duration].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <button
                        onClick={() => setRx((current) => current.filter((r) => r.id !== item.id))}
                        className="text-white/25 hover:text-studio-critical-soft"
                        aria-label="Remove"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {phase !== 'signed' && (
                  <div className="mt-3 space-y-2">
                    <input
                      value={rxDraft.name}
                      onChange={(event) => setRxDraft((d) => ({ ...d, name: event.target.value }))}
                      placeholder="Medication"
                      className="w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm text-white/80 outline-none placeholder:text-white/20 focus:border-white/20"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {(['dose', 'frequency', 'duration'] as const).map((field) => (
                        <input
                          key={field}
                          value={rxDraft[field]}
                          onChange={(event) =>
                            setRxDraft((d) => ({ ...d, [field]: event.target.value }))
                          }
                          placeholder={field}
                          className="w-full rounded-lg border border-white/[0.08] bg-transparent px-2.5 py-2 text-xs text-white/70 outline-none placeholder:text-white/20 focus:border-white/20"
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (!rxDraft.name.trim()) return;
                        setRx((current) => [
                          ...current,
                          { id: crypto.randomUUID(), ...rxDraft, name: rxDraft.name.trim() }
                        ]);
                        setRxDraft({ name: '', dose: '', frequency: '', duration: '' });
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 py-2 font-mono text-[10px] tracking-[0.16em] text-white/35 uppercase hover:border-white/30 hover:text-white/60"
                    >
                      <Plus size={12} /> add
                    </button>
                  </div>
                )}
              </section>

              {phase === 'signed' ? (
                <section className="rounded-2xl border border-studio-settled/40 bg-studio-settled/10 p-5">
                  <div className="flex items-center gap-2 text-studio-settled-soft">
                    <Check size={15} />
                    <span className="font-mono text-[10px] tracking-[0.18em] uppercase">signed</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">
                    The case is in {appointment.patientName.split(' ')[0]}'s history, and the
                    prescription is on the profile.
                  </p>
                  {mirrorWarning && (
                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                      <strong>Mirror sync warning:</strong> Note signed in clinic desk, but mirroring to durable workflow failed ({mirrorWarning}).
                    </div>
                  )}
                  {signed?.id && (
                    <p className="mt-2 font-mono text-[9px] tracking-[0.16em] text-white/25 uppercase">
                      case {signed.id.slice(0, 8)}
                    </p>
                  )}
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      onClick={() => navigate(`/patients/${encodeURIComponent(appointment.patientId)}`)}
                      className="flex items-center justify-between rounded-full bg-white px-4 py-2.5 text-sm font-medium text-studio-void"
                    >
                      Open profile <ArrowUpRight size={15} />
                    </button>
                    <button
                      onClick={() => navigate('/today')}
                      className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/60 hover:bg-white/5"
                    >
                      Next patient
                    </button>
                  </div>
                </section>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={sign}
                    disabled={signing || hardStop}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-sm font-medium text-studio-void transition-opacity hover:opacity-90 disabled:opacity-30"
                  >
                    {signing ? 'signing' : 'Sign & close'}
                  </button>
                  {signError && <p className="text-xs text-studio-critical-soft">{signError}</p>}
                  <p className="px-1 font-mono text-[9px] leading-relaxed tracking-[0.1em] text-white/20 uppercase">
                    {authService.getCurrentUser()?.displayName || 'attending'} · signed at the point of care
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({
  label,
  tone = 'quiet',
  children
}: {
  label: string;
  tone?: 'quiet' | 'critical';
  children: ReactNode;
}) {
  return (
    <div className="bg-studio-panel px-5 py-4">
      <p className="font-mono text-[9px] tracking-[0.22em] text-white/25 uppercase">{label}</p>
      <p
        className={`mt-1.5 text-sm leading-relaxed ${
          tone === 'critical' ? 'text-studio-critical-soft' : 'text-white/70'
        }`}
      >
        {children}
      </p>
    </div>
  );
}
