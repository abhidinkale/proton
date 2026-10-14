import { useState, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMedplum } from '@medplum/react';
import { 
  ArrowLeft, Check, X, FileText, UploadCloud, Loader2, AlertTriangle, 
  ShieldAlert, FileImage, CheckCircle2, Edit2 
} from 'lucide-react';
import Layout from '../components/Layout';
import type { Bundle, Patient } from '@medplum/fhirtypes';
import { verifyExtractedFact } from '../services/verification';
import { auditService } from '../services/audit';
import { API_BASE_URL } from '../config';

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
        throw new Error(errPayload.error || 'Document extraction failed. Please check that files are valid PDFs or images and try again.');
      }
      
      const data = await response.json();
      
      // Auto-approve default, but doctor can reject or edit
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
    const fact = newExts[extIndex].facts[factIndex];
    if (approved) {
      auditService.record('document_fact_approved', `Physician approved extracted fact: "${fact.text}"`, {
        patientId: patientId || undefined
      });
    } else {
      auditService.record('document_fact_rejected', `Physician rejected extracted fact: "${fact.text}"`, {
        patientId: patientId || undefined
      });
    }
  };

  const updateFactText = (extIndex: number, factIndex: number, newText: string) => {
    const newExts = [...extractions];
    newExts[extIndex].facts[factIndex].text = newText;
    newExts[extIndex].facts[factIndex].edited = true;
    setExtractions(newExts);
    auditService.record('doctor_edited_note', `Physician edited extracted fact text to: "${newText}"`, {
      patientId: patientId || undefined
    });
  };

  const handleApproveAndSave = async () => {
    if (!effectivePatientId || status === 'saving') return;
    setStatus('saving');
    
    try {
      const bundle: Bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: []
      };

      let approvedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = extractions[i];
        if (!ext) continue;

        const docRefId = `urn:uuid:doc-${i}`;
        bundle.entry!.push({
          fullUrl: docRefId,
          request: { method: 'POST', url: 'DocumentReference' },
          resource: {
            resourceType: 'DocumentReference',
            status: 'current',
            subject: { reference: `Patient/${effectivePatientId}` },
            description: ext.originalFileName || file.name,
            content: [{ attachment: { title: file.name, contentType: file.type } }]
          }
        });

        const approvedFacts = ext.facts.filter(f => f.approved);
        approvedCount += approvedFacts.length;
        
        for (const fact of approvedFacts) {
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

  // Facts count and verification stats
  const allFacts = extractions.flatMap(e => e.facts);
  const lowConfidenceFacts = allFacts.filter(f => f.confidence < 0.70);
  const approvedCount = allFacts.filter(f => f.approved).length;

  return (
    <Layout>
      <div className="proton-document-workspace h-[calc(100vh-80px)] flex flex-col bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
        <header className="proton-document-header bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link to={effectivePatientId ? `/patients/${effectivePatientId}` : "/"} className="text-slate-400 hover:text-slate-700 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-brand-100 text-brand-600 rounded-lg flex items-center justify-center">
                <FileImage size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold text-slate-800 text-lg tracking-tight">Review Center &bull; Document Ingestion</h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    Nothing gets confirmed without you
                  </span>
                  {aiProvider === 'medgemma' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      AI Provider: MedGemma Local (Dev)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">Ingest Historical Documents &bull; Extract, review and approve facts into permanent medical memory</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!patientId && patients.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Target Patient:</span>
                <select
                  value={effectivePatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                className={`px-5 py-2.5 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2 ${
                  approvedCount === 0 
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                    : 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer'
                }`}
              >
                <Check size={18} /> Approve & Save to FHIR
              </button>
            )}
            {status === 'saving' && (
              <button disabled className="bg-slate-300 text-slate-500 px-5 py-2.5 rounded-lg font-medium flex items-center gap-2">
                <Loader2 size={18} className="animate-spin"/> Saving securely...
              </button>
            )}
          </div>
        </header>

        <div className="proton-document-content flex-1 overflow-hidden p-6 flex flex-col">
          {status === 'idle' || status === 'extracting' || status === 'error' ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl bg-white p-12 text-center max-w-2xl mx-auto w-full my-auto">
              <div className="h-16 w-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mb-4">
                <UploadCloud size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Upload Previous Medical Records</h2>
              <p className="text-slate-500 text-sm mt-1 mb-6 max-w-sm">
                Upload up to 5 documents (PDF, JPG, PNG). Proton extracts clinical facts while preserving document provenance.
              </p>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                multiple 
                accept=".pdf,image/png,image/jpeg" 
                className="hidden" 
              />
              
              <div className="flex gap-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-2xs"
                >
                  Select Files
                </button>
                {files.length > 0 && (
                  <button 
                    onClick={handleUploadAndExtract}
                    disabled={status === 'extracting'}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
                  >
                    {status === 'extracting' ? <><Loader2 size={16} className="animate-spin"/> Extracting...</> : `Extract from ${files.length} File${files.length > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>

              {files.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                      <FileText size={12}/> {f.name}
                    </span>
                  ))}
                </div>
              )}

              {status === 'error' && (
                <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-200">
                  <AlertTriangle size={16}/> {errorMessage}
                </div>
              )}
            </div>
          ) : status === 'complete' ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto my-auto shadow-sm">
              <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <Check size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Records Successfully Ingested</h2>
              <p className="text-slate-500 text-sm mt-1 mb-6">
                Approved clinical facts have been linked to the patient profile with original source provenance.
              </p>
              <Link to={effectivePatientId ? `/patients/${effectivePatientId}` : "/patients"} className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm">
                Return to Profile
              </Link>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              
              {/* SAFETY VERIFICATION BANNER */}
              <div className="bg-amber-50/80 border-b border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-start gap-3">
                  <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-amber-900 font-bold text-sm flex items-center gap-2">
                      Extracted from uploaded document &mdash; Physician review required
                    </h3>
                    <p className="text-amber-800 text-xs mt-0.5">
                      Unverified AI outputs will not become permanent clinical memory until explicitly approved.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {lowConfidenceFacts.length > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-900 rounded-md border border-amber-300 flex items-center gap-1">
                      <AlertTriangle size={13} /> {lowConfidenceFacts.length} Low Confidence
                    </span>
                  )}
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-md border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 size={13} /> {allFacts.length - lowConfidenceFacts.length} High Confidence
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-0">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Action</th>
                      <th className="px-6 py-4">Provenance</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4 w-full">Extracted Value</th>
                      <th className="px-6 py-4">Source Quote & Document</th>
                      <th className="px-6 py-4 text-center">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {extractions.map((ext, extIdx) => 
                      ext.facts.map((fact, factIdx) => {
                        const factCheck = verifyExtractedFact(fact.confidence, fact.source_quote, ext.originalFileName || 'report');
                        
                        return (
                          <tr key={`${extIdx}-${factIdx}`} className={`${fact.approved ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 opacity-60'} transition-colors`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1 bg-slate-100 rounded p-1 w-fit">
                                <button 
                                  onClick={() => toggleFact(extIdx, factIdx, true)}
                                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${fact.approved ? 'bg-green-100 text-green-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                                >
                                  <Check size={14}/> Approve
                                </button>
                                <button 
                                  onClick={() => toggleFact(extIdx, factIdx, false)}
                                  className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${!fact.approved ? 'bg-slate-300 text-slate-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                                >
                                  <X size={14}/> Reject
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                                !fact.approved 
                                  ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                  : fact.edited 
                                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {!fact.approved ? 'Rejected' : fact.edited ? 'Edited by physician' : 'AI extracted'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="capitalize px-2.5 py-1 bg-brand-50 text-brand-700 rounded-md font-medium text-xs">
                                {fact.category}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="text" 
                                  value={fact.text} 
                                  onChange={(e) => updateFactText(extIdx, factIdx, e.target.value)}
                                  className={`w-full border-none focus:ring-2 focus:ring-brand-200 rounded px-2 py-1 text-sm ${!fact.approved ? 'line-through text-slate-400 bg-transparent' : 'text-slate-900 bg-white shadow-sm ring-1 ring-slate-200'}`}
                                  disabled={!fact.approved}
                                />
                                {fact.edited && (
                                  <span title="Edited by physician" className="text-blue-600 shrink-0">
                                    <Edit2 size={13} />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col max-w-xs whitespace-normal gap-1.5">
                                <span className="text-slate-600 italic text-xs leading-relaxed border-l-2 border-slate-300 pl-2">
                                  "{fact.source_quote}"
                                </span>
                                <span className="text-[10px] text-brand-600 font-medium font-mono uppercase bg-brand-50 px-1.5 py-0.5 rounded w-fit">
                                  DOC: {ext.originalFileName || ext.document_type || 'Unknown'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                  factCheck.isLowConfidence ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-green-100 text-green-700'
                                }`}>
                                  {Math.round(fact.confidence * 100)}%
                                </span>
                                {factCheck.isLowConfidence && (
                                  <span className="text-[10px] font-semibold text-amber-700 flex items-center gap-0.5">
                                    <AlertTriangle size={10} /> Review
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0 flex items-center justify-between text-sm text-slate-600">
                <span>{extractions.reduce((acc, curr) => acc + curr.facts.length, 0)} total facts extracted</span>
                <span className="font-semibold">{approvedCount} approved for saving</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
