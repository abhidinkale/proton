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
    <div className="bg-white border border-[#D5D2C9] rounded-lg p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0F4C81]/10 flex items-center justify-center text-[#0F4C81]">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-clinical text-xs font-semibold uppercase text-[#0F4C81]">
                // OPERATIONS COMMAND QUEUE
              </span>
              <span className="font-mono-clinical text-[11px] px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 rounded font-medium">
                {summary.totalActiveTasks} ACTIONS AWAITING ATTENTION
              </span>
              {isOffline && (
                <span className="font-mono-clinical text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded">
                  OFFLINE SYNTHETIC
                </span>
              )}
            </div>
            <p className="text-xs text-[#5A6065] mt-0.5">
              Eleanor Vance (Urgent BP Triage & Nephrology Referral Packet) • Arthur Pendelton (DOAC Refill Safety Intercept & Recall)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/operations"
            className="px-3.5 py-2 bg-[#0F4C81] text-white rounded text-xs font-mono-clinical font-semibold hover:bg-[#0B3B66] transition flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <span>Manage Operations OS</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-[#EAE8E1]">
        <div className="flex items-center gap-2 text-xs">
          <MessageSquareText className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[#5A6065]">Triage:</span>
          <span className="font-mono-clinical font-semibold text-[#111315]">{summary.pendingTriageCount}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Pill className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[#5A6065]">Refill Reviews:</span>
          <span className="font-mono-clinical font-semibold text-[#111315]">{summary.urgentRefillCount}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <CalendarDays className="w-3.5 h-3.5 text-purple-600" />
          <span className="text-[#5A6065]">Care Gaps:</span>
          <span className="font-mono-clinical font-semibold text-[#111315]">{summary.schedulingCareGapCount}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Share2 className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-[#5A6065]">Referrals:</span>
          <span className="font-mono-clinical font-semibold text-[#111315]">{summary.openReferralCount}</span>
        </div>
      </div>
    </div>
  );
};
