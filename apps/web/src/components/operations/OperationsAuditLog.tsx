import React, { useEffect, useState } from 'react';
import { Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { operationsService } from '../../services/operationsService';

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  patientId: string;
  summary: string;
}

export const OperationsAuditLog: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOffline = operationsService.isOffline();

  const loadAudit = async () => {
    setIsLoading(true);
    try {
      const data = await operationsService.getAuditEvents(50);
      setEvents(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-white border border-zinc-200/80 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-900">
              Authoritative Operational Audit Trail
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              IMMUTABLE SERVER-SIDE LOG
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Cryptographically sealed records of all AI generations, physician directives, state transitions, and FHIR commits.
          </p>
        </div>

        <button
          onClick={loadAudit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-600 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors cursor-pointer"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {isOffline && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-600 shrink-0" />
          <span>
            <strong>Offline Synthetic Mode Active:</strong> Authoritative audit records are exclusively minted on the secure backend during validated state transitions.
          </span>
        </div>
      )}

      <div className="bg-white border border-zinc-200/80 rounded-xl shadow-xs divide-y divide-zinc-100 overflow-hidden">
        {events.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-xs">
            {isLoading ? 'Loading authoritative audit events...' : 'No operational audit events recorded yet.'}
          </div>
        ) : (
          events.map((evt) => (
            <div key={evt.id} className="p-3.5 text-xs flex items-start justify-between gap-4 hover:bg-zinc-50/50">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0 mt-0.5">
                  <Shield size={14} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 font-mono text-[11px] uppercase tracking-wide">
                      {evt.action}
                    </span>
                    <span className="text-zinc-400">•</span>
                    <span className="text-zinc-600 font-medium">Actor: <strong>{evt.actor}</strong></span>
                    <span className="text-zinc-400">•</span>
                    <span className="text-zinc-500 font-mono text-[10px]">Patient: {evt.patientId}</span>
                  </div>
                  <div className="text-zinc-700 mt-1 leading-relaxed">
                    {evt.summary}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-zinc-400 font-mono shrink-0">
                {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
