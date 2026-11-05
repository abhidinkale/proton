import { useRef, useState, useEffect, type KeyboardEvent } from 'react';
import { 
  ArrowUp, LoaderCircle, Copy, Check, Calendar,
  User, CheckCircle2, Pill, FileText, AlertTriangle,
  Clock, ShieldCheck, MessageSquare, Inbox,
  RefreshCw, Atom, Globe, Mic, MicOff
} from 'lucide-react';
import { sendEhrCopilotCommand, type EhrCopilotResponse } from '../services/ai';
import Layout from '../components/Layout';

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: EhrCopilotResponse['cards'];
  actions?: EhrCopilotResponse['actions'];
  timestamp: string;
}

// Photorealistic Chromatic Lens Bokeh Orb matching Arc & Reference Screenshot
function ChromaticLensOrb({ active = false, size = 26 }: { active?: boolean; size?: number }) {
  return (
    <div
      className={`relative rounded-full flex items-center justify-center shrink-0 select-none ${
        active ? 'animate-pulse' : ''
      }`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Ethereal Ambient Blur Glow */}
      <div
        className="absolute inset-0 rounded-full blur-xs opacity-80"
        style={{
          background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85) 0%, rgba(190,170,255,0.45) 40%, rgba(99,102,241,0.25) 70%, transparent 100%)'
        }}
      />
      {/* SVG Chromatic Lens Bokeh Orb */}
      <svg
        viewBox="0 0 32 32"
        className="w-full h-full relative drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
      >
        <defs>
          <radialGradient id="bokehBg" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="25%" stopColor="#d8b4fe" stopOpacity="0.8" />
            <stop offset="55%" stopColor="#4f46e5" stopOpacity="0.5" />
            <stop offset="85%" stopColor="#1e1b4b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0b0f19" stopOpacity="0.98" />
          </radialGradient>
          <radialGradient id="bokehSpecular" cx="30%" cy="25%" r="35%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bokehRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="45%" stopColor="rgba(192,132,252,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
          </linearGradient>
        </defs>
        {/* Main Sphere Body */}
        <circle cx="16" cy="16" r="14" fill="url(#bokehBg)" stroke="url(#bokehRim)" strokeWidth="1" />
        {/* Iridescent Crescent Rim Reflection */}
        <ellipse cx="20" cy="21" rx="8" ry="4" fill="rgba(255,255,255,0.18)" transform="rotate(-25 20 21)" />
        {/* Pinpoint Highlight */}
        <circle cx="11" cy="11" r="5" fill="url(#bokehSpecular)" />
        <circle cx="10" cy="10" r="1.5" fill="#ffffff" />
      </svg>
    </div>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content: "Good morning, Dr. Lin. Clinic schedules, active patient charts, and pharmacy orders are synchronized for today's session.\n\nYou can query appointments, review patient records, order medications with allergy verification, draft clinical SOAP notes, or dispatch patient instructions.\n\nWhat clinical task would you like to perform?",
      timestamp: '16:46'
    }
  ]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isDeepThink, setIsDeepThink] = useState(true);
  const [isSearch, setIsSearch] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Progressive thinking step progression during queries
  useEffect(() => {
    if (!isSending) {
      setThinkingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 700);
    return () => clearInterval(interval);
  }, [isSending]);

  // Speech Dictation initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const reco = new SpeechRecognition();
        reco.continuous = false;
        reco.interimResults = true;
        reco.lang = 'en-US';
        reco.onresult = (e: any) => {
          const transcript = Array.from(e.results)
            .map((res: any) => res[0].transcript)
            .join('');
          setDraft(transcript);
        };
        reco.onend = () => setIsListening(false);
        reco.onerror = () => setIsListening(false);
        recognitionRef.current = reco;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        // ignore
      }
    }
  };

  const quickCommands = [
    { label: "Today's Schedule", prompt: "What appointments do I have on my schedule today?", icon: Calendar },
    { label: "Patient Chart: Abhi", prompt: "Look up patient Abhi and give me his chart summary.", icon: User },
    { label: "Confirm Abhi's Visit", prompt: "Confirm Abhi's appointment for today.", icon: CheckCircle2 },
    { label: "Prescribe Amoxicillin", prompt: "Prescribe Amoxicillin 500mg TDS for 5 days for Abhi for his cough.", icon: Pill },
    { label: "Draft SOAP Note", prompt: "Write and sign a SOAP note for Abhi: Subjective is acute productive cough for 3 days. Objective vitals normal, chest clear. Assessment is acute tracheobronchitis. Plan is rest, hydration, and Amoxicillin.", icon: FileText },
    { label: "Send Message", prompt: "Send a message to Abhi: Dr. Lin has confirmed your visit. Please take your fluids and rest.", icon: MessageSquare },
    { label: "Triage Queue", prompt: "What items in the clinic need my immediate attention?", icon: Inbox }
  ];

  const submitCommand = async (commandText?: string) => {
    const text = (commandText || draft).trim();
    if (!text || isSending) return;

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    if (!commandText) setDraft('');
    setError('');
    setIsSending(true);
    setThinkingStep(0);

    try {
      const history = messages
        .filter(m => m.id !== 'msg-init')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await sendEhrCopilotCommand(text, history);

      const assistantMessage: AssistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.message || 'Action completed in EHR system.',
        cards: res.cards,
        actions: res.actions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'EHR Copilot encountered an error. Please try again.');
    } finally {
      setIsSending(false);
      setTimeout(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitCommand();
    }
  };

  const copyResponse = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Markdown line renderer
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="font-bold text-ink text-sm sm:text-base mt-2 mb-1">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="font-bold text-ink text-base mt-3 mb-1.5">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} className="font-extrabold text-ink text-lg mt-3 mb-2">{line.replace('# ', '')}</h2>;
      }

      if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
        const itemText = line.substring(2);
        return (
          <div key={idx} className="flex items-start gap-2.5 my-1.5 ml-1 text-[13.5px] text-ink-2 dark:text-zinc-300 leading-relaxed">
            <span className="text-ink-3 font-bold select-none">•</span>
            <span>{renderInlineStyles(itemText)}</span>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-3" />;
      }

      return <p key={idx} className="my-1.5 text-[13.5px] text-ink dark:text-zinc-200 leading-relaxed">{renderInlineStyles(line)}</p>;
    });
  };

  const renderInlineStyles = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-ink dark:text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="px-1.5 py-0.5 bg-paper-2 dark:bg-white/10 rounded font-mono text-[11px] text-ink dark:text-zinc-200 border border-rule dark:border-white/10">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  // Interactive Card Renderer for EHR Entities
  const renderCard = (card: { type: string; data: any }, cardIdx: number) => {
    const { type, data } = card;

    switch (type) {
      case 'schedule_overview': {
        const appointments = Array.isArray(data) ? data : data.appointments || [];
        return (
          <div key={cardIdx} className="p-3.5 bg-paper/60 dark:bg-black/30 border border-rule/80 dark:border-white/10 rounded-xl space-y-2.5 my-2.5">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-rule/60 dark:border-white/10">
              <div className="flex items-center gap-1.5 font-bold text-ink dark:text-white">
                <Calendar size={14} strokeWidth={1.5} className="text-caution" />
                <span>Clinic Schedule ({appointments.length} Visits)</span>
              </div>
              <span className="text-[10px] text-ink-3 dark:text-zinc-400 uppercase font-mono tracking-wider">Live EHR Database</span>
            </div>
            <div className="divide-y divide-rule/60 dark:divide-white/8">
              {appointments.map((a: any, i: number) => {
                const isConfirmed = a.confirmed_at || a.status === 'CONFIRMED' || a.displayStatus === 'CONFIRMED';
                return (
                  <div key={i} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink dark:text-white">{a.patient_name || a.patientName || 'Patient'}</span>
                        <span className="font-mono text-[11px] text-ink-3 dark:text-zinc-400">MRN: {a.mrn || 'N/A'}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isConfirmed ? 'bg-settled-wash text-settled border border-settled-line' : 'bg-caution-wash text-caution border border-caution-line'
                        }`}>
                          {isConfirmed ? 'CONFIRMED' : (a.status || 'BOOKED')}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-2 dark:text-zinc-400 mt-0.5 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock size={11} strokeWidth={1.5} /> {new Date(a.scheduled_for || a.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>Reason: <strong className="text-ink dark:text-zinc-200">{a.reason || 'General'}</strong></span>
                      </div>
                    </div>
                    {!isConfirmed && (
                      <button
                        type="button"
                        onClick={() => submitCommand(`Confirm appointment ${a.id || a.appointmentId}`)}
                        className="self-start sm:self-auto px-2.5 py-1 bg-solid text-white hover:opacity-90 rounded-lg font-medium text-[11px] transition-all cursor-pointer shadow-2xs"
                      >
                        Confirm Now
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'patient_profile': {
        const p = data;
        return (
          <div key={cardIdx} className="p-3.5 bg-paper/60 dark:bg-black/30 border border-rule/80 dark:border-white/10 rounded-xl space-y-2.5 my-2.5">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-rule/60 dark:border-white/10">
              <div className="flex items-center gap-1.5 font-bold text-ink dark:text-white">
                <User size={14} strokeWidth={1.5} className="text-solid" />
                <span>Patient Chart: {p.fullName}</span>
              </div>
              <span className="font-mono text-[11px] text-ink-3 dark:text-zinc-400">MRN: {p.mrn}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-paper dark:bg-white/5 rounded-lg border border-rule/60 dark:border-white/8">
                <div className="text-[10px] text-ink-3 dark:text-zinc-400 uppercase font-mono">DOB & Sex</div>
                <div className="font-semibold text-ink dark:text-zinc-200 mt-0.5">{p.dob ? new Date(p.dob).toLocaleDateString() : 'N/A'} ({p.sex || 'Unknown'})</div>
              </div>
              <div className="p-2 bg-paper dark:bg-white/5 rounded-lg border border-rule/60 dark:border-white/8">
                <div className="text-[10px] text-ink-3 dark:text-zinc-400 uppercase font-mono">Contact</div>
                <div className="font-semibold text-ink dark:text-zinc-200 mt-0.5 truncate">{p.phone || 'N/A'}</div>
              </div>
              <div className="p-2 bg-paper dark:bg-white/5 rounded-lg border border-rule/60 dark:border-white/8 col-span-2">
                <div className="text-[10px] text-ink-3 dark:text-zinc-400 uppercase font-mono">Allergies</div>
                <div className="font-semibold mt-0.5">
                  {p.allergies && p.allergies.length > 0 ? (
                    <span className="text-critical font-bold">{p.allergies.join(', ')}</span>
                  ) : (
                    <span className="text-settled font-medium">No Known Drug Allergies (NKDA)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'appointment_confirmed': {
        return (
          <div key={cardIdx} className="p-3 bg-settled-wash border border-settled-line rounded-xl flex items-center justify-between gap-3 text-xs my-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-settled text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-bold text-ink">Appointment Confirmed</div>
                <div className="text-[11px] text-ink-2 font-mono">ID: {data.id || data.appointmentId} • Confirmed for {new Date(data.scheduled_for || data.scheduledFor).toLocaleString()}</div>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-settled text-white rounded font-mono text-[10px] font-bold">COMMITTED</span>
          </div>
        );
      }

      case 'prescription_drafted': {
        const isClear = data.safetyStatus === 'CLEAR';
        return (
          <div key={cardIdx} className="p-3.5 bg-paper/60 dark:bg-black/30 border border-rule/80 dark:border-white/10 rounded-xl space-y-2.5 my-2.5">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-rule/60 dark:border-white/10">
              <div className="flex items-center gap-1.5 font-bold text-ink dark:text-white">
                <Pill size={14} strokeWidth={1.5} className="text-caution" />
                <span>Prescription Order Recorded: {data.medicationName}</span>
              </div>
              <span className="font-mono text-[10px] text-ink-3 dark:text-zinc-400">ID: {data.prescriptionId}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div>Dose: <strong className="text-ink dark:text-zinc-200">{data.dose}</strong></div>
              <div>Frequency: <strong className="text-ink dark:text-zinc-200">{data.frequency}</strong></div>
              <div>Duration: <strong className="text-ink dark:text-zinc-200">{data.durationDays} days</strong></div>
              <div>Route: <strong className="text-ink dark:text-zinc-200">Oral</strong></div>
            </div>
            <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
              isClear ? 'bg-settled-wash border border-settled-line text-settled' : 'bg-critical-wash border border-critical-line text-critical'
            }`}>
              {isClear ? <ShieldCheck size={14} strokeWidth={1.5} /> : <AlertTriangle size={14} strokeWidth={1.5} />}
              <span className="font-semibold">
                {isClear ? 'Deterministic Interaction Check: CLEAR (Zero documented conflicts)' : data.safetyDetail?.allergyWarning}
              </span>
            </div>
            <div className="text-[11px] text-ink-3 dark:text-zinc-400 pt-1 border-t border-rule/60 dark:border-white/8 flex items-center justify-between">
              <span>Author: <strong>{data.signedBy || 'Dr. Evelyn Lin, MD'}</strong></span>
              <span className="text-settled font-bold">STATUS: SIGNED</span>
            </div>
          </div>
        );
      }

      case 'clinical_note': {
        return (
          <div key={cardIdx} className="p-3.5 bg-paper/60 dark:bg-black/30 border border-rule/80 dark:border-white/10 rounded-xl space-y-2 my-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-rule/60 dark:border-white/10">
              <div className="flex items-center gap-1.5 font-bold text-ink dark:text-white">
                <FileText size={14} strokeWidth={1.5} className="text-solid" />
                <span>{data.title || 'Clinical SOAP Note'}</span>
              </div>
              <span className="px-2 py-0.5 bg-settled-wash text-settled border border-settled-line rounded font-mono text-[10px] font-bold">
                {data.status || 'SIGNED'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="p-2 bg-paper dark:bg-white/5 rounded-lg">
                <strong className="text-caution font-mono text-[10px] uppercase">Subjective (S):</strong>
                <p className="text-ink dark:text-zinc-200 mt-0.5">{data.soap?.subjective}</p>
              </div>
              <div className="p-2 bg-paper dark:bg-white/5 rounded-lg">
                <strong className="text-caution font-mono text-[10px] uppercase">Objective (O):</strong>
                <p className="text-ink dark:text-zinc-200 mt-0.5">{data.soap?.objective}</p>
              </div>
              <div className="p-2 bg-paper dark:bg-white/5 rounded-lg">
                <strong className="text-caution font-mono text-[10px] uppercase">Assessment (A):</strong>
                <p className="text-ink dark:text-zinc-200 mt-0.5">{data.soap?.assessment}</p>
              </div>
              <div className="p-2 bg-paper dark:bg-white/5 rounded-lg">
                <strong className="text-caution font-mono text-[10px] uppercase">Plan (P):</strong>
                <p className="text-ink dark:text-zinc-200 mt-0.5">{data.soap?.plan}</p>
              </div>
            </div>
            <div className="text-[10px] text-ink-3 dark:text-zinc-400 pt-1 flex justify-between">
              <span>Note ID: {data.noteId}</span>
              <span>Author: {data.author || 'Dr. Evelyn Lin, MD'}</span>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Layout fillCanvas>
      <div 
        className="relative flex-1 flex flex-col h-full w-full overflow-hidden select-text font-sans animate-in fade-in bg-canvas"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 90% 70% at 50% 10%, var(--accent-wash) 0%, transparent 70%),
            linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 100%)
          `
        }}
      >
        {/* Analog Film Grain Texture Overlay (No Grid Lines) */}
        <div 
          className="pointer-events-none absolute inset-0 opacity-20 dark:opacity-25 mix-blend-overlay z-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grainFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grainFilter)' opacity='0.7'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat'
          }}
        />

        {/* Subtle Top Reset & Schedule Bar */}
        <div className="absolute top-3.5 right-6 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => submitCommand("What appointments do I have on my schedule today?")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-paper/70 dark:bg-[#1a1b20]/75 hover:bg-paper dark:hover:bg-[#22242a] text-ink dark:text-zinc-200 text-xs font-semibold rounded-full border border-rule/70 dark:border-white/10 backdrop-blur-xl transition-all cursor-pointer shadow-2xs"
          >
            <RefreshCw size={12} strokeWidth={1.5} aria-hidden="true" />
            <span className="hidden sm:inline">Today's Schedule</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMessages([
                {
                  id: `msg-${Date.now()}`,
                  role: 'assistant',
                  content: "Context reset. Proton EHR Copilot is ready for your next clinical instruction.",
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]);
            }}
            className="px-3 py-1.5 bg-paper/70 dark:bg-[#1a1b20]/75 hover:bg-paper dark:hover:bg-[#22242a] text-ink-2 dark:text-zinc-300 hover:text-ink text-xs font-medium rounded-full border border-rule/70 dark:border-white/10 backdrop-blur-xl transition-all cursor-pointer shadow-2xs"
            title="Reset conversation thread"
          >
            Reset
          </button>
        </div>

        {/* Message Thread Scroll Area with Continuous Left Timeline */}
        <div className="relative flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 pt-12 pb-4 max-w-[880px] mx-auto w-full no-scrollbar z-10">
          
          {/* Continuous Left Vertical Timeline Thread Line */}
          <div 
            className="absolute left-[30px] sm:left-[36px] top-12 bottom-6 w-[1.5px] bg-gradient-to-b from-white/20 via-white/10 to-transparent dark:from-white/15 dark:via-white/8 dark:to-transparent pointer-events-none"
            aria-hidden="true"
          />

          <div className="space-y-6">
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';

              if (isUser) {
                // User Message: Right-Aligned Pill with Left-Side Timestamp
                return (
                  <div key={m.id || idx} className="flex items-center justify-end gap-3 pl-14 sm:pl-16">
                    <span className="text-[11px] font-mono text-ink-3 dark:text-zinc-400 select-none">
                      {m.timestamp}
                    </span>
                    <div className="px-5 py-2.5 rounded-full bg-[#1e2026]/90 dark:bg-[#1c1d22]/95 border border-rule/80 dark:border-white/10 text-white font-medium text-[13.5px] shadow-sm backdrop-blur-xl">
                      {m.content}
                    </div>
                  </div>
                );
              }

              // Assistant Message: Anchored to Left Timeline with ChromaticLensOrb Node
              return (
                <div key={m.id || idx} className="relative flex items-start gap-3.5 sm:gap-4">
                  {/* Chromatic Lens Bokeh Orb Node centered directly on the timeline */}
                  <div className="z-10 mt-1 shrink-0">
                    <ChromaticLensOrb size={26} />
                  </div>

                  {/* Assistant Content Card */}
                  <div className="flex-1 min-w-0 p-5 rounded-[22px] bg-paper/85 dark:bg-[#131417]/90 backdrop-blur-2xl border border-rule/80 dark:border-white/[0.08] text-ink dark:text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,0.25)] space-y-3">
                    
                    {/* Header: Verified FHIR R4 Badge + Proton EHR Engine + Timestamp */}
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-rule/60 dark:border-white/8">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-semibold tracking-wide bg-paper-2 dark:bg-white/6 text-ink-2 dark:text-zinc-300 border border-rule/70 dark:border-white/10">
                          Physician Advisory · Verified FHIR R4
                        </span>
                        <span className="text-[11px] font-mono text-ink-3 dark:text-zinc-400 hidden sm:inline ml-1">
                          Proton EHR Engine
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-ink-3 dark:text-zinc-400 font-mono text-[11px]">
                        <span>{m.timestamp}</span>
                        <button
                          type="button"
                          onClick={() => copyResponse(m.content, idx)}
                          className="hover:text-ink dark:hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                          title="Copy text"
                          aria-label="Copy assistant response text"
                        >
                          {copiedIndex === idx ? (
                            <Check size={12} strokeWidth={1.5} className="text-settled" aria-hidden="true" />
                          ) : (
                            <Copy size={12} strokeWidth={1.5} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Formatted Text Message */}
                    <div className="font-sans leading-relaxed text-ink dark:text-zinc-200 text-[13.5px]">
                      {renderFormattedText(m.content)}
                    </div>

                    {/* Interactive EHR Action Cards */}
                    {m.cards && m.cards.length > 0 && (
                      <div className="pt-2 border-t border-rule/60 dark:border-white/8 space-y-2">
                        {m.cards.map((card, cIdx) => renderCard(card, cIdx))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking / Reasoning State (Directly on the Timeline matching Screenshot) */}
            {isSending && (
              <div className="relative flex items-start gap-3.5 sm:gap-4 pt-1">
                {/* Active Pulsing Chromatic Lens Orb Node */}
                <div className="z-10 mt-0.5 shrink-0">
                  <ChromaticLensOrb active size={26} />
                </div>

                <div className="flex-1 space-y-3 pt-0.5">
                  <div className="text-sm font-semibold text-ink dark:text-white tracking-tight flex items-center gap-2">
                    <span>Thinking...</span>
                  </div>

                  {/* Step 1: Retrieving clinic context */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-ink-3 dark:text-zinc-400">○</span>
                      <span className={`font-medium ${thinkingStep >= 0 ? 'text-ink dark:text-zinc-200' : 'text-ink-3 dark:text-zinc-500'}`}>
                        Retrieving clinic context...
                      </span>
                      {thinkingStep > 0 && <span className="text-settled font-bold text-[11px]">✓</span>}
                    </div>
                    {thinkingStep === 0 && (
                      <div className="pl-4 text-[11px] text-ink-3 dark:text-zinc-400 space-y-1">
                        <p>SL Mobbin, team of 12, interest in clinical records...</p>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-white/6 border border-white/10 font-mono">Memory Base</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-white/6 border border-white/10 font-mono">CRM / EHR</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Checking today's schedule */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-ink-3 dark:text-zinc-400">○</span>
                      <span className={`font-medium ${thinkingStep >= 1 ? 'text-ink dark:text-zinc-200' : 'text-ink-3 dark:text-zinc-500'}`}>
                        Checking today's schedule...
                      </span>
                      {thinkingStep > 1 && <span className="text-settled font-bold text-[11px]">✓</span>}
                    </div>
                  </div>

                  {/* Step 3: Consulting the patient records (Active Step) */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="relative flex h-2 w-2 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
                      </span>
                      <span className="font-semibold text-ink dark:text-white">
                        Consulting the patient records...
                      </span>
                    </div>
                    {thinkingStep >= 2 && (
                      <p className="pl-4 text-[11.5px] text-ink-3 dark:text-zinc-400 leading-relaxed max-w-[600px]">
                        Verifying clinical chart history, allergy contraindications, and active prescription queue. Ensuring deterministic interaction checks pass.
                      </p>
                    )}
                  </div>

                  {/* Step 4: Preparing a response */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-ink-3 dark:text-zinc-500">○</span>
                      <span className={`font-medium ${thinkingStep >= 3 ? 'text-ink dark:text-zinc-200' : 'text-ink-3 dark:text-zinc-500'}`}>
                        Preparing a response...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={endOfMessagesRef} />
          </div>
        </div>

        {/* Floating Quick Action Chips & Pure Glassmorphism Composer Bar */}
        <div className="shrink-0 px-4 sm:px-8 pb-6 pt-2 max-w-[840px] mx-auto w-full z-20">
          {error && (
            <div className="p-2.5 mb-2.5 text-xs text-critical bg-critical-wash/90 backdrop-blur-xl rounded-2xl border border-critical-line flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-[10px] underline ml-2 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Frosted Action Pills matching Screenshot */}
          <div className="py-1 mb-2.5 flex items-center justify-center sm:justify-start gap-2 overflow-x-auto no-scrollbar select-none" aria-label="Quick Clinical Actions">
            {quickCommands.slice(0, 4).map((cmd, i) => {
              const CmdIcon = cmd.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => submitCommand(cmd.prompt)}
                  disabled={isSending}
                  className="px-3.5 py-1.5 bg-[#18191c]/80 dark:bg-[#1a1b20]/80 hover:bg-[#24262c] text-ink dark:text-zinc-200 border border-rule/70 dark:border-white/10 hover:border-white/20 rounded-full text-xs font-medium whitespace-nowrap transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-2 backdrop-blur-xl"
                >
                  <CmdIcon size={12} strokeWidth={1.5} className="text-ink-3 dark:text-zinc-400 shrink-0" aria-hidden="true" />
                  <span>{cmd.label}</span>
                </button>
              );
            })}
          </div>

          {/* Pure Glassmorphic Input Capsule (Zero square focus outline) */}
          <div className="rounded-[28px] bg-paper/85 dark:bg-[#16171b]/90 backdrop-blur-2xl border border-rule/80 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.35)] p-3.5 sm:p-4 flex flex-col justify-between transition-all focus-within:border-accent/50 focus-within:shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask anything, explore together..."
              rows={2}
              style={{
                outline: 'none',
                border: 'none',
                boxShadow: 'none'
              }}
              aria-label="Natural language EHR command composer"
              className="w-full bg-transparent text-[15px] sm:text-[16px] text-ink dark:text-white placeholder:text-ink-3/70 dark:placeholder:text-zinc-500 border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none resize-none font-sans min-h-[46px] leading-relaxed antialiased"
            />

            {/* Bottom Row: Pill Badges on Left, Mic & Circular Send Button on Right */}
            <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-rule/40 dark:border-white/8">
              <div className="flex items-center gap-2">
                {/* DeepThink Glass Pill */}
                <button
                  type="button"
                  onClick={() => setIsDeepThink(p => !p)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-medium transition-all cursor-pointer select-none active:scale-95 ${
                    isDeepThink
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-paper-2/70 dark:bg-white/8 hover:bg-paper-2 dark:hover:bg-white/12 text-ink-2 dark:text-zinc-400 hover:text-ink border border-rule/60 dark:border-white/10'
                  }`}
                  title="Toggle DeepThink clinical reasoning"
                >
                  <Atom size={12} strokeWidth={1.5} />
                  <span>DeepThink</span>
                </button>

                {/* Search Glass Pill */}
                <button
                  type="button"
                  onClick={() => setIsSearch(p => !p)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-medium transition-all cursor-pointer select-none active:scale-95 ${
                    isSearch
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-paper-2/70 dark:bg-white/8 hover:bg-paper-2 dark:hover:bg-white/12 text-ink-2 dark:text-zinc-400 hover:text-ink border border-rule/60 dark:border-white/10'
                  }`}
                  title="Toggle medical database & knowledge search"
                >
                  <Globe size={12} strokeWidth={1.5} />
                  <span>Search</span>
                </button>
              </div>

              {/* Right Controls: Dictation Mic + Glassmorphism Send Circle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isListening
                      ? 'bg-critical text-white animate-pulse shadow-xs'
                      : 'text-ink-3 dark:text-zinc-400 hover:text-ink dark:hover:text-white hover:bg-paper-2/70 dark:hover:bg-white/10'
                  }`}
                  title={isListening ? 'Listening (Click to stop)' : 'Dictate with microphone'}
                >
                  {isListening ? <MicOff size={15} /> : <Mic size={15} strokeWidth={1.5} />}
                </button>

                {/* Circular Glass [ ↑ ] Send Button */}
                <button
                  type="button"
                  onClick={() => submitCommand()}
                  disabled={!draft.trim() || isSending}
                  className="w-9 h-9 rounded-full bg-accent hover:opacity-90 text-white flex items-center justify-center shadow-md border border-white/20 cursor-pointer transition-all active:scale-95 disabled:opacity-40 shrink-0"
                  title="Send message (Enter)"
                  aria-label="Execute command"
                >
                  {isSending ? (
                    <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowUp size={16} strokeWidth={2.5} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
