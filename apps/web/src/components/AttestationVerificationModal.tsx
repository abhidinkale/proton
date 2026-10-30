import { useState } from 'react';
import { Check, X, ShieldCheck, Loader2, Copy, CheckCircle2, Award } from 'lucide-react';
import { apiJson } from '../lib/api';

export interface AttestationData {
  id: string;
  seq: number;
  content_hash: string;
  chain_hash: string;
  attested_at: string;
}

interface AttestationVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  attestation: AttestationData | null;
}

export default function AttestationVerificationModal({
  isOpen,
  onClose,
  attestation
}: AttestationVerificationModalProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    errors?: string[];
  } | null>(null);
  const [anchorInfo, setAnchorInfo] = useState<{
    anchored: boolean;
    tsa?: string;
    genTime?: string;
    policy?: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen || !attestation) return null;

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    setAnchorInfo(null);
    try {
      const [res, anchorRes] = await Promise.allSettled([
        apiJson<{ valid: boolean; errors?: string[] }>(
          `/api/workflow/attestations/${encodeURIComponent(attestation.id)}/verify`
        ),
        apiJson<{ anchor: any; verification: { valid: boolean; tsa?: string; genTime?: string; policy?: string } }>(
          `/api/workflow/attestations/anchor/latest`
        )
      ]);

      if (res.status === 'fulfilled') {
        setVerificationResult(res.value);
      } else {
        setVerificationResult({ valid: false, errors: [(res.reason as Error).message] });
      }

      if (anchorRes.status === 'fulfilled' && anchorRes.value?.verification?.valid) {
        setAnchorInfo({
          anchored: true,
          tsa: anchorRes.value.verification.tsa,
          genTime: anchorRes.value.verification.genTime,
          policy: anchorRes.value.verification.policy
        });
      }
    } catch (err) {
      setVerificationResult({ valid: false, errors: [(err as Error).message] });
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-canvas p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Immutable Clinical Attestation</h3>
              <p className="text-xs text-white/50">Committed to Postgres Workflow Ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3 border border-white/5">
            <span className="text-xs text-white/50">Ledger Sequence</span>
            <span className="font-mono text-xs font-semibold text-white">#{attestation.seq}</span>
          </div>

          <div className="rounded-xl bg-white/[0.03] p-3 border border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-white/60">Content Hash (Canonical note_v1)</span>
              <button
                onClick={() => copyToClipboard(attestation.content_hash, 'content')}
                className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white"
              >
                {copiedField === 'content' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedField === 'content' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="break-all font-mono text-[11px] leading-relaxed text-emerald-400/90 bg-black/30 p-2 rounded-lg border border-emerald-500/20">
              {attestation.content_hash}
            </p>
          </div>

          <div className="rounded-xl bg-white/[0.03] p-3 border border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-white/60">Chain Hash (SHA-256 Prev-Link)</span>
              <button
                onClick={() => copyToClipboard(attestation.chain_hash, 'chain')}
                className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white"
              >
                {copiedField === 'chain' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedField === 'chain' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="break-all font-mono text-[11px] leading-relaxed text-indigo-300/90 bg-black/30 p-2 rounded-lg border border-indigo-500/20">
              {attestation.chain_hash}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/40 px-1">
            <span>Attested Timestamp</span>
            <span className="font-mono">{new Date(attestation.attested_at).toLocaleString()}</span>
          </div>

          {verificationResult && (
            <div
              className={`flex items-center gap-2.5 rounded-2xl p-3.5 border ${
                verificationResult.valid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {verificationResult.valid ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              ) : (
                <X className="h-5 w-5 shrink-0 text-red-400" />
              )}
              <div className="text-xs">
                <p className="font-semibold">
                  {verificationResult.valid
                    ? 'Cryptographically Validated'
                    : 'Attestation Verification Failed'}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {verificationResult.valid
                    ? 'Recomputed hash matches canonical bytes & immutable chain.'
                    : verificationResult.errors?.join(', ') || 'Hash mismatch detected.'}
                </p>
              </div>
            </div>
          )}

          {anchorInfo && anchorInfo.anchored && (
            <div className="rounded-2xl p-3 border border-amber-500/30 bg-amber-500/10 text-amber-300">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="text-xs font-semibold">RFC 3161 Cryptographic Chain Anchor</span>
              </div>
              <p className="mt-1 text-[11px] text-amber-200/80 leading-relaxed">
                Authority: <span className="font-mono text-amber-100">{anchorInfo.tsa || 'Proton Clinical Attestation Authority (Internal Chain Anchor)'}</span>
              </p>
              {anchorInfo.genTime && (
                <p className="text-[10px] text-amber-200/60 font-mono mt-0.5">
                  Anchored UTC: {new Date(anchorInfo.genTime).toUTCString()}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/5 hover:text-white"
          >
            Close
          </button>
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-black transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isVerifying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
            )}
            {isVerifying ? 'Verifying...' : 'Verify Hash'}
          </button>
        </div>
      </div>
    </div>
  );
}
