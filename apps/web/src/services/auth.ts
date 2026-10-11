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
  isAuthenticated(): boolean;
  getAuthMode(): AuthMode;
}

class ProtonAuthenticationService implements IAuthenticationService {
  private currentUser: ProtonDoctorUser | null = null;

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      const stored = sessionStorage.getItem('proton_auth_session');
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch {
      this.currentUser = null;
    }
  }

  public getAuthMode(): AuthMode {
    if (import.meta.env?.VITE_AUTH_PROVIDER === 'supabase') {
      return 'supabase';
    }
    return 'synthetic_development';
  }

  public isAuthenticated(): boolean {
    return !!this.currentUser || !!medplum.getProfile();
  }

  public getCurrentUser(): ProtonDoctorUser | null {
    if (this.currentUser) return this.currentUser;

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
    const res = await medplum.startLogin({ email, password });
    if (res.code) {
      await medplum.processCode(res.code);
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
    await medplum.signOut();
  }
}

export const authService = new ProtonAuthenticationService();
