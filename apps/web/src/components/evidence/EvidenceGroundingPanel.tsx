import { useState, useEffect, type FormEvent } from 'react';
import { 
  BookOpen, 
  Search, 
  ExternalLink, 
  Award, 
  CheckCircle2, 
  Copy, 
  PlusCircle, 
  FlaskConical,
  Target
} from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/api';

interface EvidenceGroundingPanelProps {
  conditions: string[];
  medications: string[];
  activeQuery?: string;
  onInsertIntoPlan?: (citationText: string) => void;
}

export default function EvidenceGroundingPanel({
  conditions,
  medications,
  activeQuery = '',
  onInsertIntoPlan
}: EvidenceGroundingPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'guidelines' | 'trials'>('guidelines');
  const [searchQuery, setSearchQuery] = useState(activeQuery);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [trialsList, setTrialsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);

  const fetchEvidence = async (queryText: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/clinical/evidence/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          condition: conditions[0] || '',
          medication: medications[0] || '',
          limit: 8
        })
      });
      if (res.ok) {
        const data = await res.json();
        setEvidenceList(data.evidence || []);
      }
    } catch (err) {
      console.error('Failed to search evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClinicalTrials = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/clinical/trials/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditions,
          medications
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTrialsList(data.trials || []);
      }
    } catch (err) {
      console.error('Failed to match trials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const combinedQuery = `${conditions.join(' ')} ${medications.join(' ')} ${activeQuery}`.trim();
    fetchEvidence(combinedQuery);
    fetchClinicalTrials();
  }, [conditions.length, medications.length]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (activeSubTab === 'guidelines') {
      fetchEvidence(searchQuery);
    }
  };

  const copyCitation = (item: any) => {
    const citation = `[Evidence: ${item.authority} (${item.year})] ${item.title}. ${item.journal}. PMID: ${item.pmid || 'N/A'}. Grade: ${item.evidenceGrade}.`;
    navigator.clipboard.writeText(citation);
    setCopiedId(item.guidelineId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const insertCitation = (item: any) => {
    if (onInsertIntoPlan) {
      const citationText = `\n- Evidence Justification: ${item.authority} (${item.year}) ${item.journal} [${item.evidenceGrade}]: ${item.recommendation} (PMID: ${item.pmid})`;
      onInsertIntoPlan(citationText);
      setInsertedId(item.guidelineId);
      setTimeout(() => setInsertedId(null), 2500);
    }
  };

  return (
    <div className="space-y-4 text-on-solid">
      {/* Header & Sub-Tab Switcher */}
      <div className="bg-solid/90 border border-rule-strong rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-accent-wash0/20 border border-accent-line0/30 flex items-center justify-center text-accent-ink">
              <BookOpen size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Proton Clinical Intelligence & Precision Medicine
                <span className="bg-accent-wash0/20 text-accent-ink text-[10px] font-semibold px-2 py-0.5 rounded-full border border-accent-line0/30">
                  PubMed RAG &bull; Tempus Protocol Matcher
                </span>
              </h3>
              <p className="text-xs text-ink-3">
                Ground treatment plans with peer-reviewed literature and identify open clinical trial options
              </p>
            </div>
          </div>

          {/* Subtab Toggle Buttons */}
          <div className="flex items-center gap-1 bg-solid p-1 rounded-xl border border-rule-strong shrink-0">
            <button
              onClick={() => setActiveSubTab('guidelines')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'guidelines'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-3 hover:text-white'
              }`}
            >
              <Award size={13} />
              <span>Guidelines & RCTs ({evidenceList.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('trials')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'trials'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-ink-3 hover:text-white'
              }`}
            >
              <FlaskConical size={13} />
              <span>Clinical Trials ({trialsList.length})</span>
            </button>
          </div>
        </div>

        {activeSubTab === 'guidelines' && (
          <form onSubmit={handleSearchSubmit} className="relative pt-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 mt-0.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search medical guidelines, clinical trials, or drug monographs (e.g. SGLT2, Angina, HbA1c)..."
              className="w-full bg-solid border border-rule-strong rounded-lg pl-9 pr-24 py-2 text-xs text-white placeholder-on-solid0 focus:outline-none focus:border-accent-line0"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-accent hover:bg-accent-wash0 text-white text-[11px] font-semibold px-3 py-1 rounded-md transition-colors cursor-pointer mt-0.5"
            >
              Search RAG
            </button>
          </form>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-ink-3">
          <div className="inline-block animate-spin h-6 w-6 border-2 border-accent-line0 border-t-transparent rounded-full mb-3"></div>
          <p className="text-xs">Querying peer-reviewed literature corpus and ClinicalTrials.gov vector store...</p>
        </div>
      ) : activeSubTab === 'guidelines' ? (
        /* GUIDELINES & RCTs LIST (OpenEvidence Competitor) */
        <div className="space-y-3">
          {evidenceList.map((item) => (
            <div
              key={item.guidelineId}
              className="bg-solid/80 border border-rule-strong hover:border-accent-line0/50 rounded-xl p-4 transition-all space-y-2.5 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="bg-accent border border-accent/80 text-accent-ink text-[10px] font-bold px-2 py-0.5 rounded">
                      {item.authority}
                    </span>
                    <span className="bg-solid text-ink-3 text-[10px] font-semibold px-2 py-0.5 rounded">
                      {item.journal} ({item.year})
                    </span>
                    <span className="bg-solid/80 border border-settled/60 text-settled-on-solid text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <Award size={11} />
                      {item.evidenceGrade}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white hover:text-accent-ink transition-colors">
                    {item.title}
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onInsertIntoPlan && (
                    <button
                      onClick={() => insertCitation(item)}
                      className="flex items-center gap-1 bg-accent/80 hover:bg-accent text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      title="Insert citation directly into treatment plan"
                    >
                      {insertedId === item.guidelineId ? <CheckCircle2 size={12} className="text-settled-on-solid" /> : <PlusCircle size={12} />}
                      {insertedId === item.guidelineId ? 'Inserted!' : 'Insert in Plan'}
                    </button>
                  )}
                  <button
                    onClick={() => copyCitation(item)}
                    className="p-1.5 text-ink-3 hover:text-white bg-solid hover:bg-solid rounded-lg cursor-pointer"
                    title="Copy full citation"
                  >
                    {copiedId === item.guidelineId ? <CheckCircle2 size={13} className="text-settled-on-solid" /> : <Copy size={13} />}
                  </button>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-ink-3 hover:text-accent-ink bg-solid hover:bg-solid rounded-lg"
                      title="Open in PubMed"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>

              {/* Recommendation Excerpt */}
              <div className="bg-solid/70 border border-rule-strong/80 rounded-lg p-2.5 text-xs text-ink-3 leading-relaxed">
                <span className="font-semibold text-accent-ink block mb-0.5">Clinical Directive / Recommendation:</span>
                {item.recommendation}
              </div>

              {/* Excerpt Quote & IDs */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-ink-3 pt-1">
                <p className="italic text-ink-3 pr-2">"{item.excerpt}"</p>
                {item.pmid && (
                  <span className="font-mono text-[10px] text-on-solid0">
                    PMID: <strong className="text-ink-3">{item.pmid}</strong>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* CLINICAL TRIALS LIST (Tempus Competitor) */
        <div className="space-y-3">
          {trialsList.length === 0 ? (
            <div className="p-8 text-center text-ink-3 bg-solid/60 rounded-xl border border-rule-strong text-xs">
              No matching clinical trials found for the current diagnostic profile.
            </div>
          ) : (
            trialsList.map((trial) => (
              <div
                key={trial.nctId}
                className="bg-solid/80 border border-rule-strong hover:border-brand-500/50 rounded-xl p-4 transition-all space-y-3 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="bg-brand-950 border border-brand-800 text-brand-300 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                        {trial.nctId}
                      </span>
                      <span className="bg-solid text-ink-3 text-[10px] font-semibold px-2 py-0.5 rounded">
                        {trial.phase}
                      </span>
                      <span className="bg-solid/80 border border-settled/60 text-settled-on-solid text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                        <Target size={11} />
                        {trial.concordanceScore}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white hover:text-brand-300 transition-colors">
                      {trial.title}
                    </h4>
                    <span className="text-[11px] text-ink-3 block">Sponsor: {trial.sponsor}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {trial.url && (
                      <a
                        href={trial.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-brand-600/80 hover:bg-brand-600 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <span>View Protocol</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-solid/70 border border-rule-strong/80 rounded-lg p-2.5 text-xs text-ink-3 space-y-1.5">
                  <div>
                    <span className="font-semibold text-brand-300">Investigational Intervention:</span>
                    <p className="text-ink-3">{trial.investigationalIntervention}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-ink-3">Target Clinical Condition:</span>
                    <p className="text-ink-3">{trial.conditionTarget}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-solid/50 rounded border border-rule-strong/60">
                    <strong className="text-settled-on-solid block mb-1">Key Inclusion Criteria:</strong>
                    <ul className="list-disc list-inside space-y-0.5 text-ink-3">
                      {trial.inclusionCriteria?.slice(0, 3).map((inc: string, i: number) => (
                        <li key={i}>{inc}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-2 bg-solid/50 rounded border border-rule-strong/60">
                    <strong className="text-critical-on-solid block mb-1">Key Exclusion Criteria:</strong>
                    <ul className="list-disc list-inside space-y-0.5 text-ink-3">
                      {trial.exclusionCriteria?.slice(0, 2).map((exc: string, i: number) => (
                        <li key={i}>{exc}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
