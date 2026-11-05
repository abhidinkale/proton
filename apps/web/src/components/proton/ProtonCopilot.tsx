import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bot,
  ChevronDown,
  X,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  ShieldCheck,
  Activity,
  AlertTriangle,
  RefreshCw,
  ArrowUp,
  Atom,
  Globe,
  Mic
} from 'lucide-react';
import { sendEhrCopilotCommand } from '../../services/ai';
import { TODAY_CLINIC_SCHEDULE } from '../../data/clinicSchedule';
import ProvenanceBadge from '../ui/ProvenanceBadge';

interface CopilotChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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
  const [messages, setMessages] = useState<CopilotChatMessage[]>([
    {
      role: 'assistant',
      content: 'Proton EHR Copilot active. Powered by clinical reasoning. You can control appointments, prescriptions, patient charts, and documentation via natural chat.'
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isDeepThink, setIsDeepThink] = useState(true);
  const [isSearch, setIsSearch] = useState(true);
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

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputVal).trim();
    if (!textToSend || isLoading) return;

    const nextMessages: CopilotChatMessage[] = [...messages, { role: 'user', content: textToSend }];
    setMessages(nextMessages);
    if (!customText) setInputVal('');
    setIsLoading(true);

    try {
      const history = nextMessages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const response = await sendEhrCopilotCommand(textToSend, history);
      setMessages([...nextMessages, { role: 'assistant', content: response.message }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: 'Notice: EHR Copilot command could not be completed. Please check network connection.'
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
          className="group flex h-9 w-9 items-center justify-center rounded-[7px] border border-rule-strong bg-solid text-on-solid transition-colors hover:bg-solid cursor-pointer"
          title="Open Proton Copilot (⌥A)"
          aria-label="Open Proton Copilot"
        >
          <Bot size={14} className="text-on-solid0" />
        </button>
      </div>
    );
  }

  // Floating or Docked Panel
  const isDocked = mode === 'docked';

  return (
    <aside
      className={`fixed z-40 bg-paper/85 dark:bg-[#18191c]/90 text-ink flex flex-col transition-all duration-300 shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop-blur-2xl ${
        isDocked
          ? 'top-0 right-0 h-screen w-96 border-l border-rule'
          : 'bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] h-[580px] max-h-[82vh] rounded-[28px] border border-rule/80 dark:border-white/12 overflow-hidden'
      }`}
      style={{
        backgroundImage: `
          radial-gradient(ellipse 85% 55% at 50% 15%, var(--accent-wash) 0%, transparent 70%),
          radial-gradient(circle, currentColor 0.65px, transparent 0.65px)
        `,
        backgroundSize: '100% 100%, 22px 22px'
      }}
      aria-label="Proton Clinical Copilot"
    >
      {/* Copilot Header */}
      <div className="h-14 px-4 bg-paper-2/70 border-b border-rule/70 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-paper text-ink flex items-center justify-center shrink-0 border border-rule shadow-2xs">
            <Bot size={14} className="text-accent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-ink tracking-tight truncate">Clinical Copilot</h3>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-paper text-ink-2 border border-rule shrink-0">
                FHIR R4
              </span>
            </div>
            <p className="text-[10px] text-ink-3 truncate">
              {activePatient.name} ({activePatient.age}y, {activePatient.gender.charAt(0).toUpperCase()})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Dock / Undock Button */}
          <button
            type="button"
            onClick={() => setCopilotMode(isDocked ? 'floating' : 'docked')}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
            title={isDocked ? 'Float Copilot' : 'Dock to Right Panel'}
          >
            {isDocked ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Minimize Button */}
          <button
            type="button"
            onClick={() => setCopilotMode('minimized')}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
            title="Minimize Copilot (⌥A)"
          >
            <ChevronDown size={14} />
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => setCopilotMode('hidden')}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
            title="Hide Copilot"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Patient Context Strip */}
      <div className="px-4 py-2 bg-paper/60 border-b border-rule/60 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-2 truncate">
          <Activity size={12} className="text-settled shrink-0" />
          <span className="text-ink-3 font-mono text-[10px]">MRN: {activePatient.mrn}</span>
          <span className="text-ink font-semibold truncate">{activePatient.vitals.bp}</span>
        </div>
        {activePatient.allergies.length > 0 && (
          <span className="text-[10px] font-semibold text-critical bg-critical-wash border border-critical-line px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            <AlertTriangle size={10} />
            {activePatient.allergies[0]}
          </span>
        )}
      </div>

      {/* Quick Prompts Carousel */}
      <div className="px-3 py-2 bg-paper/40 border-b border-rule/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {[
          'Summarize chart',
          'Drug interactions',
          'Lab trends',
          'Draft follow-up'
        ].map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSend(prompt)}
            className="text-[10px] font-medium text-ink-2 hover:text-ink bg-paper/80 hover:bg-paper px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer shrink-0 border border-rule/60 shadow-2xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 font-sans text-xs no-scrollbar">
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
                    ? 'bg-accent-wash text-ink font-medium rounded-tr-xs shadow-2xs'
                    : 'bg-paper text-ink border border-rule shadow-xs rounded-tl-xs'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-rule/60">
                    <div className="flex items-center gap-1">
                      <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
                      <span className="text-[9px] font-mono text-ink-3">Advisory</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyMessage(m.content, idx)}
                      className="text-ink-3 hover:text-ink transition-colors cursor-pointer"
                      title="Copy response"
                    >
                      {copiedIndex === idx ? (
                        <Check size={11} className="text-settled" />
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
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-paper border border-rule shadow-xs max-w-[80%]">
            <RefreshCw size={12} className="animate-spin text-accent" />
            <span className="text-[11px] text-ink-2">Synthesizing FHIR chart context...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Safety Notice Strip */}
      <div className="px-3.5 py-1.5 bg-paper/60 border-t border-rule/60 flex items-center justify-between text-[10px] text-ink-3 shrink-0 font-mono">
        <span className="flex items-center gap-1 text-settled font-sans font-medium">
          <ShieldCheck size={11} />
          Safety guardrails active
        </span>
        <span>Advisory only</span>
      </div>

      {/* Signature Floating AI Glassmorphism Input Card */}
      <div className="p-3 bg-paper/70 dark:bg-[#18191c]/70 border-t border-rule/70 dark:border-white/10 backdrop-blur-xl shrink-0">
        <div className="rounded-[22px] bg-paper/85 dark:bg-[#1f2024]/85 border border-rule/80 dark:border-white/12 shadow-[0_12px_32px_rgba(0,0,0,0.12)] p-3 flex flex-col gap-2 transition-all focus-within:border-accent/40">
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything, explore together"
            style={{
              outline: 'none',
              border: 'none',
              boxShadow: 'none'
            }}
            className="w-full bg-transparent px-1 py-0.5 text-xs text-ink placeholder:text-ink-3/60 border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none"
          />

          <div className="flex items-center justify-between pt-1 border-t border-rule/40 dark:border-white/8">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsDeepThink(p => !p)}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium transition-all cursor-pointer select-none active:scale-95 ${
                  isDeepThink
                    ? 'bg-accent text-white shadow-xs'
                    : 'bg-paper-2/70 dark:bg-white/8 hover:bg-paper-2 text-ink-2 hover:text-ink border border-rule/60 dark:border-white/10'
                }`}
                title="Toggle DeepThink clinical reasoning"
              >
                <Atom size={11} strokeWidth={1.5} />
                <span>DeepThink</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSearch(p => !p)}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium transition-all cursor-pointer select-none active:scale-95 ${
                  isSearch
                    ? 'bg-accent text-white shadow-xs'
                    : 'bg-paper-2/70 dark:bg-white/8 hover:bg-paper-2 text-ink-2 hover:text-ink border border-rule/60 dark:border-white/10'
                }`}
                title="Toggle medical knowledge search"
              >
                <Globe size={11} strokeWidth={1.5} />
                <span>Search</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="w-6 h-6 rounded-full flex items-center justify-center text-ink-3 hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
                title="Dictate with microphone"
              >
                <Mic size={13} strokeWidth={1.5} />
              </button>

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputVal.trim() || isLoading}
                className="w-7 h-7 rounded-full bg-accent hover:opacity-90 text-white flex items-center justify-center shadow-xs border border-white/20 cursor-pointer transition-all active:scale-95 disabled:opacity-40 shrink-0"
                title="Send message"
              >
                <ArrowUp size={13} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
