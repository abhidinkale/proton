/**
 * Proton Physician Authentication Boundary
 * 
 * Provides an architectural boundary separating frontend doctor identity
 * from raw Medplum/FHIR access.
 * 
 * Target Enterprise Hierarchy:
 * Authenticated Doctor (OAuth / Supabase / OIDC)
 *    ↓
 * Proton User Profile (Claims & Role)
 *    ↓
 * Medplum Practitioner (Scoped FHIR Identity)
 *    ↓
 * Authorized Patients (Server-enforced access boundary)
 */

import { medplum } from '../lib/medplum';
import { telemetry } from './telemetry';
import { SYNTHETIC_AUTH_FALLBACK } from '../config';
import { API_BASE_URL } from '../config';
import { clearSessionToken, getSessionToken, setSessionToken } from '../lib/sessionToken';

export type AuthMode = 'synthetic_development' | 'supabase' | 'oidc';

export interface ProtonDoctorUser {
  id: string;
  email: string;
  displayName: string;
  role: 'attending_physician' | 'resident' | 'clinical_evaluator';
  organizationId: string;
  practitionerReference?: string;
  authMode: AuthMode;
  isSyntheticEvaluator: boolean;
  npi?: string;
  specialty?: string;
}

export interface AuthSessionState {
  isAuthenticated: boolean;
  user: ProtonDoctorUser | null;
  mode: AuthMode;
  token?: string;
  error?: string | null;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  token?: string;
}

export interface IAuthenticationService {
  login(credentials: LoginCredentials): Promise<ProtonDoctorUser>;
  logout(): Promise<void>;
  getCurrentUser(): ProtonDoctorUser | null;
  setSessionUser(user: ProtonDoctorUser): void;
  isAuthenticated(): boolean;
  getAuthMode(): AuthMode;
  ensureProtonSession(): Promise<boolean>;
}

class ProtonAuthenticationService implements IAuthenticationService {
  private currentUser: ProtonDoctorUser | null = null;

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): ProtonDoctorUser | null {
    try {
      const stored = sessionStorage.getItem('proton_auth_session') || localStorage.getItem('proton_auth_session');
      if (stored) {
        this.currentUser = JSON.parse(stored);
        return this.currentUser;
      }
    } catch {
      this.currentUser = null;
    }
    return null;
  }

  public setSessionUser(user: ProtonDoctorUser): void {
    this.currentUser = user;
    try {
      sessionStorage.setItem('proton_auth_session', JSON.stringify(user));
      localStorage.setItem('proton_auth_session', JSON.stringify(user));
    } catch {
      // storage unavailable
    }
  }

  public getAuthMode(): AuthMode {
    if (import.meta.env?.VITE_AUTH_PROVIDER === 'supabase') {
      return 'supabase';
    }
    return 'synthetic_development';
  }

  /**
   * Trades a Medplum OIDC access token for a Proton clinical session token.
   * The exchange is server-side; this client only forwards its own IdP token.
   */
  private async exchangeMedplumToken(accessToken: string): Promise<{ token: string; actor?: { actorName?: string } }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken })
    });

    const body = await response.json().catch(() => null) as
      | { token?: string; actor?: { actorName?: string }; error?: string; code?: string }
      | null;

    if (!response.ok || !body || typeof body.token !== 'string') {
      const error = new Error(body?.error || `Proton session exchange failed (HTTP ${response.status})`);
      (error as Error & { code?: string }).code = body?.code || 'SESSION_EXCHANGE_FAILED';
      throw error;
    }

    setSessionToken(body.token);
    return { token: body.token, actor: body.actor };
  }

  /**
   * Heals sessions created before the Proton token bridge existed (or in a new
   * tab): if Medplum still holds an access token, re-derive the API credential.
   */
  public async ensureProtonSession(): Promise<boolean> {
    if (getSessionToken()) return true;

    const accessToken = medplum.getAccessToken();
    if (!accessToken) return false;

    try {
      await this.exchangeMedplumToken(accessToken);
      return true;
    } catch (err) {
      console.warn('Proton API session could not be established:', (err as Error).message);
      return false;
    }
  }

  public isAuthenticated(): boolean {
    return !!this.getCurrentUser() || !!medplum.getProfile();
  }

  public getCurrentUser(): ProtonDoctorUser | null {
    if (this.currentUser) return this.currentUser;

    const restored = this.restoreSession();
    if (restored) return restored;

    const medplumProfile = medplum.getProfile();
    if (medplumProfile) {
      const email = (medplumProfile as any).email || (medplumProfile as any).name?.[0]?.text || 'doctor@proton.local';
      const name = (medplumProfile as any).name?.[0]?.given?.join(' ') 
        ? `${(medplumProfile as any).name[0].given.join(' ')} ${(medplumProfile as any).name[0].family || ''}`.trim()
        : 'Dr. Physician';

      const syntheticUser: ProtonDoctorUser = {
        id: medplumProfile.id || 'dev-physician',
        email,
        displayName: name.startsWith('Dr.') ? name : `Dr. ${name}`,
        role: 'attending_physician',
        organizationId: 'proton-synthetic-beta-org',
        practitionerReference: `Practitioner/${medplumProfile.id}`,
        authMode: 'synthetic_development',
        isSyntheticEvaluator: true
      };
      this.currentUser = syntheticUser;
      sessionStorage.setItem('proton_auth_session', JSON.stringify(syntheticUser));
      localStorage.setItem('proton_auth_session', JSON.stringify(syntheticUser));
      return syntheticUser;
    }

    return null;
  }

  /**
   * Real credential sign-in against the Proton session API.
   *
   * This is the primary path: the API verifies the password hash with a
   * timing-safe comparison and returns a signed, revocable session token. The
   * browser stores that token and every subsequent clinical call is scoped to
   * the verified actor and tenant.
   */
  public async loginWithCredentials(email: string, password: string): Promise<ProtonDoctorUser> {
    if (!email) throw new Error('Email is required');
    if (!password) throw new Error('Password is required');

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
    } catch {
      throw new Error(
        `The Proton clinical API is unreachable at ${API_BASE_URL}. Start it with "npm run dev" in apps/api, then try again.`
      );
    }

    const body = await response.json().catch(() => null) as {
      success?: boolean;
      token?: string;
      actor?: { actorId?: string; actorRole?: string; actorName?: string; tenantId?: string; npi?: string | null };
      error?: string;
      code?: string;
      mfaRequired?: boolean;
    } | null;

    if (!response.ok || !body?.success || typeof body.token !== 'string') {
      const message = body?.mfaRequired
        ? 'Multi-factor authentication is required for this account, but no MFA challenge was completed.'
        : (body?.error || `Sign-in failed (HTTP ${response.status}).`);
      throw new Error(message);
    }

    setSessionToken(body.token);

    const actor = body.actor || {};
    const role: ProtonDoctorUser['role'] =
      actor.actorRole === 'physician' ? 'attending_physician'
        : actor.actorRole === 'resident' ? 'resident'
          : 'clinical_evaluator';

    const user: ProtonDoctorUser = {
      id: actor.actorId || 'proton-user',
      email,
      displayName: actor.actorName || email.split('@')[0],
      role,
      organizationId: actor.tenantId || 'org-default',
      practitionerReference: actor.actorId ? `Practitioner/${actor.actorId}` : undefined,
      authMode: 'synthetic_development',
      isSyntheticEvaluator: true,
      npi: actor.npi || undefined
    };

    this.setSessionUser(user);

    telemetry.track('physician_login', {
      status: 'success',
      provider: 'proton_session_api'
    });

    return user;
  }

  /** One-click evaluation pass. Still performs a real, revocable login. */
  public async loginDemo(): Promise<ProtonDoctorUser> {
    return this.loginWithCredentials('dr.lin@proton.health', 'valid_password_2026!');
  }

  /**
   * Authenticate physician using the configured boundary.
   *
   * The Proton credential API is authoritative. Medplum OIDC is only used when
   * the deployment explicitly opts into it with VITE_AUTH_PROVIDER=medplum.
   */
  public async login(credentials: LoginCredentials): Promise<ProtonDoctorUser> {
    if (import.meta.env?.VITE_AUTH_PROVIDER === 'medplum') {
      return this.loginWithMedplum(credentials);
    }
    if (!credentials.email) throw new Error('Email is required');
    if (!credentials.password) throw new Error('Password is required');
    return this.loginWithCredentials(credentials.email, credentials.password);
  }

  private async loginWithMedplum(credentials: LoginCredentials): Promise<ProtonDoctorUser> {
    const { email, password } = credentials;
    if (!email) throw new Error('Email is required');
    if (!password) throw new Error('Password is required');

    // 1. Authenticate with underlying identity provider (Medplum in current architecture)
    let res: any;
    try {
      res = await medplum.startLogin({ email, password });
    } catch (err: any) {
      if (err?._remainingPoints === '0' || err?._remainingPoints === 0 || err?.message?.includes('Too Many Requests')) {
        const ms = err?._msBeforeNext ? Number(err._msBeforeNext) : 30000;
        const seconds = Math.ceil(ms / 1000);
        throw new Error(`Authentication rate limit reached. Please wait ${seconds} seconds before trying again.`);
      }

      // If Medplum server is unreachable (e.g. deployed on Vercel without local Medplum),
      // allow synthetic beta physician credentials to enter evaluation mode.
      // INVARIANT: only when VITE_SYNTHETIC_MODE explicitly enables the fallback.
      const isNetworkError = err?.name === 'TypeError' || 
        err?.message?.includes('Failed to fetch') || 
        err?.message?.includes('NetworkError') ||
        err?.message?.includes('Load failed');

      if (isNetworkError && SYNTHETIC_AUTH_FALLBACK &&
          (email === 'admin@example.com' || email.includes('admin') || email.includes('doctor'))) {
        console.warn('Medplum server unreachable. Activating synthetic evaluation physician session.');
        const syntheticUser: ProtonDoctorUser = {
          id: 'synthetic-evaluator-physician',
          email,
          displayName: 'Dr. Physician (Evaluation Beta)',
          role: 'attending_physician',
          organizationId: 'proton-synthetic-beta-org',
          practitionerReference: 'Practitioner/synthetic-evaluator-physician',
          authMode: 'synthetic_development',
          isSyntheticEvaluator: true
        };
        this.currentUser = syntheticUser;
        sessionStorage.setItem('proton_auth_session', JSON.stringify(syntheticUser));
        return syntheticUser;
      }

      throw err;
    }

    if (res?.code) {
      await medplum.processCode(res.code);
    } else if (res?.memberships && res.memberships.length > 0) {
      // Find Proton Development or first active membership
      const targetMembership = res.memberships.find((m: any) => 
        m.project?.display?.toLowerCase().includes('proton')
      ) || res.memberships[0];

      const profileRes = await medplum.post('auth/profile', {
        login: res.login,
        profile: targetMembership.id
      });
      if (profileRes?.code) {
        await medplum.processCode(profileRes.code);
      }
    } else {
      throw new Error('Authentication response did not contain an authorization code or project memberships.');
    }

    // 2. Map authenticated identity to Proton Doctor Profile
    const profile = medplum.getProfile();
    const displayName = (profile as any)?.name?.[0]?.given?.join(' ')
      ? `${(profile as any).name[0].given.join(' ')} ${(profile as any).name[0].family || ''}`.trim()
      : email.split('@')[0].replace('.', ' ');

    const doctorUser: ProtonDoctorUser = {
      id: profile?.id || 'evaluator-id',
      email,
      displayName: displayName.startsWith('Dr.') ? displayName : `Dr. ${displayName}`,
      role: 'attending_physician',
      organizationId: 'proton-synthetic-beta-org',
      practitionerReference: profile?.id ? `Practitioner/${profile.id}` : undefined,
      authMode: this.getAuthMode(),
      isSyntheticEvaluator: true
    };

    // 3. Bridge the Medplum identity into a Proton API session. Without this the
    //    shell renders but every clinical API call returns 401.
    const medplumAccessToken = medplum.getAccessToken();
    if (medplumAccessToken) {
      try {
        const exchanged = await this.exchangeMedplumToken(medplumAccessToken);
        if (exchanged.actor?.actorName) {
          doctorUser.displayName = exchanged.actor.actorName;
        }
      } catch (err) {
        if (!SYNTHETIC_AUTH_FALLBACK) {
          throw new Error(
            'Signed in to the identity provider, but Proton could not establish a clinical API session. ' +
            'Verify MEDPLUM_BASE_URL and the API deployment, then try again.'
          );
        }
        console.warn('Proton API session exchange unavailable; continuing in evaluation mode:', (err as Error).message);
      }
    } else if (!SYNTHETIC_AUTH_FALLBACK) {
      throw new Error('The identity provider did not return an API access token. Cannot establish a clinical session.');
    }

    this.currentUser = doctorUser;
    sessionStorage.setItem('proton_auth_session', JSON.stringify(doctorUser));

    telemetry.track('physician_login', {
      status: 'success',
      provider: this.getAuthMode()
    });

    return doctorUser;
  }

  public async logout(): Promise<void> {
    telemetry.track('physician_logout', { status: 'success' });

    const token = getSessionToken();
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ token })
        });
      } catch {
        // Revocation is best-effort offline; the local credential is still cleared.
      }
    }

    this.currentUser = null;
    clearSessionToken();
    sessionStorage.removeItem('proton_auth_session');
    localStorage.removeItem('proton_auth_session');
    await medplum.signOut();
  }
}

export const authService = new ProtonAuthenticationService();
