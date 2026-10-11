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

export const IS_SYNTHETIC_BETA = true;
