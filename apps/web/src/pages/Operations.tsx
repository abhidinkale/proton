import { useState, useEffect } from 'react';
import { 
  Inbox, 
  MessageSquareText, 
  Pill, 
  CalendarDays, 
  Share2, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Shield 
} from 'lucide-react';
import Layout from '../components/Layout';
import { operationsService } from '../services/operationsService';
import type { 
  OperationalTask, 
  OperationsSummary 
} from '../types/operations';
import { TriageInbox } from '../components/operations/TriageInbox';
import { RefillApprovalCard } from '../components/operations/RefillApprovalCard';
import { SchedulingQueue } from '../components/operations/SchedulingQueue';
import { ReferralPipeline } from '../components/operations/ReferralPipeline';
import { OperationsAuditLog } from '../components/operations/OperationsAuditLog';
import PracticeROIDashboard from '../components/operations/PracticeROIDashboard';
import AcuteImagingTriageWorklist from '../components/operations/AcuteImagingTriageWorklist';

type ActiveTab = 'all' | 'triage' | 'refill' | 'scheduling' | 'referral' | 'audit' | 'roi' | 'imaging_triage';

export default function Operations() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('all');
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [selectedTask, setSelectedTask] = useState<OperationalTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [devPersona, setDevPersona] = useState<string>(operationsService.getDevPersona());
  const isOffline = operationsService.isOffline();

  const handlePersonaChange = (newPersona: string) => {
    setDevPersona(newPersona);
    operationsService.setDevPersona(newPersona);
    loadOperationsData();
  };

  // Simulation modal
  const [simMessage, setSimMessage] = useState('');
  const [simPatientId, setSimPatientId] = useState('eleanor-vance');
  const [isSimulating, setIsSimulating] = useState(false);

  const loadOperationsData = async () => {
    setIsLoading(true);
    try {
      const [sum, taskList] = await Promise.all([
        operationsService.getSummary(),
        operationsService.getTasks()
      ]);
      setSummary(sum);
      setTasks(taskList);
      if (taskList.length > 0 && !selectedTask) {
        setSelectedTask(taskList[0]);
      } else if (selectedTask) {
        // Refresh selected task reference from list
        const updated = taskList.find(t => t.id === selectedTask.id);
        if (updated) setSelectedTask(updated);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOperationsData();
  }, []);

  const handleApproveTriage = async (editedResponse?: string) => {
    if (!selectedTask) return;
    try {
      const result = await operationsService.approveTask({
        taskId: selectedTask.id,
        doctor: 'Dr. Sarah Lin, MD',
        editedContent: editedResponse
      });
      if (result.success) {
        setActionSuccess('Clinical response approved and transmitted.');
        setTimeout(() => setActionSuccess(null), 4000);
        await loadOperationsData();
        setSelectedTask(result.task);
      }
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleApproveRefill = async (decision: {
    actionType: 'approve_standard' | 'modify_dosage' | 'deny_request';
    clinicalDecisionNotes: string;
    prescribedDose?: string;
    daysSupply?: number;
  }) => {
    if (!selectedTask) return;
    try {
      const result = await operationsService.approveTask({
        taskId: selectedTask.id,
        doctor: 'Dr. Sarah Lin, MD',
        physicianDecision: decision
      });
      if (result.success) {
        setActionSuccess('Physician refill order signed and committed to FHIR.');
        setTimeout(() => setActionSuccess(null), 4000);
        await loadOperationsData();
        setSelectedTask(result.task);
      }
    } catch (err: any) {
      alert(`Refill sign-off error: ${err.message}`);
    }
  };

  const handleConfirmAppointment = async () => {
    if (!selectedTask) return;
    try {
      const result = await operationsService.confirmAppointmentBooking(selectedTask.id, 'Dr. Sarah Lin, MD');
      if (result.success) {
        setActionSuccess('Appointment confirmed and booked in calendar.');
        setTimeout(() => setActionSuccess(null), 4000);
        await loadOperationsData();
        if (result.task) setSelectedTask(result.task);
      }
    } catch (err: any) {
      alert(`Booking error: ${err.message}`);
    }
  };

  const handleApproveReferral = async () => {
    if (!selectedTask) return;
    try {
      const result = await operationsService.approveTask({
        taskId: selectedTask.id,
        doctor: 'Dr. Sarah Lin, MD'
      });
      if (result.success) {
        setActionSuccess('Specialist referral packet signed and transmitted.');
        setTimeout(() => setActionSuccess(null), 4000);
        await loadOperationsData();
        setSelectedTask(result.task);
      }
    } catch (err: any) {
      alert(`Referral error: ${err.message}`);
    }
  };

  const handleRejectTask = async (reason?: string) => {
    if (!selectedTask) return;
    try {
      const result = await operationsService.rejectTask(selectedTask.id, reason);
      if (result.success) {
        setActionSuccess('Task marked as rejected.');
        setTimeout(() => setActionSuccess(null), 4000);
        await loadOperationsData();
        setSelectedTask(result.task);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSimulateMessage = async (customText?: string) => {
    const textToSim = customText || simMessage;
    if (!textToSim.trim()) return;
    setIsSimulating(true);
    try {
      const context = simPatientId === 'eleanor-vance' 
        ? {
            name: 'Eleanor Vance',
            ageSex: '68F',
            medications: ['Lisinopril 20mg daily', 'Metformin 1000mg BID'],
            baselineBp: '146/88 mmHg',
            conditions: ['Essential Hypertension', 'Type 2 Diabetes']
          }
        : {
            name: 'Arthur Pendelton',
            ageSex: '74M',
            medications: ['Apixaban 5mg BID', 'Metoprolol 50mg daily'],
            baselineBp: '138/84 mmHg',
            conditions: ['Atrial Fibrillation', 'CKD Stage 3a']
          };

      const result = await operationsService.submitInboundTriage({
        patientId: simPatientId,
        message: textToSim,
        channel: 'portal',
        patientContext: context
      });

      if (result.success) {
        setSimMessage('');
        await loadOperationsData();
        setSelectedTask(result.task);
        setActiveTab('triage');
      }
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetCohort = () => {
    const resetList = operationsService.resetToSyntheticCohort();
    setTasks(resetList);
    setSelectedTask(resetList[0]);
    operationsService.getSummary().then(setSummary);
    setActionSuccess('Operational queue reset to canonical synthetic cohort.');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'all') return true;
    if (activeTab === 'audit') return true;
    return t.category === activeTab;
  });

  return (
    <Layout>
      <div className="flex flex-col h-full bg-[#fafaf9] overflow-hidden text-zinc-900">
        
        {/* Offline Synthetic Mode Banner */}
        {isOffline && (
          <div className="bg-amber-100 border-b border-amber-300 px-6 py-1.5 flex items-center justify-between text-xs text-amber-950 font-medium shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-700 shrink-0" />
              <span>
                <strong>[OFFLINE SYNTHETIC MODE - SIMULATED EXECUTION ONLY - NOT REAL CLINICAL TRANSMISSION]</strong>: Operational backend is detached. Actions take effect in local synthetic memory.
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase font-bold text-amber-800">Local Sandbox</span>
          </div>
        )}

        {/* Top Operational Bar */}
        <div className="px-6 py-4 bg-white border-b border-zinc-200 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                <Inbox size={17} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-zinc-900 leading-none">
                    Operations Command Center
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Proton Operations OS v1.4
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                    Store: SQLite (WAL)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
                    FHIR Mode: in_memory_stub
                  </span>
                  {/* Development Persona Selector (Isolated synthetic dev mode only) */}
                  <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-900 text-[10px] font-mono">
                    <span className="font-semibold uppercase tracking-wider text-[9px] text-purple-600">Dev Persona:</span>
                    <select
                      value={devPersona}
                      onChange={(e) => handlePersonaChange(e.target.value)}
                      className="bg-transparent border-none text-purple-900 font-semibold focus:outline-hidden cursor-pointer"
                    >
                      <option value="physician-lin">Dr. Sarah Lin (Physician)</option>
                      <option value="ops-staff-marcus">Marcus Vance (Ops Staff)</option>
                      <option value="external-physician">Dr. External (Org Mismatch)</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Autonomous Triage • Care Gaps & Scheduling • Governed Refill Authority • HL7 FHIR R4
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {actionSuccess && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 animate-fade-in">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>{actionSuccess}</span>
                </div>
              )}
              <button
                onClick={handleResetCohort}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-zinc-600 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors cursor-pointer"
                title="Reset queue to canonical synthetic cohort"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                <span>Reset Cohort</span>
              </button>
            </div>
          </div>

          {/* Metric Summary Ribbon */}
          <div className="grid grid-cols-5 gap-3 mt-4">
            <button
              onClick={() => setActiveTab('triage')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                activeTab === 'triage'
                  ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400/20'
                  : 'bg-zinc-50/60 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center justify-between text-zinc-500 text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <MessageSquareText size={13} className="text-blue-600" />
                  Inbound Triage
                </span>
                <span className="font-mono text-xs font-semibold text-zinc-900">
                  {summary?.pendingTriageCount ?? 0}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 truncate">
                Clinical & Administrative Inquiries
              </div>
            </button>

            <button
              onClick={() => setActiveTab('refill')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                activeTab === 'refill'
                  ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/20'
                  : 'bg-zinc-50/60 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center justify-between text-zinc-500 text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <Pill size={13} className="text-amber-600" />
                  Refill Authorizations
                </span>
                <span className="font-mono text-xs font-semibold text-zinc-900">
                  {summary?.urgentRefillCount ?? 0}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 truncate">
                Physician Authority Required
              </div>
            </button>

            <button
              onClick={() => setActiveTab('scheduling')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                activeTab === 'scheduling'
                  ? 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-400/20'
                  : 'bg-zinc-50/60 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center justify-between text-zinc-500 text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={13} className="text-purple-600" />
                  Care Gaps & Follow-Up
                </span>
                <span className="font-mono text-xs font-semibold text-zinc-900">
                  {summary?.schedulingCareGapCount ?? 0}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 truncate">
                Versioned ADA Guidelines
              </div>
            </button>

            <button
              onClick={() => setActiveTab('referral')}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                activeTab === 'referral'
                  ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400/20'
                  : 'bg-zinc-50/60 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center justify-between text-zinc-500 text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <Share2 size={13} className="text-indigo-600" />
                  Specialist Referrals
                </span>
                <span className="font-mono text-xs font-semibold text-zinc-900">
                  {summary?.openReferralCount ?? 0}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 truncate">
                ServiceRequest Loop Closure
              </div>
            </button>

            <div className="p-2.5 rounded-lg border bg-zinc-50/60 border-zinc-200 text-left">
              <div className="flex items-center justify-between text-zinc-500 text-[11px] font-medium">
                <span className="flex items-center gap-1.5">
                  <Shield size={13} className="text-emerald-600" />
                  Safety Invariant
                </span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                  ENFORCED
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 truncate">
                No Autonomous Prescribing
              </div>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="flex items-center gap-1 mt-4 border-b border-zinc-200/80 -mb-4">
            {[
              { id: 'all', label: 'All Operations Queue', count: tasks.length },
              { id: 'triage', label: 'Patient Triage (Agent 1)', count: summary?.pendingTriageCount },
              { id: 'refill', label: 'Refill Approvals (Agent 3)', count: summary?.urgentRefillCount },
              { id: 'scheduling', label: 'Scheduling & Recalls (Agent 2)', count: summary?.schedulingCareGapCount },
              { id: 'referral', label: 'Specialist Referrals (Agent 3)', count: summary?.openReferralCount },
              { id: 'audit', label: 'Authoritative Audit Log' },
              { id: 'roi', label: 'Practice ROI Scorecard (4.1×)', count: 'ROI' },
              { id: 'imaging_triage', label: 'STAT Acute Imaging Triage', count: 'STAT' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-zinc-900 text-zinc-900 font-semibold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === tab.id ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {typeof tab.count === 'string' && (
                  <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${
                    tab.id === 'imaging_triage' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-emerald-950 text-emerald-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Split Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: Task Feed */}
          {activeTab !== 'audit' && activeTab !== 'roi' && activeTab !== 'imaging_triage' && (
            <div className="w-96 border-r border-zinc-200 bg-white flex flex-col shrink-0">
              <div className="p-3 border-b border-zinc-200/80 flex items-center justify-between bg-zinc-50/50">
                <span className="text-xs font-semibold text-zinc-700">
                  Active Items ({filteredTasks.length})
                </span>
                <span className="text-[10px] text-zinc-400">
                  Sorted by clinical priority
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 text-xs">
                    No active operational items in this queue.
                  </div>
                ) : (
                  filteredTasks.map(task => {
                    const isSelected = selectedTask?.id === task.id;
                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`w-full p-3.5 text-left transition-colors cursor-pointer flex flex-col gap-1.5 ${
                          isSelected ? 'bg-zinc-100/90' : 'hover:bg-zinc-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-zinc-900 truncate">
                            {task.patientName} <span className="text-zinc-400 font-normal text-[11px]">({task.patientAgeSex})</span>
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {task.priority === 'urgent' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                                Urgent
                              </span>
                            )}
                            {task.priority === 'emergency' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-100 text-red-800 animate-pulse">
                                Emergency
                              </span>
                            )}
                            {task.reconciliationStatus === 'reconciled' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                                RECONCILED
                              </span>
                            )}
                            {task.reconciliationStatus === 'failed' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300">
                                RECONCILE FAILED
                              </span>
                            )}
                            {task.reconciliationStatus === 'pending' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                PENDING RECONCILIATION
                              </span>
                            )}
                            <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold tracking-tight ${
                              task.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700'
                                : task.status === 'rejected'
                                ? 'bg-rose-50 text-rose-700'
                                : task.status === 'reconciliation_failed'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-zinc-100 text-zinc-700'
                            }`}>
                              {task.status}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs font-medium text-zinc-800 line-clamp-1">
                          {task.title}
                        </div>

                        <div className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                          {task.summary}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                          <span className="flex items-center gap-1">
                            {task.category === 'triage' && <MessageSquareText size={11} className="text-blue-500" />}
                            {task.category === 'refill' && <Pill size={11} className="text-amber-500" />}
                            {task.category === 'scheduling' && <CalendarDays size={11} className="text-purple-500" />}
                            {task.category === 'referral' && <Share2 size={11} className="text-indigo-500" />}
                            <span className="capitalize">{task.category}</span>
                          </span>
                          <span>{task.sourceEvent}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Inbound Simulator Bar */}
              <div className="p-3 border-t border-zinc-200 bg-zinc-50/70">
                <div className="text-[11px] font-semibold text-zinc-700 mb-1.5 flex items-center justify-between">
                  <span>Synthetic Inbound Simulation</span>
                  <span className="text-[10px] text-zinc-400 font-normal">Test agent gates</span>
                </div>
                <div className="mb-2">
                  <select
                    value={simPatientId}
                    onChange={(e) => setSimPatientId(e.target.value)}
                    className="w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 text-zinc-700"
                  >
                    <option value="eleanor-vance">Eleanor Vance (68F)</option>
                    <option value="arthur-pendelton">Arthur Pendelton (74M)</option>
                  </select>
                </div>
                <div className="flex gap-1.5 mb-1.5">
                  <button
                    disabled={isSimulating}
                    onClick={() => handleSimulateMessage("Hello, my home BP was 152/94 this morning and I felt dizzy when standing up. Should I stop my Lisinopril?")}
                    className="px-2 py-1 rounded text-[10px] bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 cursor-pointer flex-1 truncate disabled:opacity-50"
                    title="Simulate Eleanor Vance BP spike inquiry"
                  >
                    {isSimulating ? 'Evaluating...' : 'BP Spike (Eleanor)'}
                  </button>
                  <button
                    disabled={isSimulating}
                    onClick={() => handleSimulateMessage("I have crushing chest pain radiating to my left arm and jaw")}
                    className="px-2 py-1 rounded text-[10px] bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 cursor-pointer flex-1 truncate disabled:opacity-50"
                    title="Simulate 911 Emergency Red Flag"
                  >
                    911 Chest Pain
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Right: Task Detail & Action Workspace */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#FAF9F5]">
            {activeTab === 'imaging_triage' ? (
              <div className="max-w-6xl mx-auto">
                <AcuteImagingTriageWorklist />
              </div>
            ) : activeTab === 'roi' ? (
              <div className="max-w-5xl mx-auto">
                <PracticeROIDashboard />
              </div>
            ) : activeTab === 'audit' ? (
              <div className="max-w-4xl mx-auto">
                <OperationsAuditLog />
              </div>
            ) : !selectedTask ? (
              <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
                Select an operational task from the feed to review details and take action.
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-5">
                
                {/* Task Header */}
                <div className="p-5 rounded-xl bg-white border border-zinc-200/80 shadow-xs flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        selectedTask.category === 'triage' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        selectedTask.category === 'refill' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        selectedTask.category === 'scheduling' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {selectedTask.category} agent task
                      </span>
                      <span className="text-xs text-zinc-400">•</span>
                      <span className="text-xs text-zinc-500 font-mono">ID: {selectedTask.id}</span>
                    </div>

                    <h2 className="text-lg font-bold text-zinc-900 leading-snug">
                      {selectedTask.title}
                    </h2>

                    <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3">
                      <span>Patient: <strong>{selectedTask.patientName}</strong> ({selectedTask.patientAgeSex})</span>
                      <span>•</span>
                      <span>Received: {new Date(selectedTask.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span>Source: {selectedTask.sourceEvent}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedTask.status === 'requested' || selectedTask.status === 'ready' ? (
                      <button
                        onClick={() => handleRejectTask('Clinical discretion')}
                        className="px-3 py-1.5 rounded-md text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        Signed & Committed to FHIR R4
                      </span>
                    )}
                  </div>
                </div>

                {/* MODULAR COMPONENT DISPATCH PER CATEGORY */}
                {selectedTask.category === 'triage' && (
                  <TriageInbox
                    task={selectedTask}
                    onApprove={handleApproveTriage}
                    onReject={() => handleRejectTask('Clinical discretion')}
                  />
                )}

                {selectedTask.category === 'refill' && (
                  <RefillApprovalCard
                    task={selectedTask}
                    onApprove={handleApproveRefill}
                    onReject={handleRejectTask}
                  />
                )}

                {selectedTask.category === 'scheduling' && (
                  <SchedulingQueue
                    task={selectedTask}
                    onConfirmBooking={handleConfirmAppointment}
                  />
                )}

                {selectedTask.category === 'referral' && (
                  <ReferralPipeline
                    task={selectedTask}
                    onApprove={handleApproveReferral}
                  />
                )}

              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}
