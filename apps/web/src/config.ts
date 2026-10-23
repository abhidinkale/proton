/**
 * Proton Web Application Configuration
 * Resolves API and Medplum endpoints from environment variables with safe development fallbacks.
 * In production on Vercel:
 * - VITE_API_URL: Deployed API URL (e.g. https://api-proton.vercel.app) or "" for same-domain /api routing.
 * - VITE_MEDPLUM_BASE_URL: Accessible Medplum server endpoint (e.g. Medplum Cloud or HTTPS instance).
 */

export const API_BASE_URL = (
  typeof import.meta.env.VITE_API_URL === 'string'
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:3002'
).replace(/\/+$/, '');

export const MEDPLUM_BASE_URL = (
  typeof import.meta.env.VITE_MEDPLUM_BASE_URL === 'string' && import.meta.env.VITE_MEDPLUM_BASE_URL.trim() !== ''
    ? import.meta.env.VITE_MEDPLUM_BASE_URL
    : 'http://localhost:8103/'
).replace(/\/+$/, '') + '/';

export const MEDPLUM_CLIENT_ID = import.meta.env.VITE_MEDPLUM_CLIENT_ID || undefined;

/**
 * Synthetic evaluation data mode. Proton's beta operates on synthetic patient
 * cohorts; this flag describes the data class, not the auth posture.
 */
export const IS_SYNTHETIC_BETA = true;

/**
 * Synthetic auth fallback.
 *
 * When enabled, the web client may fall back to a local evaluation session if the
 * Medplum identity provider is unreachable. This is a demo convenience and must be
 * explicitly disabled for any deployment reachable outside a trusted evaluation
 * environment: set VITE_SYNTHETIC_MODE=false at build time.
 */
export const SYNTHETIC_AUTH_FALLBACK =
  typeof import.meta.env.VITE_SYNTHETIC_MODE === 'string'
    ? import.meta.env.VITE_SYNTHETIC_MODE !== 'false'
    : import.meta.env.DEV === true;
