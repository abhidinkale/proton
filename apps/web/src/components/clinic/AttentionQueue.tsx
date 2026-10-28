import { AlertTriangle, ArrowRight, Bell, Check, CheckCheck, LoaderCircle, RefreshCw } from 'lucide-react';
import type { ClinicNotification } from '../../lib/clinicApi';

export interface AttentionQueueProps {
  notifications: ClinicNotification[];
  loading?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onOpen: (notification: ClinicNotification) => void;
  onResolve: (notification: ClinicNotification) => void;
  onMarkAllRead?: () => void;
}

function timeAgo(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

const SEVERITY_STYLES: Record<ClinicNotification['severity'], { card: string; label: string; text: string }> = {
  critical: {
    card: 'bg-critical-wash border-critical-line',
    label: 'text-critical',
    text: 'Critical'
  },
  warning: {
    card: 'bg-caution-wash border-caution-line',
    label: 'text-caution',
    text: 'Warning'
  },
  info: {
    card: 'bg-paper border-rule',
    label: 'text-ink-2',
    text: 'Info'
  }
};

export function AttentionQueue({
  notifications,
  loading = false,
  error = null,
  onRefresh,
  onOpen,
  onResolve,
  onMarkAllRead
}: AttentionQueueProps) {
  const active = notifications.filter((notification) => !notification.resolvedAt);
  const unread = active.filter((notification) => !notification.readAt);
  const resolved = notifications.filter((notification) => notification.resolvedAt);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-ink-2">
          {loading && !active.length
            ? 'Loading the attention queue…'
            : unread.length
              ? `${unread.length} unread · ${active.length} open`
              : `${active.length} open · all caught up`}
        </p>
        <div className="flex items-center gap-2">
          {unread.length > 0 && onMarkAllRead && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="flex items-center gap-1 rounded-full border border-rule bg-paper px-2.5 py-1 text-[10.5px] font-semibold text-ink-2 transition-colors hover:text-ink cursor-pointer"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-rule bg-paper text-ink-2 transition-colors hover:text-ink disabled:opacity-50 cursor-pointer"
            aria-label="Refresh attention queue"
          >
            {loading ? <LoaderCircle size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-caution-line bg-caution-wash px-3.5 py-3 text-[11px] leading-relaxed text-caution">
          {error}
        </div>
      )}

      {!loading && !error && !active.length && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-rule-strong bg-paper/60 px-6 py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-ink-2">
            <Bell size={17} />
          </span>
          <p className="text-[12.5px] font-semibold text-ink">Nothing needs your attention</p>
          <p className="max-w-[220px] text-[11px] leading-relaxed text-ink-3">
            Lab escalations, safety stops and unsigned notes will appear here.
          </p>
        </div>
      )}

      {active.map((notification) => {
        const style = SEVERITY_STYLES[notification.severity] || SEVERITY_STYLES.info;
        return (
          <div
            key={notification.id}
            className={`rounded-2xl border p-3.5 space-y-1.5 ${style.card} ${notification.readAt ? 'opacity-80' : ''}`}
          >
            <div className={`flex items-center justify-between gap-2 text-[10.5px] font-bold ${style.label}`}>
              <span className="flex items-center gap-1">
                {notification.severity === 'critical' && <AlertTriangle className="w-3.5 h-3.5" />}
                {notification.title}
              </span>
              <span className="shrink-0 font-medium opacity-80">{timeAgo(notification.createdAt)}</span>
            </div>
            <p className="text-[12px] font-semibold text-ink">{notification.body}</p>
            <div className="flex items-center justify-between gap-2 pt-1">
              {notification.actionPath ? (
                <button
                  type="button"
                  onClick={() => onOpen(notification)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-ink hover:underline cursor-pointer"
                >
                  {notification.type === 'note' ? 'Open sign-off' : 'Review patient'}
                  <ArrowRight size={11} />
                </button>
              ) : (
                <span className="text-[10px] uppercase tracking-[0.1em] text-ink-3">
                  {notification.type.replaceAll('-', ' ')}
                </span>
              )}
              <button
                type="button"
                onClick={() => onResolve(notification)}
                className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-paper/70 px-2 py-0.5 text-[10px] font-semibold text-ink-2 transition-colors hover:text-ink cursor-pointer"
              >
                <Check size={10} />
                Resolve
              </button>
            </div>
          </div>
        );
      })}

      {resolved.length > 0 && (
        <div className="pt-1">
          <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Resolved today · {resolved.length}
          </p>
          <div className="space-y-1.5">
            {resolved.slice(0, 5).map((notification) => (
              <div key={notification.id} className="flex items-center gap-2 rounded-xl bg-paper/50 px-3 py-2">
                <Check size={11} className="shrink-0 text-settled" />
                <span className="flex-1 truncate text-[11px] text-ink-2">{notification.title}</span>
                <span className="text-[10px] text-ink-3">{timeAgo(notification.resolvedAt || notification.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AttentionQueue;
