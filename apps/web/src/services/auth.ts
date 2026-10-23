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
   * Authenticate physician using the configured boundary.
   * In synthetic beta mode, verifies against Medplum local/hosted instance.
   */
  public async login(credentials: LoginCredentials): Promise<ProtonDoctorUser> {
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
    this.currentUser = null;
    sessionStorage.removeItem('proton_auth_session');
    localStorage.removeItem('proton_auth_session');
    await medplum.signOut();
  }
}

export const authService = new ProtonAuthenticationService();
