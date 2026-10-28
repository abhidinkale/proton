/**
 * Claim a clinic — the clinician half of organization onboarding.
 *
 * Reaching this page means someone was invited. Two things can be true:
 *
 *   1. There is no Proton session yet. The invite token is single-use and
 *      expiring, so it is parked in sessionStorage and the clinician is sent
 *      through the real identity boundary (`/login?next=…`). Nothing about the
 *      invitation grants a login.
 *   2. There is a session. Claiming re-mints it with the organization's tenant
 *      claim, which is what every `/api/organizations/*` call checks. Until
 *      that happens the clinician is signed in but belongs to no clinic.
 *
 * The claim is an explicit button, never automatic on mount: a pasted link in a
 * shared browser must not silently move whoever is signed in into a new tenant.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, KeyRound } from 'lucide-react';
import { ApiError } from '../lib/api';
import { authService } from '../services/auth';
import { setSessionToken } from '../lib/sessionToken';
import {
  claimInvite,
  forgetPendingInvite,
  readPendingInvite,
  rememberPendingInvite
} from '../lib/clinicOrgApi';
import {
  ClinicMasthead,
  Notice,
  primaryButton,
  quietButton,
  FAINT,
  MUTED,
  RULE
} from '../components/clinic/ClinicChrome';

export default function ClinicJoin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const urlToken = params.get('invite');
  const pendingToken = useMemo(() => readPendingInvite(), []);
  const token = urlToken || pendingToken;

  const signedIn = Boolean(authService.getCurrentUser());

  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimedOrg, setClaimedOrg] = useState<string | null>(null);

  useEffect(() => {
    if (urlToken) rememberPendingInvite(urlToken);
  }, [urlToken]);

  const claim = useCallback(async () => {
    if (!token || claiming) return;

    setClaiming(true);
    setError(null);

    try {
      const result = await claimInvite(token);

      if (!result.session) {
        setError(
          'The clinic accepted the invite but issued no session. Ask the clinic owner to re-issue the invite.'
        );
        return;
      }

      // The new token carries the organization's tenant claim. Replacing it is
      // the whole point of claiming — the old one stays valid only for the
      // tenant it was minted for.
      setSessionToken(result.session.token);

      const existing = authService.getCurrentUser();
      if (existing) {
        authService.setSessionUser({ ...existing, organizationId: result.session.tenantId });
      }

      forgetPendingInvite();
      setClaimedOrg(result.organization.name);
      navigate('/care-loop', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'INVITE_EXPIRED' || err.code === 'INVITE_ALREADY_USED')) {
        setError(
          'This invite can no longer be used — it has expired or was already claimed. Ask the clinic owner for a new one.'
        );
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not reach the clinic service. Try again, or ask the owner to re-issue the invite.');
      }
    } finally {
      setClaiming(false);
    }
  }, [token, claiming, navigate]);

  if (!token) {
    return (
      <Frame>
        <ClinicMasthead
          eyebrow={<>Clinic onboarding / claim</>}
          title="No invite on this link."
          lede="A claim link carries a single-use token. If it was copied by hand, a character may have been lost."
        />
        <div className={`rounded-[12px] border ${RULE} bg-paper p-4`}>
          <p className={`text-[12px] leading-relaxed ${MUTED}`}>
            Ask the clinic owner to copy the full claim link from the clinic desk, or open the link
            directly from the invitation.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/clinic/start" className={primaryButton}>
            Open a clinic instead
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link to="/login" className={quietButton}>
            Sign in
          </Link>
        </div>
      </Frame>
    );
  }

  const next = `/clinic/join?invite=${encodeURIComponent(token)}`;

  return (
    <Frame>
      <ClinicMasthead
        eyebrow={<>Clinic onboarding / step 3 of 3</>}
        title={signedIn ? 'Claim this clinic.' : 'Sign in, then claim this clinic.'}
        lede={
          signedIn
            ? 'Your session will be re-issued with this clinic’s tenant claim. Everything you see afterwards — schedule, care loop, patients — belongs to this organization.'
            : 'The invite only proves you were invited. Signing in proves who you are; the claim binds the two together.'
        }
        aside={
          <p className={`font-mono text-[9.5px] uppercase tracking-[0.16em] ${FAINT}`}>
            <KeyRound className="mr-1.5 inline h-3 w-3" />
            single use
          </p>
        }
      />

      {error && (
        <Notice tone="error" title="Not claimed" role="alert">
          {error}
        </Notice>
      )}

      {claimedOrg && (
        <Notice tone="success" title="Claimed" role="status">
          You are now a member of {claimedOrg}.
        </Notice>
      )}

      <div className={`rounded-[12px] border ${RULE} bg-paper p-4 sm:p-5`}>
        {signedIn ? (
          <>
            <p className={`text-[12.5px] leading-relaxed ${MUTED}`}>
              Signed in as <span className="font-medium text-ink">{authService.getCurrentUser()?.email}</span>.
              Claiming replaces this session with one bound to the clinic — you will be taken straight to
              its care loop.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={claim} className={primaryButton} disabled={claiming}>
                {claiming ? 'Claiming…' : 'Claim this clinic'}
                {!claiming && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
              <Link to="/clinic/admin" className={quietButton}>
                I already belong to a clinic
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className={`text-[12.5px] leading-relaxed ${MUTED}`}>
              This link is saved in this browser tab. Sign in with the clinical identity the invite was
              addressed to, and you will come back here to finish.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                to={`/login?next=${encodeURIComponent(next)}`}
                onClick={() => rememberPendingInvite(token)}
                className={primaryButton}
              >
                Sign in to claim
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/clinic/start" className={quietButton}>
                Open a new clinic instead
              </Link>
            </div>
          </>
        )}
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas px-5 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="mb-9 flex items-center justify-between gap-3">
          <Link to="/welcome" className="flex items-center gap-2.5" aria-label="Proton home">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-solid text-sm font-bold text-white">
              p
            </span>
            <span className="text-[15px] font-semibold lowercase tracking-[-0.03em] text-ink">proton</span>
          </Link>
          <Link to="/login" className="text-[12px] font-medium text-ink-2 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
