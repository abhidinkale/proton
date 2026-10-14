import { useRef, useState, useEffect, type KeyboardEvent } from 'react';
import { ArrowUp, LoaderCircle, Sparkles, Copy, Check } from 'lucide-react';
import { sendClinicalChat, type ChatMessage } from '../services/ai';
import Layout from '../components/Layout';
import { TODAY_CLINIC_SCHEDULE } from '../data/clinicSchedule';
import type { DoctorDeskPatient } from '../components/DoctorDeskEncounter';

export default function Assistant() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('demo-eleanor-vance');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

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
          content: `Hello Doctor. I have ${activePatient.name}'s chart loaded (${activePatient.age}${activePatient.gender.charAt(0)}, ${activePatient.conditions.join(', ')}). How can I assist with this patient?`
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

  return (
    <Layout fillCanvas>
      <section className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col px-4 py-6 font-sans">
        {/* HEADER & PATIENT CONTEXT SELECTOR */}
        <header className="border-b border-[#222d3d] pb-5 shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#38bdf8]" />
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Clinical AI Copilot
                </h1>
              </div>
              <p className="text-xs text-[#8ea3b7] mt-0.5">
                Executive medical assistant powered by Gemini & patient chart reasoning
              </p>
            </div>

            {/* PATIENT CONTEXT SELECTOR */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748b] font-medium">Chart Context:</span>
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="bg-[#141b26] border border-[#2b3a4e] text-xs font-semibold text-white rounded-xl px-3 py-2 outline-none focus:border-[#38bdf8] transition-colors cursor-pointer"
              >
                {TODAY_CLINIC_SCHEDULE.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.age}y, {p.conditions[0]?.split(' ')[0] || 'Clinic'})
                  </option>
                ))}
                <option value="none">None (General Clinical Query)</option>
              </select>
            </div>
          </div>

          {/* ACTIVE PATIENT CHART BANNER */}
          {activePatient && (
            <div className="rounded-2xl border border-[#1f2d3f] bg-[#121924] p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{activePatient.name}</span>
                  <span className="text-[#8ea3b7] font-mono">({activePatient.age}y, {activePatient.gender})</span>
                  <span className="text-[#64748b] font-mono">MRN: {activePatient.mrn}</span>
                  {activePatient.allergies.length > 0 && (
                    <span className="bg-[#451215] text-[#ff8088] border border-[#7d2025] px-2 py-0.5 rounded-md font-semibold text-[10px]">
                      Allergy: {activePatient.allergies.join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-[#8ea3b7] flex items-center gap-2 flex-wrap">
                  <span>BP <strong className="text-white">{activePatient.vitals.bp}</strong></span>
                  <span>•</span>
                  <span>HR <strong className="text-white">{activePatient.vitals.hr}</strong></span>
                  <span>•</span>
                  <span>Conditions: <span className="text-[#cbd5e1]">{activePatient.conditions.join(', ')}</span></span>
                </div>
              </div>

              {/* QUICK PROMPTS FOR THIS PATIENT */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => submitMessage("Are there any drug interactions with current medications?")}
                  className="bg-[#182332] hover:bg-[#223145] text-[#93c5fd] text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#27384f] transition-colors cursor-pointer"
                >
                  💊 Interactions
                </button>
                <button
                  type="button"
                  onClick={() => submitMessage(`Summarize ${activePatient.name}'s metabolic and organ lab trends.`)}
                  className="bg-[#182332] hover:bg-[#223145] text-[#93c5fd] text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#27384f] transition-colors cursor-pointer"
                >
                  📈 Lab Trends
                </button>
                <button
                  type="button"
                  onClick={() => submitMessage(`What are recommended next treatment steps based on clinical guidelines?`)}
                  className="bg-[#182332] hover:bg-[#223145] text-[#93c5fd] text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#27384f] transition-colors cursor-pointer"
                >
                  🎯 Next Steps
                </button>
              </div>
            </div>
          )}
        </header>

        {/* CHAT MESSAGES CONTAINER */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-5 pr-1" aria-live="polite">
          {messages.map((message, index) => (
            <article
              key={`${index}-${message.role}`}
              className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div className="mb-1 text-[11px] font-medium text-[#64748b]">
                {message.role === 'user' ? 'You (Physician)' : 'Clinical Copilot'}
              </div>
              <div
                className={`whitespace-pre-wrap rounded-2xl p-4 text-xs leading-relaxed max-w-[92%] shadow-sm ${
                  message.role === 'user'
                    ? 'bg-[#0284c7] text-white'
                    : 'border border-[#222d3d] bg-[#141b26] text-[#e2e8f0]'
                }`}
              >
                {message.content}
              </div>

              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mt-1.5 ml-1">
                  <button
                    type="button"
                    onClick={() => copyResponse(message.content, index)}
                    className="flex items-center gap-1 text-[11px] text-[#8ea3b7] hover:text-white font-medium cursor-pointer"
                  >
                    {copiedIndex === index ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </article>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-[#8ea3b7] pl-1 font-medium" role="status">
              <LoaderCircle size={14} className="animate-spin text-[#38bdf8]" />
              <span>Analyzing patient chart & synthesis...</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 p-3 rounded-xl" role="alert">
              {error}
            </p>
          )}

          <div ref={endOfMessagesRef} />
        </div>

        {/* COMPOSER FORM */}
        <form onSubmit={e => { e.preventDefault(); void submitMessage(); }} className="border-t border-[#222d3d] pt-4 shrink-0">
          <label htmlFor="clinical-chat-input" className="sr-only">Message the clinical assistant</label>
          <div className="flex items-end gap-3 rounded-2xl border border-[#2b3a4e] bg-[#141b26] p-2.5 focus-within:border-[#38bdf8] shadow-md transition-colors">
            <textarea
              id="clinical-chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              maxLength={4000}
              rows={2}
              placeholder={activePatient ? `Ask about ${activePatient.name}'s care, lab trends, or therapy...` : "Ask a medical or pharmacological question..."}
              className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2.5 py-1 text-xs text-white outline-none placeholder:text-[#64748b]"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer shadow-sm"
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#64748b]">Press Enter to send · Shift+Enter for new line · AI responses should be verified against clinical judgment</p>
        </form>
      </section>
    </Layout>
  );
}
