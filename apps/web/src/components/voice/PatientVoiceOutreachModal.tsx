import { useState } from 'react';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2, 
  User, 
  Send
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/api';

interface PatientVoiceOutreachModalProps {
  patient: {
    id: string;
    name: string;
    phone?: string;
  };
  onClose: () => void;
}

export default function PatientVoiceOutreachModal({
  patient,
  onClose
}: PatientVoiceOutreachModalProps) {
  const [protocolId, setProtocolId] = useState('CHRONIC_GLYCEMIC_CHECKIN');
  const [activeCall, setActiveCall] = useState<any>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [patientInput, setPatientInput] = useState('');
  const [sendingTurn, setSendingTurn] = useState(false);

  const startCall = async () => {
    setIsCalling(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/voice/outreach/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          patientName: patient.name,
          patientPhone: patient.phone || '+1 (555) 234-8901',
          protocolId
        })
      });
      if (res.ok) {
        const session = await res.json();
        setActiveCall(session);
      }
    } catch (err) {
      console.error('Failed to start outreach call:', err);
    } finally {
      setIsCalling(false);
    }
  };

  const handleSendSpeech = async (customText?: string) => {
    const textToSend = customText || patientInput;
    if (!textToSend.trim() || !activeCall) return;

    setSendingTurn(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/voice/outreach/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: activeCall.callId,
          userSpeech: textToSend
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveCall(data.sessionState);
        setPatientInput('');
      }
    } catch (err) {
      console.error('Failed to send turn:', err);
    } finally {
      setSendingTurn(false);
    }
  };

  const endCall = async () => {
    if (!activeCall) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/voice/outreach/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCall.callId })
      });
      if (res.ok) {
        const finalSession = await res.json();
        setActiveCall(finalSession);
      }
    } catch (err) {
      console.error('Failed to complete call:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <PhoneCall size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Autonomous Patient Voice Outreach
                <span className="bg-indigo-950 border border-indigo-800 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Constitutional Safety Guarded
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Non-diagnostic care coordinator agent for {patient.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!activeCall ? (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  Select Clinical Outreach Protocol
                </span>

                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { id: 'CHRONIC_GLYCEMIC_CHECKIN', name: 'Type 2 Diabetes Glycemic & Fasting Sugar Check', desc: 'Queries morning fasting glucose, hypoglycemia symptoms, and medication tolerance.' },
                    { id: 'HYPERTENSION_TITRATION_MONITOR', name: 'Hypertension Titration & Home BP Log', desc: 'Captures home BP cuff readings, checks for lightheadedness or orthostasis.' },
                    { id: 'POST_DISCHARGE_SAFETY', name: '48-Hour Post-Discharge Recovery Evaluation', desc: 'Assesses pain management, wound care, red-flag symptoms, and refill needs.' }
                  ].map(proto => (
                    <div
                      key={proto.id}
                      onClick={() => setProtocolId(proto.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        protocolId === proto.id
                          ? 'bg-indigo-950/40 border-indigo-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-xs font-semibold">{proto.name}</strong>
                        {protocolId === proto.id && <CheckCircle2 size={14} className="text-indigo-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{proto.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Constitutional Invariants Notice */}
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <ShieldCheck size={16} />
                  <span>Constitutional AI Safety Invariants (Non-Diagnostic Patient Outreach)</span>
                </div>
                <ul className="text-[11px] text-slate-300 list-disc list-inside space-y-0.5">
                  <li>Strictly refuses to make clinical diagnoses or answer diagnostic inquiries over the phone.</li>
                  <li>Strictly refuses autonomous medication titration or prescribing changes.</li>
                  <li>Immediate red-flag diversion (911 referral) for acute cardiac, stroke, or respiratory symptoms.</li>
                </ul>
              </div>

              <div className="pt-2">
                <button
                  onClick={startCall}
                  disabled={isCalling}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-indigo-950"
                >
                  <Phone size={15} />
                  <span>{isCalling ? 'Connecting Cellular Voice Gateway...' : `Place Outbound Call to ${patient.name}`}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Call Status Bar */}
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${activeCall.status === 'IN_PROGRESS' ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  <span className="text-xs font-semibold text-white font-mono">
                    {activeCall.status === 'IN_PROGRESS' ? 'LIVE AUDIO OUTREACH' : activeCall.status}
                  </span>
                  <span className="text-[11px] text-slate-400">({activeCall.protocolName})</span>
                </div>

                {activeCall.status === 'IN_PROGRESS' && (
                  <button
                    onClick={endCall}
                    className="flex items-center gap-1.5 bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <PhoneOff size={13} />
                    <span>End Call</span>
                  </button>
                )}
              </div>

              {/* Emergency Banner if Diverted */}
              {activeCall.status === 'EMERGENCY_DIVERTED' && (
                <div className="p-3.5 bg-red-950/80 border border-red-700 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-bold">EMERGENCY RED FLAG DIVERTED</strong>
                    <span>Patient reported critical acute symptoms. Immediate 911 instruction dispatched and attending physician priority alert generated.</span>
                  </div>
                </div>
              )}

              {/* Live Transcript Stream */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                {activeCall.turns?.map((turn: any, idx: number) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl text-xs ${
                      turn.speaker === 'AGENT'
                        ? 'bg-slate-900 border border-slate-800 text-indigo-200 ml-4'
                        : 'bg-slate-800/80 border border-slate-700/80 text-white mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-bold uppercase tracking-wider">{turn.speaker === 'AGENT' ? 'Proton AI Assistant' : patient.name}</span>
                      <span>{new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <p className="leading-relaxed">{turn.text}</p>
                  </div>
                ))}
              </div>

              {/* Captured Observations Card */}
              {activeCall.capturedObservations?.length > 0 && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Captured Clinical Data (Pending Attending Physician Review)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeCall.capturedObservations.map((obs: any, idx: number) => (
                      <span key={idx} className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs px-2.5 py-1 rounded-md font-mono">
                        {obs.type}: <strong>{obs.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Patient Response Simulation Bar */}
              {activeCall.status === 'IN_PROGRESS' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <User size={12} />
                    <span>Quick Patient Response Simulation:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSendSpeech("My morning fasting sugar was 154 mg/dL today.")}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      "Fasting sugar was 154"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendSpeech("I have been having bad chest pain walking upstairs.")}
                      className="text-xs bg-red-950/60 hover:bg-red-900/60 text-red-300 px-2.5 py-1 rounded-lg border border-red-800/60 transition-colors cursor-pointer"
                    >
                      ⚠️ Test Chest Pain (Emergency)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendSpeech("Can you diagnose if I have diabetic neuropathy?")}
                      className="text-xs bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-800/60 transition-colors cursor-pointer"
                    >
                      🛡️ Test Diagnosis Refusal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendSpeech("I feel fine, no side effects.")}
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      "Feeling fine, no issues"
                    </button>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={patientInput}
                      onChange={(e) => setPatientInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendSpeech(); }}
                      placeholder="Type simulated patient speech or vitals..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendSpeech()}
                      disabled={sendingTurn || !patientInput.trim()}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send size={13} />
                      <span>Speak</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Proton Autonomous Voice Agent &bull; Compliant with FTC & HIPAA Communication Rules
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
