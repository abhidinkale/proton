import { useState, type FormEvent } from 'react';
import { 
  Clock, AlertTriangle, CheckCircle2, 
  ArrowRight, Search, Activity, Sparkles, 
  ChevronRight, X, UserPlus, Stethoscope, HeartPulse
} from 'lucide-react';
import type { DoctorDeskPatient } from './DoctorDeskEncounter';

interface DoctorDeskHomeProps {
  patients: DoctorDeskPatient[];
  completedPatientIds: string[];
  onOpenPatientEncounter: (patient: DoctorDeskPatient) => void;
  onAddNewPatient?: (patient: DoctorDeskPatient) => void;
}

export default function DoctorDeskHome({
  patients,
  completedPatientIds,
  onOpenPatientEncounter,
  onAddNewPatient
}: DoctorDeskHomeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'waiting' | 'completed'>('all');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);

  // New patient modal form state
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('48');
  const [newGender, setNewGender] = useState('Female');
  const [newComplaint, setNewComplaint] = useState('');

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.chiefComplaint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isCompleted = completedPatientIds.includes(p.id);
    if (filter === 'completed') return matchesSearch && isCompleted;
    if (filter === 'waiting') return matchesSearch && !isCompleted;
    return matchesSearch;
  });

  const waitingCount = patients.filter(p => !completedPatientIds.includes(p.id)).length;
  const completedCount = completedPatientIds.length;
  const nextUpPatient = patients.find(p => !completedPatientIds.includes(p.id));

  const handleCreateWalkIn = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newComplaint.trim()) return;

    const newPt: DoctorDeskPatient = {
      id: `walkin-${Date.now()}`,
      name: newName.trim(),
      age: parseInt(newAge, 10) || 48,
      gender: newGender,
      dob: '1978-06-20',
      mrn: `WI-${Math.floor(10000 + Math.random() * 90000)}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      chiefComplaint: newComplaint.trim(),
      vitals: {
        bp: '122/80 mmHg',
        hr: '72 bpm',
        spo2: '99%',
        temp: '98.6°F',
        bmi: '24.2'
      },
      allergies: [],
      conditions: ['Acute Walk-In Evaluation'],
      medications: ['None reported'],
      recentLabs: [
        { name: 'Random Glucose', value: '104 mg/dL', status: 'normal', date: 'Today' }
      ],
      documents: []
    };

    if (onAddNewPatient) {
      onAddNewPatient(newPt);
    }
    setIsAddPatientOpen(false);
    setNewName('');
    setNewComplaint('');
    onOpenPatientEncounter(newPt);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="w-full min-h-screen bg-[#fafaf9] text-zinc-900 p-6 lg:p-10 font-sans antialiased">
      <div className="max-w-5xl mx-auto space-y-7">
        
        {/* CLINIC TOP HERO & OVERVIEW */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-5 border-b border-zinc-200/80 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Dr. Physician Desk • Outpatient Clinic
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span className="text-xs font-medium text-zinc-500">
                Wednesday, Oct 15 • Shift Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">
              Today's Patient Schedule
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500">
              Ambient clinical scribe active • AI clinical copilot pre-loaded with chart context
            </p>
          </div>

          {/* CLINIC METRICS STRIP */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 bg-white border border-zinc-200/80 rounded-xl px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="text-xs font-medium text-zinc-500">Total:</span>
              <span className="text-xs font-bold text-zinc-900 tabular-nums">{patients.length}</span>
              <span className="text-zinc-300 mx-1">|</span>
              <span className="text-xs font-medium text-amber-600">Waiting:</span>
              <span className="text-xs font-bold text-amber-600 tabular-nums">{waitingCount}</span>
              <span className="text-zinc-300 mx-1">|</span>
              <span className="text-xs font-medium text-emerald-600">Signed:</span>
              <span className="text-xs font-bold text-emerald-600 tabular-nums">{completedCount}</span>
            </div>

            <button
              onClick={() => setIsAddPatientOpen(true)}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus size={14} />
              <span>Add Walk-In</span>
            </button>
          </div>
        </header>

        {/* ACTIVE EXAM ROOM SPOTLIGHT (Only shown if a patient is actively waiting/ready) */}
        {nextUpPatient && (
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)] relative overflow-hidden transition-all hover:border-zinc-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              
              <div className="flex items-start gap-4">
                {/* Avatar with Initials */}
                <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center shrink-0 font-bold text-sm text-zinc-800">
                  {getInitials(nextUpPatient.name)}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ready in Exam Room 2
                    </span>
                    <h2 className="text-base font-bold text-zinc-900">{nextUpPatient.name}</h2>
                    <span className="text-xs text-zinc-500 font-mono">
                      ({nextUpPatient.age}y • {nextUpPatient.gender})
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      MRN: {nextUpPatient.mrn}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600">
                    <strong className="text-zinc-900 font-medium">Chief Complaint:</strong> {nextUpPatient.chiefComplaint}
                  </p>

                  {/* Vitals Strip */}
                  <div className="flex items-center gap-3 pt-1 flex-wrap text-[11px] text-zinc-500">
                    <span className="inline-flex items-center gap-1 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md">
                      <HeartPulse size={12} className="text-rose-500" />
                      <span>BP <strong className="text-zinc-800 font-mono">{nextUpPatient.vitals.bp}</strong></span>
                    </span>
                    <span className="inline-flex items-center gap-1 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md">
                      <span>HR <strong className="text-zinc-800 font-mono">{nextUpPatient.vitals.hr}</strong></span>
                    </span>
                    <span className="inline-flex items-center gap-1 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md">
                      <span>SpO2 <strong className="text-zinc-800 font-mono">{nextUpPatient.vitals.spo2}</strong></span>
                    </span>

                    {nextUpPatient.allergies.length > 0 && (
                      <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 font-semibold px-2 py-0.5 rounded-md">
                        <AlertTriangle size={11} />
                        Allergy: {nextUpPatient.allergies.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => onOpenPatientEncounter(nextUpPatient)}
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer self-start md:self-center shrink-0"
              >
                <Stethoscope size={14} />
                <span>Enter Consultation Desk</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* FILTER & SEARCH TOOLBAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search patients, complaints, MRN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-zinc-200/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
            />
          </div>

          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200/80">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              All Appointments ({patients.length})
            </button>
            <button
              onClick={() => setFilter('waiting')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === 'waiting'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Waiting Room ({waitingCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === 'completed'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              Signed Off ({completedCount})
            </button>
          </div>
        </div>

        {/* APPOINTMENT SCHEDULE LIST */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 px-1 font-medium">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-semibold text-zinc-400">
              <Clock size={12} />
              Chronological Patient Queue
            </span>
            <span className="text-[11px] text-zinc-400">Select any record to launch clinical desk</span>
          </div>

          <div className="space-y-2.5">
            {filteredPatients.map((patient, index) => {
              const isCompleted = completedPatientIds.includes(patient.id);
              const isEleanor = patient.id === 'demo-eleanor-vance' || patient.name.includes('Eleanor');

              return (
                <div
                  key={patient.id}
                  onClick={() => onOpenPatientEncounter(patient)}
                  className={`group rounded-xl border transition-all cursor-pointer p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)] ${
                    isCompleted
                      ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-300'
                      : isEleanor
                      ? 'border-zinc-300 ring-1 ring-zinc-200 hover:border-zinc-400'
                      : 'border-zinc-200/80 hover:border-zinc-300'
                  }`}
                >
                  {/* LEFT: TIME & PATIENT IDENTIFIERS */}
                  <div className="flex items-start gap-3.5">
                    {/* Time Pill */}
                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-zinc-50 border border-zinc-200/80 shrink-0 text-center">
                      <span className="text-xs font-bold text-zinc-900 tabular-nums">{patient.time}</span>
                      <span className="text-[10px] text-zinc-400 font-medium">#{index + 1}</span>
                    </div>

                    {/* Patient Details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors">
                          {patient.name}
                        </h3>
                        <span className="text-xs text-zinc-500 font-mono">
                          ({patient.age}y • {patient.gender})
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          MRN: {patient.mrn}
                        </span>

                        {/* Status Badges */}
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} />
                            Encounter Signed
                          </span>
                        ) : isEleanor ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            In Room 2
                          </span>
                        ) : (
                          <span className="bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-medium px-2 py-0.5 rounded-full">
                            Waiting in Lobby
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-600">
                        <strong className="text-zinc-500 font-normal">Reason:</strong> {patient.chiefComplaint}
                      </p>

                      {/* CLINICAL BADGES */}
                      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        {patient.allergies.length > 0 && (
                          <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium px-2 py-0.5 rounded-md">
                            <AlertTriangle size={11} />
                            Allergy: {patient.allergies.join(', ')}
                          </span>
                        )}

                        {patient.recentLabs.some(l => l.status === 'high') && (
                          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded-md">
                            <Activity size={11} />
                            HbA1c 8.2% ↑
                          </span>
                        )}

                        <span className="text-[11px] text-zinc-400">
                          {patient.conditions.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: ACTION BUTTON */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPatientEncounter(patient);
                      }}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                        isCompleted
                          ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200'
                          : isEleanor
                          ? 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs'
                          : 'bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200/90 shadow-2xs'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <span>Review Signed Note</span>
                          <ChevronRight size={13} />
                        </>
                      ) : (
                        <>
                          <span>Open Chart & Desk</span>
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CLINICAL WORKFLOW FOOTER */}
        <div className="rounded-xl border border-zinc-200/80 bg-white p-4 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <Sparkles size={16} className="text-zinc-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-zinc-500">
            <strong className="text-zinc-800 font-semibold mr-1">
              Physician Workflow:
            </strong>
            Launch any patient encounter to access split-screen clinical documentation. Real-time ambient audio is transcribed and synthesized into standard SOAP notes, while the docked AI copilot checks drug interactions and lab alerts against the patient's active FHIR record.
          </div>
        </div>
      </div>

      {/* ADD WALK-IN MODAL */}
      {isAddPatientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-zinc-900" />
                <h3 className="text-sm font-semibold text-zinc-900">Add Walk-In Patient</h3>
              </div>
              <button 
                onClick={() => setIsAddPatientOpen(false)} 
                className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-1 rounded-lg hover:bg-zinc-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateWalkIn} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Patient Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Hayes"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Age</label>
                  <input
                    type="number"
                    value={newAge}
                    onChange={e => setNewAge(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Biological Sex</label>
                  <select
                    value={newGender}
                    onChange={e => setNewGender(e.target.value)}
                    className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Chief Concern / Reason for Visit</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Acute sore throat with fever x 2 days, difficulty swallowing."
                  value={newComplaint}
                  onChange={e => setNewComplaint(e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs text-zinc-900 outline-none focus:border-zinc-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddPatientOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-xs cursor-pointer"
                >
                  Add & Start Encounter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
