import { useState, useEffect } from 'react';
import {
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { apiJson } from '../../lib/api';

export interface CohortMetricsResponse {
  cohort_definition: {
    condition_code: string;
    label_version: string;
  };
  counts: {
    mature: number;
    pending: number;
    total: number;
    resolved: number;
    improved: number;
    unchanged: number;
    worsened: number;
    documented_non_response: number;
    lost_to_follow_up: number;
    responded: number;
  };
  rates: {
    positive_pct: number;
    documented_non_response_pct: number;
    lost_to_follow_up_pct: number;
    response_rate: number;
    pending_pct: number;
  };
  bias_disclosure: string[];
}

export function CohortOutcomeSection() {
  const [metrics, setMetrics] = useState<CohortMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<string>('ALL');
  const [evaluating, setEvaluating] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);

  const fetchMetrics = async (condition: string) => {
    setLoading(true);
    try {
      const query = condition !== 'ALL' ? `?conditionCode=${encodeURIComponent(condition)}` : '';
      const data = await apiJson<CohortMetricsResponse>(`/api/workflow/outcomes/cohort${query}`);
      setMetrics(data);
    } catch (err) {
      console.warn('Failed to fetch outcome cohort metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMetrics(selectedCondition);
  }, [selectedCondition]);

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    setEvalMessage(null);
    try {
      const res = await apiJson<{ evaluated_count: number }>(`/api/workflow/outcomes/evaluate-mature`, {
        method: 'POST',
        body: JSON.stringify({ asOfDate: new Date().toISOString() })
      });
      setEvalMessage(`Evaluated ${res.evaluated_count} mature cohort rows.`);
      await fetchMetrics(selectedCondition);
      setTimeout(() => setEvalMessage(null), 3000);
    } catch (err) {
      setEvalMessage((err as Error).message);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <section className="border-t border-b border-white/10 py-6 text-white space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="font-sans text-[10.5px] uppercase tracking-[0.2em] text-zinc-500">
            Cohort Verification · Spine Deterministic
          </span>
          <h2 className="mt-1 font-editorial text-2xl font-light tracking-tight text-white">
            30-Day Clinical Outcomes
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 font-sans text-xs">
          {/* Condition selector */}
          <select
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            className="border border-white/10 bg-[#0d0e12] px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
          >
            <option value="ALL">All Conditions</option>
            <option value="43878008">Strep Pharyngitis (43878008)</option>
            <option value="44054006">Type 2 Diabetes (44054006)</option>
          </select>

          {/* Refresh metrics */}
          <button
            type="button"
            onClick={() => void fetchMetrics(selectedCondition)}
            disabled={loading}
            title="Refresh metrics"
            className="flex h-8 w-8 items-center justify-center border border-white/10 bg-white/[0.02] text-zinc-400 hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </button>

          {/* Evaluation Trigger Button (Amber Accent) */}
          <button
            type="button"
            onClick={handleRunEvaluation}
            disabled={evaluating}
            className="flex h-8 items-center gap-1.5 bg-amber-500 hover:bg-amber-400 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-black transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.2)]"
          >
            <RefreshCw className={`h-3 w-3 ${evaluating ? 'animate-spin' : ''}`} />
            <span>{evaluating ? 'Evaluating…' : 'Run 30d evaluation'}</span>
          </button>
        </div>
      </div>

      {evalMessage && (
        <div className="border-l-2 border-emerald-400 bg-emerald-400/10 px-4 py-2 font-mono text-xs text-emerald-300">
          {evalMessage}
        </div>
      )}

      {/* The 3 Moat Numbers (Clean Typographic Row, No Cards) */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {/* Number 1: Resolved Rate */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-zinc-400">
              30d Resolved Rate
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="font-editorial text-4xl font-light tracking-tight text-white">
              {metrics ? `${metrics.rates.positive_pct}%` : '—'}
            </span>
            <span className="font-mono text-xs text-zinc-500 tabular-nums">
              ({metrics?.counts.resolved ?? 0}/{metrics?.counts.mature ?? 0})
            </span>
          </div>
          <p className="font-sans text-xs text-zinc-500">
            Mature encounters resolved with 0 same-condition returns
          </p>
        </div>

        {/* Number 2: Documented Non-Response */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400/90 shadow-[0_0_6px_rgba(251,191,36,0.7)]" />
            <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-zinc-400">
              Documented Non-Response
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="font-editorial text-4xl font-light tracking-tight text-zinc-200">
              {metrics ? `${metrics.rates.documented_non_response_pct}%` : '—'}
            </span>
            <span className="font-mono text-xs text-zinc-500 tabular-nums">
              ({metrics?.counts.documented_non_response ?? 0}/{metrics?.counts.mature ?? 0})
            </span>
          </div>
          <p className="font-sans text-xs text-zinc-500">
            Documented non-response (declined, wrong number, unreachable)
          </p>
        </div>

        {/* Number 3: Lost to Follow-up */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400/90 shadow-[0_0_6px_rgba(244,63,94,0.7)]" />
            <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-zinc-400">
              Lost to Follow-up
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="font-editorial text-4xl font-light tracking-tight text-zinc-200">
              {metrics ? `${metrics.rates.lost_to_follow_up_pct}%` : '—'}
            </span>
            <span className="font-mono text-xs text-zinc-500 tabular-nums">
              ({metrics?.counts.lost_to_follow_up ?? 0}/{metrics?.counts.mature ?? 0})
            </span>
          </div>
          <p className="font-sans text-xs text-zinc-500">
            Operational gaps where no outcome was filed
          </p>
        </div>
      </div>

      {/* Cohort Health Strip (Minimalist Row) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4 font-sans text-xs text-zinc-400">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <span className="text-zinc-500">Denominator: </span>
            <span className="font-mono text-white tabular-nums">{metrics?.counts.mature ?? 0} mature</span>
          </div>
          <div>
            <span className="text-zinc-500">Response Rate: </span>
            <span className="font-mono text-white tabular-nums">
              {metrics ? `${metrics.rates.response_rate}%` : '—'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Pending Immature: </span>
            <span className="font-mono text-zinc-400 tabular-nums">{metrics?.counts.pending ?? 0}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDisclosure(!showDisclosure)}
          className="flex items-center gap-1.5 font-sans text-xs text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          <Info size={13} className="text-zinc-400" />
          <span>Statutory caveats</span>
          {showDisclosure ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Bias Disclosures Drawer */}
      {showDisclosure && (
        <div className="border-l border-white/20 pl-4 py-1 text-xs text-zinc-400 space-y-1">
          <p className="font-sans text-[10px] uppercase tracking-wider text-zinc-500">
            Statutory Bias &amp; Scope Caveats (Section 8)
          </p>
          <ul className="list-disc pl-4 space-y-1 font-sans text-xs text-zinc-400">
            {metrics?.bias_disclosure.map((disclosure, idx) => (
              <li key={idx}>{disclosure}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default CohortOutcomeSection;
