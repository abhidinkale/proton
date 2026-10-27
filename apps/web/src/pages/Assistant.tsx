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
        <header className="p-4 sm:p-5 bg-white border border-[#EAE8E3] rounded-2xl shadow-sm mb-4 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Sparkles size={15} />
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#111315]">
                  Clinical AI Assistant
                </h2>
              </div>
              <p className="text-xs text-[#6E767E] mt-0.5">
                Advisory diagnostic reasoning grounded in patient records • Clinician decision authoritative
              </p>
            </div>

            {/* Patient Context Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6E767E] font-medium hidden sm:inline">Active Patient:</span>
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="bg-[#F8F8F6] border border-[#EAE8E3] text-xs font-semibold text-[#111315] rounded-xl px-3 py-2 outline-none focus:border-[#111315] transition-colors cursor-pointer"
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
            <div className="p-3 bg-[#FAF9F6] border border-[#EAE8E3] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-[#50575F]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#111315]">{activePatient.name}</span>
                <span className="font-mono text-[#8C949D]">MRN: {activePatient.mrn}</span>
                {activePatient.allergies.length > 0 && (
                  <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-semibold text-[10px]">
                    Allergy: {activePatient.allergies.join(', ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>BP <strong className="text-[#111315]">{activePatient.vitals.bp}</strong></span>
                <span>HR <strong className="text-[#111315]">{activePatient.vitals.hr}</strong></span>
                <span>SpO2 <strong className="text-[#111315]">{activePatient.vitals.spo2}</strong></span>
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
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80 mt-1">
                    <Sparkles size={15} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed space-y-3 ${
                    isUser
                      ? 'bg-[#111315] text-white shadow-xs rounded-tr-xs'
                      : 'bg-white border border-[#EAE8E3] text-[#121417] shadow-2xs rounded-tl-xs'
                  }`}
                >
                  {!isUser && (
                    <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#F2F1EC]">
                      <div className="flex items-center gap-1.5">
                        <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
                        <span className="text-[10px] font-mono text-[#8C949D]">Advisory Model</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyResponse(m.content, idx)}
                        className="text-[#8C949D] hover:text-[#111315] p-1 rounded transition-colors"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === idx ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                    </div>
                  )}

                  {/* Message body */}
                  <div className="whitespace-pre-wrap font-sans">
                    {m.content}
                  </div>

                  {/* Context Citations & Advisory Footnote for Assistant replies */}
                  {!isUser && activePatient && (
                    <div className="pt-2 border-t border-[#F2F1EC] text-[11px] text-[#6E767E] space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[9px] uppercase text-[#8C949D]">Sources Cited:</span>
                        <span className="px-1.5 py-0.5 bg-[#FAF9F6] border border-[#EAE8E3] rounded text-[#50575F]">
                          FHIR R4 Patient Chart
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#FAF9F6] border border-[#EAE8E3] rounded text-[#50575F]">
                          Recent Labs (60d)
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#FAF9F6] border border-[#EAE8E3] rounded text-[#50575F]">
                          Active Medications
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50/70 px-2 py-1 rounded-lg">
                        <HelpCircle size={12} className="shrink-0 text-amber-700" />
                        <span>Clinical judgment advisory: Verify all suggested medication titrations against clinical vitals.</span>
                      </div>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-[#F4F3EE] text-[#111315] flex items-center justify-center shrink-0 border border-[#EAE8E3] mt-1 font-bold text-xs">
                    MD
                  </div>
                )}
              </div>
            );
          })}

          {isSending && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                <LoaderCircle size={15} className="animate-spin text-amber-600" />
              </div>
              <div className="bg-white border border-[#EAE8E3] rounded-2xl px-4 py-2.5 text-xs text-[#6E767E] flex items-center gap-2">
                <Sparkles size={13} className="text-amber-500 animate-pulse" />
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
              className="px-3 py-1.5 bg-white hover:bg-[#F4F3EE] text-[#50575F] hover:text-[#111315] border border-[#EAE8E3] rounded-xl text-xs font-medium whitespace-nowrap transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Composer Input Bar (Nolla style) */}
        <footer className="mt-2 shrink-0 bg-white border border-[#EAE8E3] rounded-3xl p-2.5 sm:p-3 shadow-md focus-within:border-[#111315] focus-within:ring-1 focus-within:ring-[#111315] transition-all">
          {error && (
            <div className="p-2 mb-2 text-xs text-rose-700 bg-rose-50 rounded-xl">
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
              className="w-full bg-transparent px-3 py-1.5 text-xs sm:text-sm text-[#111315] placeholder-[#949CA4] outline-hidden resize-none"
            />

            <div className="flex items-center justify-between pt-1 border-t border-[#F4F3EE]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigate('/document-review')}
                  className="px-3 py-1.5 rounded-xl bg-[#F8F8F6] hover:bg-[#EFECE6] text-[#50575F] hover:text-[#111315] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-[#EAE8E3]"
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
                      ? 'bg-rose-50 text-rose-600 animate-pulse ring-2 ring-rose-400' 
                      : 'text-[#6E767E] hover:text-[#111315] hover:bg-[#F8F8F6]'
                  }`}
                  title={isListening ? "Listening... Speak your clinical query" : "Click to dictate clinical query"}
                >
                  <Mic size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => submitMessage()}
                  disabled={!draft.trim() || isSending}
                  className="w-8 h-8 rounded-full bg-[#111315] hover:bg-[#272B30] text-white flex items-center justify-center shrink-0 transition-all shadow-xs cursor-pointer disabled:opacity-40"
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
