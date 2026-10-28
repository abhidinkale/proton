import React from 'react';
import { Link } from 'react-router-dom';
import { Inbox, ArrowUpRight, MessageSquareText, Pill, CalendarDays, Share2 } from 'lucide-react';
import type { OperationsSummary } from '../../types/operations';

interface Props {
  summary: OperationsSummary;
  isOffline?: boolean;
}

export const OperationsSummaryCard: React.FC<Props> = ({ summary, isOffline }) => {
  return (
    <div className="bg-paper border border-rule-strong rounded-lg p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent-ink">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-clinical text-xs font-semibold uppercase text-accent-ink">
                // OPERATIONS COMMAND QUEUE
              </span>
              <span className="font-mono-clinical text-[11px] px-2 py-0.5 bg-caution-wash text-caution border border-caution-line rounded font-medium">
                {summary.totalActiveTasks} ACTIONS AWAITING ATTENTION
              </span>
              {isOffline && (
                <span className="font-mono-clinical text-[10px] px-1.5 py-0.5 bg-paper-2 text-ink-2 rounded">
                  OFFLINE SYNTHETIC
                </span>
              )}
            </div>
            <p className="text-xs text-ink-2 mt-0.5">
              Eleanor Vance (Urgent BP Triage & Nephrology Referral Packet) • Arthur Pendelton (DOAC Refill Safety Intercept & Recall)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/operations"
            className="px-3.5 py-2 bg-accent text-white rounded text-xs font-mono-clinical font-semibold hover:bg-accent transition flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <span>Manage Operations OS</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-rule">
        <div className="flex items-center gap-2 text-xs">
          <MessageSquareText className="w-3.5 h-3.5 text-accent-ink" />
          <span className="text-ink-2">Triage:</span>
          <span className="font-mono-clinical font-semibold text-ink">{summary.pendingTriageCount}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Pill className="w-3.5 h-3.5 text-caution" />
          <span className="text-ink-2">Refill Reviews:</span>
          <span className="font-mono-clinical font-semibold text-ink">{summary.urgentRefillCount}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <CalendarDays className="w-3.5 h-3.5 text-accent-ink" />
          <span className="text-ink-2">Care Gaps:</span>
          <span className="font-mono-clinical font-semibold text-ink">{summary.schedulingCareGapCount}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Share2 className="w-3.5 h-3.5 text-accent-ink" />
          <span className="text-ink-2">Referrals:</span>
          <span className="font-mono-clinical font-semibold text-ink">{summary.openReferralCount}</span>
        </div>
      </div>
    </div>
  );
};
