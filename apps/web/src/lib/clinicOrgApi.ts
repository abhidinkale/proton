/**
 * Clinic (organization) client.
 *
 * Talks to `/api/organizations/*`. These routes already enforce the tenant
 * boundary server-side — `orgId` always comes from the URL, the actor must
 * carry the same tenant claim, and a `/health`-style probe without a session is
 * rejected. Nothing here re-implements that; it only types it.
 *
 * Two of these calls return a secret exactly once and never again:
 *
 *   - `createOrganization` / `inviteMember` → the invite `token`
 *   - `issueLinkCode`                       → the six-character patient `code`
 *
 * The server stores only a digest, so a lost secret means re-issuing, not
 * recovering. Every screen that shows one says so.
 */

import { apiJson } from './api';

export interface ClinicOrganization {
  id: string;
  name: string;
  slug: string;
  countryCode: string | null;
  timezone: string;
  logoUrl: string | null;
  brandColor: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export type OrgRole = 'owner' | 'admin' | 'member';

export interface ClinicMember {
  id: string;
  userId: string | null;
  email: string;
  role: OrgRole;
  status: string;
  invitedAt: string | null;
  acceptedAt: string | null;
}

export interface ClinicInvite {
  id: string;
  orgId: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
  token: string;
}

export interface ClinicLinkCode {
  id: string;
  label: string | null;
  uses: number;
  maxUses: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  exhausted: boolean;
  expired: boolean;
  usable: boolean;
}

export interface CreatedOrganization {
  organization: ClinicOrganization;
  owner: ClinicMember;
  invite: ClinicInvite;
}

export interface ClaimedInvite {
  organization: ClinicOrganization;
  member: ClinicMember;
  session: {
    token: string;
    tokenType: 'Bearer';
    tenantId: string;
    role: OrgRole;
  } | null;
}

export interface CreateOrganizationInput {
  name: string;
  ownerEmail: string;
  ownerName?: string;
  countryCode?: string;
  timezone?: string;
  brandColor?: string;
  logoUrl?: string;
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

/** Public: a hospital can open a clinic before any account exists. */
export async function createOrganization(input: CreateOrganizationInput): Promise<CreatedOrganization> {
  return apiJson<CreatedOrganization>('/api/organizations', jsonBody(input));
}

/** Authenticated: the signed-in clinician claims the membership. */
export async function claimInvite(token: string): Promise<ClaimedInvite> {
  return apiJson<ClaimedInvite>('/api/organizations/accept-invite', jsonBody({ token }));
}

export async function getOrganization(
  orgId: string
): Promise<{ organization: ClinicOrganization; members: ClinicMember[] }> {
  return apiJson(`/api/organizations/${encodeURIComponent(orgId)}`);
}

export async function updateBranding(
  orgId: string,
  patch: { brandColor?: string | null; logoUrl?: string | null }
): Promise<{ organization: ClinicOrganization }> {
  return apiJson(`/api/organizations/${encodeURIComponent(orgId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
}

export async function inviteMember(
  orgId: string,
  input: { email: string; role: OrgRole }
): Promise<{ invite: ClinicInvite; member: ClinicMember }> {
  return apiJson(`/api/organizations/${encodeURIComponent(orgId)}/invites`, jsonBody(input));
}

export async function issueLinkCode(
  orgId: string,
  input: { label?: string; maxUses?: number; ttlDays?: number }
): Promise<{ code: string; clinicCode: ClinicLinkCode; organization: ClinicOrganization }> {
  return apiJson(`/api/organizations/${encodeURIComponent(orgId)}/link-codes`, jsonBody(input));
}

export async function listLinkCodes(
  orgId: string,
  includeRevoked = false
): Promise<{ codes: ClinicLinkCode[] }> {
  const query = includeRevoked ? '?includeRevoked=true' : '';
  return apiJson(`/api/organizations/${encodeURIComponent(orgId)}/link-codes${query}`);
}

export async function revokeLinkCode(
  orgId: string,
  codeId: string
): Promise<{ clinicCode: ClinicLinkCode }> {
  return apiJson(`/api/organizations/${encodeURIComponent(orgId)}/link-codes/${encodeURIComponent(codeId)}`, {
    method: 'DELETE'
  });
}

/**
 * The URL a clinician opens to claim a membership. The token is single-use and
 * expiring, which is what makes it safe to paste into an email.
 */
export function inviteUrl(token: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/clinic/join?invite=${encodeURIComponent(token)}`;
}

export const PENDING_INVITE_KEY = 'proton_pending_invite';

/** Survives the round trip through the identity provider without a long URL. */
export function rememberPendingInvite(token: string): void {
  try {
    window.sessionStorage.setItem(PENDING_INVITE_KEY, token);
  } catch {
    // Private mode: the query parameter is still on the URL.
  }
}

export function readPendingInvite(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_INVITE_KEY);
  } catch {
    return null;
  }
}

export function forgetPendingInvite(): void {
  try {
    window.sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Nothing to clear.
  }
}
