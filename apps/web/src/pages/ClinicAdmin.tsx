/**
 * The clinic desk — self-serve administration for the organization that owns
 * this workspace.
 *
 * Before this page existed, opening a clinic and linking a patient required
 * `curl`, which meant every design partner needed the founder on a call. The
 * three jobs here are the three that actually block onboarding:
 *
 *   1. Who is in the clinic           → members, and inviting a colleague
 *   2. What patients see              → name, brand colour, logo
 *   3. How a patient joins            → single-use six-character codes
 *
 * Every tenant check happens server-side (`assertTenant` in
 * routes/organizations.js); this page only refuses to look confident about a
 * workspace that has no clinic yet.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import Layout from '../components/Layout';
import { authService } from '../services/auth';
import { ApiError } from '../lib/api';
import {
  getOrganization,
  inviteMember,
  inviteUrl,
  issueLinkCode,
  listLinkCodes,
  revokeLinkCode,
  updateBranding,
  type ClinicLinkCode,
  type ClinicMember,
  type ClinicOrganization,
  type OrgRole
} from '../lib/clinicOrgApi';
import {
  ClinicMasthead,
  Field,
  Notice,
  SectionCard,
  SecretReveal,
  inputClass,
  primaryButton,
  quietButton,
  FAINT,
  INK,
  MUTED,
  RULE
} from '../components/clinic/ClinicChrome';

const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member'
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ClinicAdmin() {
  const sessionUser = authService.getCurrentUser();
  const orgId = sessionUser?.organizationId ?? null;

  const [organization, setOrganization] = useState<ClinicOrganization | null>(null);
  const [members, setMembers] = useState<ClinicMember[]>([]);
  const [codes, setCodes] = useState<ClinicLinkCode[]>([]);
  const [loading, setLoading] = useState(Boolean(orgId));
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoadError(null);
    try {
      const [detail, linkCodes] = await Promise.all([
        getOrganization(orgId),
        listLinkCodes(orgId, true).catch(() => ({ codes: [] as ClinicLinkCode[] }))
      ]);
      setOrganization(detail.organization);
      setMembers(detail.members ?? []);
      setCodes(linkCodes.codes ?? []);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : 'Could not read this clinic. The API may be unreachable.'
      );
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!orgId || orgId === 'org-default') {
    return (
      <Layout>
        <div className="mx-auto w-full max-w-[720px] pb-10">
          <ClinicMasthead
            eyebrow={<>Clinic desk / unbound workspace</>}
            title="This workspace has no clinic."
            lede="Your session is not bound to an organization yet. A clinic is created once, then claimed by its first clinician. After that this desk manages it."
          />
          <div className={`rounded-[12px] border ${RULE} bg-paper p-4`}>
            <p className={`text-[12.5px] leading-relaxed ${MUTED}`}>
              If a clinic already exists, open the claim link you were sent. If not, open one now: it
              takes a name and an email, and needs no card.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/clinic/start" className={primaryButton}>
              Open a clinic
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/clinic/join" className={quietButton}>
              I have a claim link
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pb-10">
        <ClinicMasthead
          eyebrow={
            <>
              Clinic desk / {organization?.slug ?? orgId}
              <span className="mx-1.5 text-ink-3">/</span>
              {organization?.timezone ?? 'UTC'}
            </>
          }
          title={organization?.name ?? 'Loading clinic…'}
          lede="Everything here is scoped to this organization. Issued codes and invites are shown once and stored only as digests."
          aside={
            <button type="button" onClick={() => void load()} className={quietButton}>
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          }
        />

        {loadError && (
          <Notice tone="error" title="Clinic unavailable" role="alert">
            {loadError}
          </Notice>
        )}

        {loading && !organization ? (
          <div className={`flex items-center gap-2 px-1 py-6 text-[12px] ${MUTED}`}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Reading the clinic…
          </div>
        ) : (
          <>
            <IdentitySection organization={organization} onSaved={(next) => setOrganization(next)} />

            <TeamSection
              orgId={orgId}
              members={members}
              onInvited={(member) =>
                setMembers((prev) =>
                  prev.some((item) => item.id === member.id) ? prev : [...prev, member]
                )
              }
            />

            <EnrolmentSection
              orgId={orgId}
              codes={codes}
              onIssued={(code) =>
                setCodes((prev) =>
                  prev.some((item) => item.id === code.id) ? prev : [code, ...prev]
                )
              }
              onRevoked={(code) =>
                setCodes((prev) => prev.map((item) => (item.id === code.id ? code : item)))
              }
            />
          </>
        )}
      </div>
    </Layout>
  );
}

/* ------------------------------------------------------------------------- */
/* 1. Who the clinic is                                                       */
/* ------------------------------------------------------------------------- */

function IdentitySection({
  organization,
  onSaved
}: {
  organization: ClinicOrganization | null;
  onSaved: (next: ClinicOrganization) => void;
}) {
  const [brandColor, setBrandColor] = useState(organization?.brandColor ?? '#0F4C81');
  const [logoUrl, setLogoUrl] = useState(organization?.logoUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBrandColor(organization?.brandColor ?? '#0F4C81');
    setLogoUrl(organization?.logoUrl ?? '');
  }, [organization?.brandColor, organization?.logoUrl]);

  if (!organization) return null;

  const orgId = organization.id;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateBranding(orgId, {
        brandColor: brandColor || null,
        logoUrl: logoUrl.trim() || null
      });
      onSaved(result.organization);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? 'Only an owner or admin can change the clinic’s identity.'
          : err instanceof ApiError
            ? err.message
            : 'Could not save the branding.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Identity"
      description="The name and colour patients see when this clinic contacts them."
    >
      {error && (
        <Notice tone="error" title="Not saved" role="alert">
          {error}
        </Notice>
      )}
      {saved && !error && (
        <Notice tone="success" title="Saved" role="status">
          Patient-facing artefacts will use this brand colour.
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Clinic name" htmlFor="admin-org-name" hint="Changing the name is not enabled here.">
          <input id="admin-org-name" className={inputClass} value={organization.name} readOnly disabled />
        </Field>

        <Field label="Brand colour" htmlFor="admin-brand" hint="Hex value, e.g. #0F4C81.">
          <div className="flex items-center gap-2.5">
            <input
              id="admin-brand"
              type="color"
              aria-label="Brand colour"
              className="h-10 w-12 cursor-pointer rounded-[8px] border border-rule-strong bg-paper p-1"
              value={/^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : '#0F4C81'}
              onChange={(e) => setBrandColor(e.target.value)}
            />
            <input
              aria-label="Brand colour hex value"
              className={`${inputClass} max-w-[140px] font-mono uppercase`}
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              maxLength={9}
            />
          </div>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Logo URL" htmlFor="admin-logo" hint="Optional. A square HTTPS image reads best.">
          <input
            id="admin-logo"
            className={inputClass}
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.png"
            maxLength={2048}
          />
        </Field>
      </div>

      <div className="mt-4">
        <button type="button" onClick={save} className={primaryButton} disabled={saving}>
          {saving ? 'Saving…' : 'Save identity'}
        </button>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------------- */
/* 2. Who works here                                                          */
/* ------------------------------------------------------------------------- */

function TeamSection({
  orgId,
  members,
  onInvited
}: {
  orgId: string;
  members: ClinicMember[];
  onInvited: (member: ClinicMember) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('admin');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ url: string; email: string; expiresAt: string } | null>(null);

  async function invite() {
    if (!email.trim() || inviting) return;
    setInviting(true);
    setError(null);
    setIssued(null);
    try {
      const result = await inviteMember(orgId, { email: email.trim(), role });
      setIssued({
        url: inviteUrl(result.invite.token),
        email: result.invite.email,
        expiresAt: result.invite.expiresAt
      });
      onInvited(result.member);
      setEmail('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Only an owner or admin can invite clinicians.');
      } else if (err instanceof ApiError && err.code === 'MEMBER_ALREADY_EXISTS') {
        setError('That email is already a member of this clinic.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not issue the invite.');
      }
    } finally {
      setInviting(false);
    }
  }

  return (
    <SectionCard
      title="Team"
      description="Everyone who can see this clinic’s schedule and care loop."
    >
      {members.length === 0 ? (
        <p className={`text-[12px] ${MUTED}`}>No members yet.</p>
      ) : (
        <ul className={`divide-y divide-rule border-y ${RULE}`}>
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <div className="min-w-0">
                <p className={`truncate text-[12.5px] ${INK}`}>{member.email}</p>
                <p className={`font-mono text-[10px] uppercase tracking-[0.12em] ${FAINT}`}>
                  {ROLE_LABEL[member.role] ?? member.role}
                  <span className="mx-1.5 text-ink-3">·</span>
                  {member.acceptedAt ? `joined ${formatDate(member.acceptedAt)}` : 'invited'}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                  member.status === 'active'
                    ? 'bg-settled-wash text-settled'
                    : 'bg-paper-2 text-ink-2'
                }`}
              >
                {member.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={`mt-4 rounded-[10px] border ${RULE} bg-canvas p-3.5`}>
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-3.5 w-3.5 text-ink-3" />
          <span className={`font-mono text-[9px] uppercase tracking-[0.16em] ${FAINT}`}>
            Invite a colleague
          </span>
        </div>

        {error && (
          <Notice tone="error" title="Invite not issued" role="alert">
            {error}
          </Notice>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Their email" htmlFor="invite-email">
            <input
              id="invite-email"
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              maxLength={254}
            />
          </Field>
          <Field label="Role" htmlFor="invite-role">
            <select
              id="invite-role"
              className={inputClass}
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </Field>
        </div>

        <div className="mt-3">
          <button type="button" onClick={invite} className={quietButton} disabled={inviting || !email.trim()}>
            {inviting ? 'Issuing…' : 'Issue claim link'}
          </button>
        </div>

        {issued && (
          <div className="mt-3">
            <SecretReveal
              label="Claim link (shown once)"
              value={issued.url}
              hint={`For ${issued.email}. Expires ${new Date(issued.expiresAt).toLocaleString()}. There is no second copy.`}
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------------- */
/* 3. How a patient joins                                                     */
/* ------------------------------------------------------------------------- */

function EnrolmentSection({
  orgId,
  codes,
  onIssued,
  onRevoked
}: {
  orgId: string;
  codes: ClinicLinkCode[];
  onIssued: (code: ClinicLinkCode) => void;
  onRevoked: (code: ClinicLinkCode) => void;
}) {
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [ttlDays, setTtlDays] = useState(30);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function issue() {
    if (issuing) return;
    setIssuing(true);
    setError(null);
    setFresh(null);
    try {
      const result = await issueLinkCode(orgId, {
        label: label.trim() || undefined,
        maxUses,
        ttlDays
      });
      setFresh(result.code);
      onIssued(result.clinicCode);
      setLabel('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('Only an owner or admin can issue patient codes.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not issue a code.');
      }
    } finally {
      setIssuing(false);
    }
  }

  async function revoke(code: ClinicLinkCode) {
    setRevoking(code.id);
    setError(null);
    try {
      const result = await revokeLinkCode(orgId, code.id);
      onRevoked(result.clinicCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke that code.');
    } finally {
      setRevoking(null);
    }
  }

  return (
    <SectionCard
      title="Patient enrolment"
      description="A patient types one of these codes in the phone app to join this clinic. Each use is counted against its limit."
    >
      {error && (
        <Notice tone="error" title="Code action failed" role="alert">
          {error}
        </Notice>
      )}

      {fresh && (
        <div className="mb-4">
          <SecretReveal
            label="New clinic code (shown once)"
            value={fresh}
            large
            hint="Stored only as a digest. Read it to the patient now; if it is lost, issue another and revoke this one."
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px_110px]">
        <Field label="Label" htmlFor="code-label" hint="Optional: who it is for.">
          <input
            id="code-label"
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Front desk, week 1"
            maxLength={120}
          />
        </Field>
        <Field label="Uses" htmlFor="code-uses">
          <input
            id="code-uses"
            type="number"
            min={1}
            max={500}
            className={inputClass}
            value={maxUses}
            onChange={(e) => setMaxUses(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
          />
        </Field>
        <Field label="Valid for" htmlFor="code-ttl" hint="Days.">
          <input
            id="code-ttl"
            type="number"
            min={1}
            max={365}
            className={inputClass}
            value={ttlDays}
            onChange={(e) => setTtlDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
          />
        </Field>
      </div>

      <div className="mt-3">
        <button type="button" onClick={issue} className={primaryButton} disabled={issuing}>
          {issuing ? 'Issuing…' : 'Issue a clinic code'}
        </button>
      </div>

      <div className="mt-5">
        <p className={`mb-2 font-mono text-[9px] uppercase tracking-[0.16em] ${FAINT}`}>
          Issued codes
        </p>
        {codes.length === 0 ? (
          <p className={`text-[12px] ${MUTED}`}>None yet. A new clinic has no way for patients to join.</p>
        ) : (
          <ul className={`divide-y divide-rule border-y ${RULE}`}>
            {codes.map((code) => {
              const state = code.revokedAt
                ? 'revoked'
                : code.expired
                  ? 'expired'
                  : code.exhausted
                    ? 'used up'
                    : 'usable';
              return (
                <li key={code.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                  <div className="min-w-0">
                    <p className={`truncate text-[12.5px] ${INK}`}>
                      {code.label || <span className={MUTED}>Untitled code</span>}
                    </p>
                    <p className={`font-mono text-[10px] uppercase tracking-[0.12em] ${FAINT}`}>
                      {code.uses}/{code.maxUses} used
                      <span className="mx-1.5 text-ink-3">·</span>
                      expires {formatDate(code.expiresAt)}
                      {code.lastUsedAt && (
                        <>
                          <span className="mx-1.5 text-ink-3">·</span>
                          last {formatDate(code.lastUsedAt)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                        code.usable ? 'bg-settled-wash text-settled' : 'bg-paper-2 text-ink-2'
                      }`}
                    >
                      {state}
                    </span>
                    {!code.revokedAt && (
                      <button
                        type="button"
                        onClick={() => void revoke(code)}
                        className={quietButton}
                        disabled={revoking === code.id}
                      >
                        {revoking === code.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className={`mt-4 flex items-start gap-2 text-[11px] leading-relaxed ${MUTED}`}>
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-settled" />
        A code only proves the patient was given it. Their identity still comes from the one-time code sent
        to their own email; the clinic code alone cannot open anyone’s record.
      </p>
    </SectionCard>
  );
}

/* Kept beside the sections that use it so the audit trail reads in one place. */
export function ClinicAdminBoundaryNote() {
  return (
    <p className={`flex items-start gap-2 text-[11px] leading-relaxed ${MUTED}`}>
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-caution" />
      Cross-tenant reads are refused by the API, not by this page.
    </p>
  );
}
