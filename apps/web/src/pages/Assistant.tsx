import { useRef, useState, useEffect, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowUp, LoaderCircle, Sparkles, Copy, Check, HelpCircle, Camera, Mic
} from 'lucide-react';
import { sendClinicalChat, type ChatMessage } from '../services/ai';
import Layout from '../components/Layout';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';
import type { DoctorDeskPatient } from '../components/DoctorDeskEncounter';
import ProvenanceBadge from '../components/ui/ProvenanceBadge';

export default function Assistant() {
  const navigate = useNavigate();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('demo-scenario-b-eleanor');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const toggleDictation = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      setTimeout(() => {
        setDraft(prev => prev ? `${prev} What is the recommended glycemic target and metformin dose titration?` : "What is the recommended glycemic target and metformin dose titration?");
        setIsListening(false);
      }, 1800);
    }
  };

  const activePatient: DoctorDeskPatient | undefined = TODAY_CLINIC_SCHEDULE.find(
    p => p.id === selectedPatientId
  );

  const chartContext = activePatient ? `
Patient: ${activePatient.name}, ${activePatient.age}${activePatient.gender.charAt(0).toUpperCase()}, DOB: ${activePatient.dob}, MRN: ${activePatient.mrn}
Chief Complaint: ${activePatient.chiefComplaint}
Vitals: BP ${activePatient.vitals.bp}, HR ${activePatient.vitals.hr}, SpO2 ${activePatient.vitals.spo2}, BMI ${activePatient.vitals.bmi}
Allergies: ${activePatient.allergies.join(', ') || 'No known allergies'}
Active Conditions: ${activePatient.conditions.join(', ')}
Current Medications: ${activePatient.medications.join(', ')}
Recent Labs: ${activePatient.recentLabs.map(l => `${l.name}: ${l.value} (${l.status})`).join('; ')}
`.trim() : undefined;

  // Set initial greeting when patient changes
  useEffect(() => {
    if (activePatient) {
      setMessages([
        {
          role: 'assistant',
          content: `Hello Doctor. I have ${activePatient.name}'s longitudinal chart loaded (${activePatient.age}y ${activePatient.gender}, ${activePatient.conditions.join(', ')}). All responses are advisory and grounded in the patient's FHIR record. How may I assist your clinical reasoning today?`
        }
      ]);
    } else {
      setMessages([
        {
          role: 'assistant',
          content: `Hello Doctor. General medical reference mode is active. You can ask clinical pharmacology, diagnostic, or guideline questions.`
        }
      ]);
    }
  }, [selectedPatientId]);

  const submitMessage = async (customPrompt?: string) => {
    const content = (customPrompt || draft).trim();
    if (!content || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    if (!customPrompt) setDraft('');
    setError('');
    setIsSending(true);

    try {
      const reply = await sendClinicalChat(nextMessages.slice(-12), chartContext);
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
      requestAnimationFrame(() => endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Clinical chat is unavailable. Please try again.');
      setMessages(messages);
      if (!customPrompt) setDraft(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  };

  const copyResponse = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const quickPrompts = [
    "Summarize this patient's recent history.",
    "What changed since the last visit?",
    "Which medications could be contributing to this?",
    "Show me the evidence for this suggestion."
  ];

  return (
    <Layout fillCanvas>
      <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col font-sans animate-in fade-in">
        
        {/* Top Header & Patient Context Selector */}
        <header className="p-4 sm:p-5 bg-paper border border-rule rounded-2xl shadow-sm mb-4 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-caution-wash text-caution flex items-center justify-center">
                  <Sparkles size={15} />
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">
                  Clinical AI Assistant
                </h2>
              </div>
              <p className="text-xs text-ink-2 mt-0.5">
                Advisory diagnostic reasoning grounded in patient records • Clinician decision authoritative
              </p>
            </div>

            {/* Patient Context Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-2 font-medium hidden sm:inline">Active Patient:</span>
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="bg-paper-2 border border-rule text-xs font-semibold text-ink rounded-xl px-3 py-2 outline-none focus:border-solid transition-colors cursor-pointer"
              >
                {TODAY_CLINIC_SCHEDULE.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.age}y {p.gender.charAt(0)}, {p.conditions[0]?.split(' ')[0] || 'Clinic'})
                  </option>
                ))}
                <option value="none">General Reference Mode (No Patient)</option>
              </select>
            </div>
          </div>

          {/* Active Patient Vitals & Allergy Strip */}
          {activePatient && (
            <div className="p-3 bg-canvas border border-rule rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-ink-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">{activePatient.name}</span>
                <span className="font-mono text-ink-3">MRN: {activePatient.mrn}</span>
                {activePatient.allergies.length > 0 && (
                  <span className="px-2 py-0.5 bg-critical-wash text-critical border border-critical-line rounded font-semibold text-[10px]">
                    Allergy: {activePatient.allergies.join(', ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>BP <strong className="text-ink">{activePatient.vitals.bp}</strong></span>
                <span>HR <strong className="text-ink">{activePatient.vitals.hr}</strong></span>
                <span>SpO2 <strong className="text-ink">{activePatient.vitals.spo2}</strong></span>
              </div>
            </div>
          )}
        </header>

        {/* Message Thread Scroll Area */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';

            return (
              <div
                key={idx}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-caution-wash text-caution flex items-center justify-center shrink-0 border border-caution-line/80 mt-1">
                    <Sparkles size={15} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed space-y-3 ${
                    isUser
                      ? 'bg-solid text-white shadow-xs rounded-tr-xs'
                      : 'bg-paper border border-rule text-ink shadow-2xs rounded-tl-xs'
                  }`}
                >
                  {!isUser && (
                    <div className="flex items-center justify-between gap-3 pb-2 border-b border-rule">
                      <div className="flex items-center gap-1.5">
                        <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
                        <span className="text-[10px] font-mono text-ink-3">Advisory Model</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyResponse(m.content, idx)}
                        className="text-ink-3 hover:text-ink p-1 rounded transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === idx ? <Check size={13} className="text-settled" /> : <Copy size={13} />}
                      </button>
                    </div>
                  )}

                  {/* Message body */}
                  <div className="whitespace-pre-wrap font-sans">
                    {m.content}
                  </div>

                  {/* Context Citations & Advisory Footnote for Assistant replies */}
                  {!isUser && activePatient && (
                    <div className="pt-2 border-t border-rule text-[11px] text-ink-2 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[9px] uppercase text-ink-3">Sources Cited:</span>
                        <span className="px-1.5 py-0.5 bg-canvas border border-rule rounded text-ink-2">
                          FHIR R4 Patient Chart
                        </span>
                        <span className="px-1.5 py-0.5 bg-canvas border border-rule rounded text-ink-2">
                          Recent Labs (60d)
                        </span>
                        <span className="px-1.5 py-0.5 bg-canvas border border-rule rounded text-ink-2">
                          Active Medications
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-caution bg-caution-wash/70 px-2 py-1 rounded-lg">
                        <HelpCircle size={12} className="shrink-0 text-caution" />
                        <span>Clinical judgment advisory: Verify all suggested medication titrations against clinical vitals.</span>
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-paper-2 text-ink flex items-center justify-center shrink-0 border border-rule mt-1 font-bold text-xs">
                    MD
                  </div>
                )}
              </div>
            );
          })}

          {isSending && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-caution-wash text-caution flex items-center justify-center shrink-0 border border-caution-line">
                <LoaderCircle size={15} className="animate-spin text-caution" />
              </div>
              <div className="bg-paper border border-rule rounded-2xl px-4 py-2.5 text-xs text-ink-2 flex items-center gap-2">
                <Sparkles size={13} className="text-caution-on-solid0 animate-pulse" />
                <span>Synthesizing chart intelligence...</span>
              </div>
            </div>
          )}

          <div ref={endOfMessagesRef} />
        </div>

        {/* Quick Question Chips */}
        <div className="py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => submitMessage(prompt)}
              disabled={isSending}
              className="px-3 py-1.5 bg-paper hover:bg-paper-2 text-ink-2 hover:text-ink border border-rule rounded-xl text-xs font-medium whitespace-nowrap transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Composer Input Bar (Nolla style) */}
        <footer className="mt-2 shrink-0 bg-paper border border-rule rounded-3xl p-2.5 sm:p-3 shadow-md focus-within:border-solid focus-within:ring-1 focus-within:ring-solid transition-all">
          {error && (
            <div className="p-2 mb-2 text-xs text-critical bg-critical-wash rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={activePatient ? `Ask about ${activePatient.name}'s trajectory, interactions, or evidence...` : "I have a question about this case..."}
              rows={2}
              className="w-full bg-transparent px-3 py-1.5 text-xs sm:text-sm text-ink placeholder-ink-3 outline-hidden resize-none"
            />

            <div className="flex items-center justify-between pt-1 border-t border-rule">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigate('/document-review')}
                  className="px-3 py-1.5 rounded-xl bg-paper-2 hover:bg-paper-2 text-ink-2 hover:text-ink text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-rule"
                >
                  <Camera size={13} />
                  <span>Analyze Image</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleDictation}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    isListening 
                      ? 'bg-critical-wash text-critical animate-pulse ring-2 ring-critical' 
                      : 'text-ink-2 hover:text-ink hover:bg-paper-2'
                  }`}
                  title={isListening ? "Listening... Speak your clinical query" : "Click to dictate clinical query"}
                >
                  <Mic size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => submitMessage()}
                  disabled={!draft.trim() || isSending}
                  className="w-8 h-8 rounded-full bg-solid hover:bg-solid text-white flex items-center justify-center shrink-0 transition-all shadow-xs cursor-pointer disabled:opacity-40"
                  title="Send message (Enter)"
                >
                  {isSending ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowUp size={15} strokeWidth={2.5} />}
                </button>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </Layout>
  );
}
