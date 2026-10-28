/**
 * Open a clinic — the public half of organization onboarding.
 *
 * This is the one write surface in the product that does not require a session
 * (`POST /api/organizations`), because a hospital has to exist before any
 * clinician account can be invited into it. The API rate-limits it to 10
 * attempts per IP per 15 minutes and stores only a digest of the invite token.
 *
 * The screen does one thing and then gets out of the way: it creates the
 * organization and hands back the single claim link that the first clinician
 * must open. That link is the only copy — losing it means issuing a new invite
 * from the desk, not recovering this one.
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2 } from 'lucide-react';
import { ApiError } from '../lib/api';
import { createOrganization, inviteUrl, type CreatedOrganization } from '../lib/clinicOrgApi';
import {
  ClinicMasthead,
  Field,
  Notice,
  SecretReveal,
  inputClass,
  primaryButton,
  quietButton,
  FAINT,
  INK,
  MUTED,
  RULE
} from '../components/clinic/ClinicChrome';

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function ClinicStart() {
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [timezone, setTimezone] = useState(browserTimezone);
  const [brandColor, setBrandColor] = useState('#0F4C81');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedOrganization | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await createOrganization({
        name: name.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerName: ownerName.trim() || undefined,
        countryCode: countryCode.trim().toUpperCase() || undefined,
        timezone: timezone.trim() || undefined,
        brandColor: brandColor || undefined
      });
      setCreated(result);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ORGANIZATION_PROVISION_RATE_LIMITED') {
        setError(
          'Too many clinics were opened from this network in the last 15 minutes. Wait a few minutes, then try again.'
        );
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not reach the clinic service. Check the API address and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas px-5 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="mb-9 flex items-center justify-between gap-3">
          <Link to="/welcome" className="flex items-center gap-2.5" aria-label="Proton home">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-solid text-sm font-bold text-white">
              p
            </span>
            <span className="text-[15px] font-semibold lowercase tracking-[-0.03em] text-ink">proton</span>
          </Link>
          <Link to="/login" className="text-[12px] font-medium text-ink-2 underline-offset-4 hover:underline">
            Already have a clinic? Sign in
          </Link>
        </div>

        {created ? (
          <CreatedClinic created={created} />
        ) : (
          <>
            <ClinicMasthead
              eyebrow={<>Clinic onboarding / step 1 of 3</>}
              title="Open a clinic."
              lede="This creates the organization that owns the schedule, the care loop and every patient record attached to it. You will claim it in the next step by signing in as its first clinician."
            />

            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              {error && (
                <Notice tone="error" title="Clinic was not created" role="alert">
                  {error}
                </Notice>
              )}

              <div className={`rounded-[12px] border ${RULE} bg-paper p-4 sm:p-5`}>
                <div className="mb-4 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-ink-3" />
                  <span className={`font-mono text-[9px] uppercase tracking-[0.16em] ${FAINT}`}>The clinic</span>
                </div>

                <div className="space-y-4">
                  <Field label="Clinic name" htmlFor="clinic-name" hint="Patients see this name on every message.">
                    <input
                      id="clinic-name"
                      name="name"
                      className={inputClass}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Beacon Hill Family Health"
                      autoComplete="organization"
                      required
                      maxLength={200}
                      autoFocus
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Country" htmlFor="clinic-country" hint="Two-letter ISO code, optional.">
                      <input
                        id="clinic-country"
                        name="countryCode"
                        className={`${inputClass} uppercase`}
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                        placeholder="IN"
                        maxLength={3}
                        autoComplete="country"
                      />
                    </Field>

                    <Field label="Time zone" htmlFor="clinic-timezone" hint="Used for the schedule and reminders.">
                      <input
                        id="clinic-timezone"
                        name="timezone"
                        className={inputClass}
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        placeholder="Asia/Kolkata"
                        maxLength={64}
                      />
                    </Field>
                  </div>

                  <Field
                    label="Brand colour"
                    htmlFor="clinic-brand"
                    hint="Appears on the patient-facing artefacts issued by this clinic."
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        id="clinic-brand"
                        name="brandColor"
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
              </div>

              <div className={`rounded-[12px] border ${RULE} bg-paper p-4 sm:p-5`}>
                <div className="mb-4 flex items-center gap-2">
                  <span className={`font-mono text-[9px] uppercase tracking-[0.16em] ${FAINT}`}>
                    The first clinician (owner)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Their name"
                    htmlFor="clinic-owner-name"
                    hint="Optional; shown to patients."
                  >
                    <input
                      id="clinic-owner-name"
                      name="ownerName"
                      className={inputClass}
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Dr. Maya Lin"
                      autoComplete="name"
                      maxLength={120}
                    />
                  </Field>

                  <Field
                    label="Their email"
                    htmlFor="clinic-owner-email"
                    hint="Must match the identity they sign in with."
                  >
                    <input
                      id="clinic-owner-email"
                      name="ownerEmail"
                      type="email"
                      className={inputClass}
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="dr.lin@example.com"
                      autoComplete="email"
                      required
                      maxLength={254}
                    />
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className={primaryButton} disabled={submitting || !name.trim() || !ownerEmail.trim()}>
                  {submitting ? 'Creating clinic…' : 'Create clinic'}
                  {!submitting && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
                <p className={`text-[11.5px] leading-relaxed ${MUTED}`}>
                  No card, no session required. Synthetic data only until a BAA exists.
                </p>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function CreatedClinic({ created }: { created: CreatedOrganization }) {
  const { organization, invite } = created;
  const url = inviteUrl(invite.token);

  return (
    <>
      <ClinicMasthead
        eyebrow={<>Clinic onboarding / step 2 of 3</>}
        title="The clinic exists."
        lede={`${organization.name} is provisioned. Send the claim link below to its first clinician — they sign in, open it, and the clinic becomes theirs.`}
        aside={
          <p className={`font-mono text-[9.5px] uppercase tracking-[0.16em] ${FAINT}`}>
            slug / {organization.slug}
          </p>
        }
      />

      <Notice tone="note" title="Send this now — it is shown once">
        The server stores only a digest of this link. It cannot be shown again; if it is lost, issue a
        fresh invite from the clinic desk.
      </Notice>

      <div className="mb-5">
        <SecretReveal
          label="Claim link"
          value={url}
          hint={`Single use. Expires ${new Date(invite.expiresAt).toLocaleString()}. Address it to ${invite.email}.`}
        />
      </div>

      <div className={`mb-6 rounded-[12px] border ${RULE} bg-paper p-4`}>
        <p className={`font-mono text-[9px] uppercase tracking-[0.16em] ${FAINT}`}>What happens next</p>
        <ol className={`mt-3 space-y-2 text-[12px] leading-relaxed ${MUTED}`}>
          <li>
            <span className={`font-mono ${INK}`}>1.</span> The clinician signs in with their clinical
            identity (Medplum) — not a demo password.
          </li>
          <li>
            <span className={`font-mono ${INK}`}>2.</span> They open the link and claim the clinic; the
            session they get is bound to this organization.
          </li>
          <li>
            <span className={`font-mono ${INK}`}>3.</span> They issue a six-character code and the first
            patient enrols from the phone app.
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/clinic/join?invite=${encodeURIComponent(invite.token)}`} className={primaryButton}>
          Open the claim link myself
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link to="/clinic/start" className={quietButton}>
          Open another clinic
        </Link>
      </div>
    </>
  );
}
