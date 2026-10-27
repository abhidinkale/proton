import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles,
  ChevronDown,
  X,
  Send,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  ShieldCheck,
  Activity,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { sendClinicalChat, type ChatMessage } from '../../services/ai';
import { TODAY_CLINIC_SCHEDULE } from '../../data/clinicSchedule';
import ProvenanceBadge from '../ui/ProvenanceBadge';

export type CopilotMode = 'minimized' | 'floating' | 'docked' | 'hidden';

interface ProtonCopilotProps {
  onModeChange?: (mode: CopilotMode) => void;
  initialMode?: CopilotMode;
}

export default function ProtonCopilot({
  onModeChange,
  initialMode = 'minimized'
}: ProtonCopilotProps) {
  const location = useLocation();
  const [mode, setMode] = useState<CopilotMode>(initialMode);
  const [activePatientId, setActivePatientId] = useState<string>('demo-scenario-b-eleanor');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Proton Copilot initialized. Grounded in patient FHIR records and clinical guideline rag. Advisory only — physician sign-off required.'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-detect patient context from URL search params or path
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pParam = params.get('patient');
    if (pParam) {
      const match = TODAY_CLINIC_SCHEDULE.find(p => p.id === pParam || p.id.includes(pParam));
      if (match) {
        setActivePatientId(match.id);
      }
    }
  }, [location]);

  // Global keyboard shortcut: Option+A (⌥A) to toggle Copilot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent | any) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA')) {
        e.preventDefault();
        setMode(prev => {
          const next = prev === 'minimized' ? 'floating' : 'minimized';
          onModeChange?.(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onModeChange]);

  const activePatient = TODAY_CLINIC_SCHEDULE.find(p => p.id === activePatientId) || TODAY_CLINIC_SCHEDULE[0];

  const chartContext = activePatient
    ? `Patient: ${activePatient.name}, ${activePatient.age}${activePatient.gender.charAt(0).toUpperCase()}, MRN: ${activePatient.mrn}. Chief Complaint: ${activePatient.chiefComplaint}. Vitals: BP ${activePatient.vitals.bp}, HR ${activePatient.vitals.hr}, SpO2 ${activePatient.vitals.spo2}. Allergies: ${activePatient.allergies.join(', ') || 'NKDA'}. Conditions: ${activePatient.conditions.join(', ')}. Current Meds: ${activePatient.medications.join(', ')}.`
    : undefined;

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputVal).trim();
    if (!textToSend || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(nextMessages);
    if (!customText) setInputVal('');
    setIsLoading(true);

    try {
      const response = await sendClinicalChat(nextMessages.slice(-10), chartContext);
      setMessages([...nextMessages, { role: 'assistant', content: response }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: 'Notice: Advisory service encountered an error or network timeout. Clinical deterministic safety checks remain active.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const setCopilotMode = (newMode: CopilotMode) => {
    setMode(newMode);
    onModeChange?.(newMode);
  };

  const copyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (mode === 'hidden') {
    return null;
  }

  // Minimized Pill in bottom right
  if (mode === 'minimized') {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setCopilotMode('floating')}
          className="group flex h-9 w-9 items-center justify-center rounded-[7px] border border-[#2A2D33] bg-[#14161A] text-[#FBF9F3] transition-colors hover:bg-[#23262C] cursor-pointer"
          title="Open Proton Copilot (⌥A)"
          aria-label="Open Proton Copilot"
        >
          <Sparkles size={13} className="text-[#C9C3B4] transition-transform group-hover:rotate-12" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#7FB07A] ring-2 ring-[#F7F4EC]" />
        </button>
      </div>
    );
  }

  // Floating or Docked Panel
  const isDocked = mode === 'docked';

  return (
    <aside
      className={`fixed z-40 bg-[#151619] text-[#E0E2E7] flex flex-col transition-all duration-300 shadow-2xl ${
        isDocked
          ? 'top-0 right-0 h-screen w-96 border-l border-[#23252B]'
          : 'bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] h-[560px] max-h-[82vh] rounded-3xl border border-[#2B2E35] overflow-hidden'
      }`}
      aria-label="Proton AI Clinical Copilot"
    >
      {/* Copilot Header */}
      <div className="h-16 px-4 bg-[#1B1D22] border-b border-[#252830] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-[#FCE7F3] text-[#9D174D] flex items-center justify-center shrink-0">
            <Sparkles size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-white tracking-tight truncate">Proton Copilot</h3>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                FHIR R4
              </span>
            </div>
            <p className="text-[10px] text-[#88909A] truncate">
              {activePatient.name} ({activePatient.age}y, {activePatient.gender.charAt(0).toUpperCase()})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Dock / Undock Button */}
          <button
            type="button"
            onClick={() => setCopilotMode(isDocked ? 'floating' : 'docked')}
            className="p-1.5 rounded-lg text-[#88909A] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isDocked ? 'Float Copilot' : 'Dock to Right Panel'}
          >
            {isDocked ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Minimize Button */}
          <button
            type="button"
            onClick={() => setCopilotMode('minimized')}
            className="p-1.5 rounded-lg text-[#88909A] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Minimize Copilot (⌥A)"
          >
            <ChevronDown size={14} />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => setCopilotMode('hidden')}
            className="p-1.5 rounded-lg text-[#88909A] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Hide Copilot"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Patient Context Strip */}
      <div className="px-4 py-2 bg-[#121316] border-b border-[#202227] flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-2 truncate">
          <Activity size={12} className="text-emerald-400 shrink-0" />
          <span className="text-[#88909A] font-mono text-[10px]">MRN: {activePatient.mrn}</span>
          <span className="text-white font-semibold truncate">{activePatient.vitals.bp}</span>
        </div>
        {activePatient.allergies.length > 0 && (
          <span className="text-[10px] font-semibold text-rose-300 bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            <AlertTriangle size={10} />
            {activePatient.allergies[0]}
          </span>
        )}
      </div>

      {/* Quick Prompts Carousel */}
      <div className="px-3 py-2 bg-[#16181D] border-b border-[#23252B] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {[
          'Summarize patient chart',
          'Check drug interactions',
          'Evaluate lab trends',
          'Draft clinical follow-up'
        ].map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSend(prompt)}
            className="text-[10px] font-medium text-[#A0A5AD] hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer shrink-0 border border-white/5"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 font-sans text-xs">
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={idx}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div
                className={`max-w-[90%] p-3 rounded-2xl leading-relaxed select-text ${
                  isUser
                    ? 'bg-[#FCE7F3] text-[#151619] font-medium rounded-tr-xs'
                    : 'bg-[#202228] text-[#E0E2E7] border border-[#2D313A] rounded-tl-xs'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
                    <div className="flex items-center gap-1">
                      <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
                      <span className="text-[9px] font-mono text-[#88909A]">Advisory</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyMessage(m.content, idx)}
                      className="text-[#88909A] hover:text-white transition-colors cursor-pointer"
                      title="Copy response"
                    >
                      {copiedIndex === idx ? (
                        <Check size={11} className="text-emerald-400" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#202228] border border-[#2D313A] max-w-[80%]">
            <RefreshCw size={12} className="animate-spin text-[#FCE7F3]" />
            <span className="text-[11px] text-[#A0A5AD]">Synthesizing FHIR chart context...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Safety Notice Strip */}
      <div className="px-3 py-1.5 bg-[#121316] border-t border-[#202227] flex items-center justify-between text-[10px] text-[#88909A] shrink-0 font-mono">
        <span className="flex items-center gap-1 text-emerald-400 font-sans">
          <ShieldCheck size={11} />
          Safety guardrails active
        </span>
        <span>Advisory only</span>
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-[#1B1D22] border-t border-[#252830] flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask copilot about this patient... (Enter)"
          className="flex-1 bg-[#121316] border border-[#2C3038] rounded-full px-3.5 py-2 text-xs text-white placeholder-[#717682] outline-none focus:border-[#FCE7F3] transition-colors"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!inputVal.trim() || isLoading}
          className="w-8 h-8 rounded-full bg-[#FCE7F3] text-[#9D174D] flex items-center justify-center disabled:opacity-40 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
          title="Send message"
        >
          <Send size={13} />
        </button>
      </div>
    </aside>
  );
}
