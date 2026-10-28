import { useState, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMedplum } from '@medplum/react';
import { 
  ArrowLeft, Check, X, FileText, UploadCloud, Loader2, AlertTriangle, 
  ShieldAlert, CheckCircle2, Layers 
} from 'lucide-react';
import Layout from '../components/Layout';
import type { Bundle, Patient } from '@medplum/fhirtypes';
import { verifyExtractedFact } from '../services/verification';
import { auditService } from '../services/audit';
import { API_BASE_URL } from '../config';
import ProvenanceBadge from '../components/ui/ProvenanceBadge';
import TesseractLabStudio from '../components/TesseractLabStudio';

interface Fact {
  category: "medication" | "diagnosis" | "lab" | "procedure" | "allergy" | "other";
  text: string;
  confidence: number;
  source_quote: string;
  approved?: boolean;
  edited?: boolean;
}

interface Extraction {
  document_date: string;
  document_type: string;
  originalFileName: string;
  facts: Fact[];
}

export default function DocumentReview() {
  const medplum = useMedplum();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient');
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patientId || '');
  const [aiProvider, setAiProvider] = useState<string>('');
  const [showLabStudio, setShowLabStudio] = useState<boolean>(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/health/ai`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.provider) setAiProvider(data.provider);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    medplum.searchResources('Patient', { _count: 20, _sort: '-_lastUpdated' })
      .then((res) => {
        setPatients(res);
        if (!patientId && res.length > 0) {
          setSelectedPatientId(res[0].id || '');
        }
      })
      .catch(() => {});
  }, [medplum, patientId]);

  const effectivePatientId = patientId || selectedPatientId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'extracting' | 'review' | 'saving' | 'complete' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [extractions, setExtractions] = useState<Extraction[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files).slice(0, 5);
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
      
      const oversized = selected.find(f => f.size > MAX_SIZE);
      if (oversized) {
        setErrorMessage(`File "${oversized.name}" exceeds the 10MB limit.`);
        setStatus('error');
        return;
      }
      
      const invalidType = selected.find(f => !allowedMimes.includes(f.type) && !f.name.toLowerCase().endsWith('.pdf') && !f.name.toLowerCase().endsWith('.png') && !f.name.toLowerCase().endsWith('.jpg') && !f.name.toLowerCase().endsWith('.jpeg'));
      if (invalidType) {
        setErrorMessage(`File "${invalidType.name}" is not a supported format. Please upload PDF, JPG, or PNG files.`);
        setStatus('error');
        return;
      }
      
      setErrorMessage('');
      setStatus('idle');
      setFiles(selected);
    }
  };

  const handleUploadAndExtract = async () => {
    if (files.length === 0) return;
    setStatus('extracting');
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('documents', file));
      
      const response = await fetch(`${API_BASE_URL}/api/extract-documents`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || 'Document extraction failed. Please check files and try again.');
      }
      
      const data = await response.json();
      
      const exts = data.extractions.map((e: Extraction) => ({
        ...e,
        facts: e.facts.map((f: Fact) => ({ 
          ...f, 
          approved: true,
          edited: false
        }))
      }));
      
      setExtractions(exts);
      auditService.record('ai_draft_generated', `Extracted document facts from ${files.length} uploaded file(s)`, {
        patientId: patientId || undefined,
        details: { fileCount: files.length }
      });
      setStatus('review');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'An error occurred during extraction.');
    }
  };

  const toggleFact = (extIndex: number, factIndex: number, approved: boolean) => {
    const newExts = [...extractions];
    newExts[extIndex].facts[factIndex].approved = approved;
    setExtractions(newExts);
  };

  const updateFactText = (extIndex: number, factIndex: number, text: string) => {
    const newExts = [...extractions];
    newExts[extIndex].facts[factIndex].text = text;
    newExts[extIndex].facts[factIndex].edited = true;
    newExts[extIndex].facts[factIndex].approved = true;
    setExtractions(newExts);
  };

  const handleApproveAndSave = async () => {
    if (!effectivePatientId) {
      alert("Please select a target patient before committing records.");
      return;
    }
    
    setStatus('saving');
    try {
      const bundle: Bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: []
      };

      for (let extIdx = 0; extIdx < extractions.length; extIdx++) {
        const ext = extractions[extIdx];
        const docRefId = `urn:uuid:doc-${extIdx}`;
        
        bundle.entry!.push({
          fullUrl: docRefId,
          request: { method: 'POST', url: 'DocumentReference' },
          resource: {
            resourceType: 'DocumentReference',
            status: 'current',
            subject: { reference: `Patient/${effectivePatientId}` },
            description: ext.originalFileName || 'Historical Medical Document',
            date: ext.document_date ? new Date(ext.document_date).toISOString() : new Date().toISOString(),
            content: [
              {
                attachment: {
                  title: ext.originalFileName || 'Historical Medical Document',
                  contentType: 'application/pdf'
                }
              }
            ]
          }
        });

        for (const fact of ext.facts) {
          if (!fact.approved) continue;

          const baseResource = {
            subject: { reference: `Patient/${effectivePatientId}` }
          };

          if (fact.category === 'diagnosis' || fact.category === 'other') {
            bundle.entry!.push({
              request: { method: 'POST', url: 'Condition' },
              resource: {
                resourceType: 'Condition',
                ...baseResource,
                code: { text: fact.text },
                evidence: [{ 
                  detail: [{ reference: docRefId }],
                  code: fact.source_quote ? [{ text: fact.source_quote }] : undefined
                }]
              }
            });
          } else if (fact.category === 'medication') {
            bundle.entry!.push({
              request: { method: 'POST', url: 'MedicationStatement' },
              resource: {
                resourceType: 'MedicationStatement',
                status: 'active',
                ...baseResource,
                medicationCodeableConcept: { text: fact.text },
                derivedFrom: [{ reference: docRefId }],
                note: fact.source_quote ? [{ text: `Source Quote: ${fact.source_quote}` }] : undefined
              }
            });
          } else if (fact.category === 'lab' || fact.category === 'procedure') {
            bundle.entry!.push({
              request: { method: 'POST', url: 'Observation' },
              resource: {
                resourceType: 'Observation',
                status: 'final',
                ...baseResource,
                code: { text: fact.category === 'lab' ? 'Lab Result' : 'Procedure' },
                valueString: fact.text,
                derivedFrom: [{ reference: docRefId }],
                note: fact.source_quote ? [{ text: `Source Quote: ${fact.source_quote}` }] : undefined
              }
            });
          }
        }
      }

      await medplum.executeBatch(bundle);
      medplum.invalidateAll();
      
      auditService.record('document_fact_approved', `Committed ${approvedCount} approved document facts to FHIR for Patient ${effectivePatientId}`, {
        patientId: effectivePatientId || undefined,
        details: { approvedCount }
      });

      setStatus('complete');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to save extractions.');
    }
  };

  const allFacts = extractions.flatMap(e => e.facts);
  const lowConfidenceFacts = allFacts.filter(f => f.confidence < 0.70);
  const approvedCount = allFacts.filter(f => f.approved).length;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in pb-12">
        
        {/* Top Header */}
        <header className="p-6 bg-paper border border-rule rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              to={effectivePatientId ? `/patients/${effectivePatientId}` : "/patients"} 
              className="p-2 rounded-xl text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-ink">
                  Document Intelligence & Extraction
                </h1>
                <ProvenanceBadge provenance="AI_SUGGESTION" size="xs" />
                {aiProvider && (
                  <span className="font-mono text-[10px] text-accent-ink bg-settled-wash border border-settled-line px-2 py-0.5 rounded-full">
                    {aiProvider}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-2 mt-0.5">
                Optical character extraction • Physician review required before committing to FHIR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!patientId && patients.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-2 font-medium">Target Patient:</span>
                <select
                  value={effectivePatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="bg-paper-2 border border-rule rounded-xl px-3 py-1.5 text-xs font-semibold text-ink focus:outline-none focus:border-solid"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name?.[0]?.given?.join(' ')} {p.name?.[0]?.family}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {status === 'review' && (
              <button 
                onClick={handleApproveAndSave}
                disabled={approvedCount === 0}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-accent hover:bg-accent transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check size={14} />
                <span>Approve & Save {approvedCount} Facts to FHIR</span>
              </button>
            )}

            {status === 'saving' && (
              <button disabled className="bg-paper-2 text-ink-2 px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-ink"/>
                <span>Committing Transaction Bundle...</span>
              </button>
            )}
            <button
              onClick={() => setShowLabStudio(!showLabStudio)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-solid hover:bg-solid transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Layers size={14} className="text-settled-on-solid" />
              <span>{showLabStudio ? 'Hide Lab Studio' : 'Launch Tesseract Lab Studio'}</span>
            </button>
          </div>
        </header>

        {/* Tesseract Lab Studio Inspector */}
        {showLabStudio && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <TesseractLabStudio
              patientId={effectivePatientId}
              onClose={() => setShowLabStudio(false)}
            />
          </div>
        )}

        {/* Content Body */}
        {status === 'idle' || status === 'extracting' || status === 'error' ? (
          <div className="bg-paper border-2 border-dashed border-rule rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-paper-2 text-ink rounded-2xl flex items-center justify-center mx-auto">
              <UploadCloud size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">Upload Medical Records</h3>
              <p className="text-xs sm:text-sm text-ink-2 mt-1 max-w-md mx-auto">
                Upload up to 5 documents (PDF, JPG, PNG). Proton extracts clinical facts while maintaining immutable source citations.
              </p>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              multiple 
              accept=".pdf,image/png,image/jpeg" 
              className="hidden" 
            />
            
            <div className="flex justify-center gap-3 pt-2">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-paper border border-rule text-ink hover:bg-paper-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
              >
                Choose Documents
              </button>
              {files.length > 0 && (
                <button 
                  type="button"
                  onClick={handleUploadAndExtract}
                  disabled={status === 'extracting'}
                  className="bg-solid hover:bg-solid text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {status === 'extracting' ? (
                    <><Loader2 size={14} className="animate-spin text-settled-on-solid" /> Extracting Facts...</>
                  ) : (
                    `Extract from ${files.length} File${files.length > 1 ? 's' : ''}`
                  )}
                </button>
              )}
            </div>

            {files.length > 0 && (
              <div className="pt-4 flex flex-wrap gap-2 justify-center">
                {files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-paper-2 text-ink-2 rounded-full text-xs font-mono">
                    <FileText size={12}/> {f.name}
                  </span>
                ))}
              </div>
            )}

            {status === 'error' && (
              <div className="p-4 bg-critical-wash text-critical rounded-xl flex items-center gap-2 text-xs border border-critical-line text-left">
                <AlertTriangle size={15} className="shrink-0 text-critical" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        ) : status === 'complete' ? (
          <div className="bg-paper border border-rule rounded-2xl p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-settled-wash text-settled rounded-2xl flex items-center justify-center mx-auto border border-settled-line">
              <Check size={28} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">Records Successfully Committed</h3>
              <p className="text-xs text-ink-2 mt-1">
                Approved clinical facts have been linked to the patient profile with original source provenance.
              </p>
            </div>
            <Link 
              to={effectivePatientId ? `/patients/${effectivePatientId}` : "/patients"} 
              className="inline-flex items-center justify-center gap-2 bg-solid hover:bg-solid text-white px-6 py-2.5 rounded-xl font-semibold text-xs transition-colors shadow-xs"
            >
              <span>Return to Patient Chart</span>
            </Link>
          </div>
        ) : (
          <div className="bg-paper border border-rule rounded-2xl shadow-sm overflow-hidden space-y-0">
            
            {/* Safety Verification Callout */}
            <div className="bg-caution-wash/70 border-b border-caution-line/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldAlert size={18} className="text-caution shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-caution font-bold text-xs sm:text-sm">
                    Extracted from uploaded document &mdash; Physician confirmation required
                  </h4>
                  <p className="text-caution text-xs mt-0.5">
                    Unverified facts will not become permanent clinical memory until explicitly approved.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {lowConfidenceFacts.length > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 bg-caution-wash text-caution rounded-md border border-caution-line flex items-center gap-1 font-mono">
                    <AlertTriangle size={12} /> {lowConfidenceFacts.length} Low Confidence
                  </span>
                )}
                <span className="text-xs font-semibold px-2.5 py-1 bg-settled-wash text-settled rounded-md border border-settled-line flex items-center gap-1 font-mono">
                  <CheckCircle2 size={12} /> {allFacts.length - lowConfidenceFacts.length} High Confidence
                </span>
              </div>
            </div>

            {/* Extracted Facts Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-canvas border-b border-rule font-mono text-[11px] text-ink-2 uppercase">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Clinician Decision</th>
                    <th className="px-5 py-3 font-semibold">Provenance</th>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold w-full">Extracted Clinical Fact</th>
                    <th className="px-5 py-3 font-semibold">Source Citation</th>
                    <th className="px-5 py-3 font-semibold text-center">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {extractions.map((ext, extIdx) => 
                    ext.facts.map((fact, factIdx) => {
                      const factCheck = verifyExtractedFact(fact.confidence, fact.source_quote, ext.originalFileName || 'report');
                      
                      return (
                        <tr 
                          key={`${extIdx}-${factIdx}`} 
                          className={`${fact.approved ? 'bg-paper hover:bg-canvas' : 'bg-canvas/50 opacity-60'} transition-colors`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <button 
                                type="button"
                                onClick={() => toggleFact(extIdx, factIdx, true)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                  fact.approved 
                                    ? 'bg-settled text-white shadow-2xs' 
                                    : 'text-ink-2 hover:bg-paper-2'
                                }`}
                              >
                                <Check size={13} />
                                <span>Approve</span>
                              </button>
                              <button 
                                type="button"
                                onClick={() => toggleFact(extIdx, factIdx, false)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                  !fact.approved 
                                    ? 'bg-critical text-white shadow-2xs' 
                                    : 'text-ink-2 hover:bg-paper-2'
                                }`}
                              >
                                <X size={13} />
                                <span>Reject</span>
                              </button>
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <ProvenanceBadge 
                              provenance={fact.edited ? 'PHYSICIAN_EDITED' : (fact.approved ? 'AI_SUGGESTION' : 'REJECTED')}
                              size="xs"
                            />
                          </td>

                          <td className="px-5 py-3.5">
                            <span className="capitalize px-2 py-0.5 bg-paper-2 text-ink-2 rounded-md font-mono text-[11px] font-medium border border-rule">
                              {fact.category}
                            </span>
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2 min-w-[280px]">
                              <input 
                                type="text" 
                                value={fact.text} 
                                onChange={(e) => updateFactText(extIdx, factIdx, e.target.value)}
                                className={`w-full rounded-xl px-3 py-1.5 text-xs ${
                                  !fact.approved 
                                    ? 'line-through text-ink-3 bg-transparent border-0' 
                                    : 'text-ink bg-paper border border-rule focus:border-solid outline-none shadow-2xs'
                                }`}
                                disabled={!fact.approved}
                              />
                              {fact.edited && (
                                <span title="Modified by clinician" className="text-accent-ink shrink-0 font-mono text-[10px]">
                                  MODIFIED
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="flex flex-col max-w-xs whitespace-normal gap-1">
                              <span className="text-ink-2 italic text-xs leading-relaxed border-l-2 border-rule-strong pl-2">
                                "{fact.source_quote}"
                              </span>
                              <span className="text-[10px] text-accent-ink font-mono uppercase">
                                DOC: {ext.originalFileName || ext.document_type || 'Record'}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-center">
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                              factCheck.isLowConfidence 
                                ? 'bg-caution-wash text-caution border border-caution-line' 
                                : 'bg-settled-wash text-settled border border-settled-line'
                            }`}>
                              {Math.round(fact.confidence * 100)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-canvas border-t border-rule p-4 flex items-center justify-between text-xs text-ink-2 font-mono">
              <span>{extractions.reduce((acc, curr) => acc + curr.facts.length, 0)} total clinical facts extracted</span>
              <span className="font-bold text-ink">{approvedCount} approved for FHIR persistence</span>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
