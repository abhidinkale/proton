import { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
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
    <section className="proton-glass proton-specular rounded-2xl p-4 sm:p-5 text-ink space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[13px] font-semibold tracking-[-0.01em]">
              30-Day Clinical Outcome Cohort
            </h2>
            <p className="text-[10px] text-ink-2 font-mono-clinical">
              Spine verification · <span className="font-semibold text-emerald-600">label_v1</span> deterministic
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Condition selector */}
          <select
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value)}
            className="rounded-lg border border-rule/80 bg-paper/70 px-2.5 py-1 text-[11px] font-medium text-ink focus:outline-none focus:ring-1 focus:ring-accent"
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
            className="flex items-center justify-center rounded-lg border border-rule/80 bg-paper p-1.5 text-ink-2 hover:bg-paper/90 hover:text-ink disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin text-accent" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </button>

          {/* Evaluation Trigger Button */}
          <button
            type="button"
            onClick={handleRunEvaluation}
            disabled={evaluating}
            className="flex items-center gap-1.5 rounded-lg border border-rule/80 bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition-all hover:bg-paper/90 hover:text-ink disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${evaluating ? 'animate-spin text-accent' : ''}`} />
            {evaluating ? 'Evaluating…' : 'Run 30d Job'}
          </button>
        </div>
      </div>

      {evalMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-700 font-medium">
          {evalMessage}
        </div>
      )}

      {/* The 3 Moat Numbers */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Number 1: Resolved Rate */}
        <div className="rounded-xl border border-rule/70 bg-paper/60 p-3">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-2">
            <span>30d Resolved</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-settled" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-clinical text-2xl font-bold tracking-tight text-ink">
              {metrics ? `${metrics.rates.positive_pct}%` : '—'}
            </span>
            <span className="text-[10px] text-ink-2 font-mono-clinical">
              ({metrics?.counts.resolved ?? 0}/{metrics?.counts.mature ?? 0})
            </span>
          </div>
          <p className="mt-1 text-[10px] text-ink-3">
            Mature encounters resolved with 0 same-condition returns
          </p>
        </div>

        {/* Number 2: Documented Non-Response */}
        <div className="rounded-xl border border-rule/70 bg-paper/60 p-3">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-2">
            <span>Non-Response</span>
            <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-clinical text-2xl font-bold tracking-tight text-amber-600">
              {metrics ? `${metrics.rates.documented_non_response_pct}%` : '—'}
            </span>
            <span className="text-[10px] text-ink-2 font-mono-clinical">
              ({metrics?.counts.documented_non_response ?? 0}/{metrics?.counts.mature ?? 0})
            </span>
          </div>
          <p className="mt-1 text-[10px] text-ink-3">
            Documented reasons (declined, wrong number, no contact)
          </p>
        </div>

        {/* Number 3: Lost to Follow-up */}
        <div className="rounded-xl border border-rule/70 bg-paper/60 p-3">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-2">
            <span>Lost to Follow-up</span>
            <AlertCircle className="h-3.5 w-3.5 text-critical" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-clinical text-2xl font-bold tracking-tight text-critical">
              {metrics ? `${metrics.rates.lost_to_follow_up_pct}%` : '—'}
            </span>
            <span className="text-[10px] text-ink-2 font-mono-clinical">
              ({metrics?.counts.lost_to_follow_up ?? 0}/{metrics?.counts.mature ?? 0})
            </span>
          </div>
          <p className="mt-1 text-[10px] text-ink-3">
            Operational gaps where no outcome was filed
          </p>
        </div>
      </div>

      {/* Cohort Health Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.05] bg-paper/40 px-3.5 py-2.5 text-[11px]">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-ink-2">Denominator M: </span>
            <strong className="font-mono-clinical text-ink">{metrics?.counts.mature ?? 0} mature</strong>
          </div>
          <div>
            <span className="text-ink-2">Response Rate: </span>
            <strong className="font-mono-clinical text-emerald-600">
              {metrics ? `${metrics.rates.response_rate}%` : '—'}
            </strong>
          </div>
          <div>
            <span className="text-ink-2">Immature / Pending: </span>
            <strong className="font-mono-clinical text-ink-2">{metrics?.counts.pending ?? 0}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDisclosure(!showDisclosure)}
          className="flex items-center gap-1 font-medium text-[10.5px] text-ink-2 hover:text-ink cursor-pointer"
        >
          <Info className="h-3 w-3 text-accent" />
          Bias Disclosures
          {showDisclosure ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Bias Disclosures Drawer */}
      {showDisclosure && (
        <div className="rounded-xl border border-accent-line/60 bg-accent-wash/30 p-3 space-y-1.5 text-[10.5px] text-ink-2 leading-relaxed">
          <p className="font-semibold text-accent-ink uppercase tracking-wider text-[9.5px]">
            Statutory Bias &amp; Scope Caveats (Section 8)
          </p>
          <ul className="list-disc pl-4 space-y-1">
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
