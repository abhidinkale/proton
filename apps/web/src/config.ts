/**
 * Proton Web Application Configuration
 * Resolves API and Medplum endpoints from environment variables with safe development fallbacks.
 */

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3002'
).replace(/\/+$/, '');

export const MEDPLUM_BASE_URL = (
  import.meta.env.VITE_MEDPLUM_BASE_URL || 'http://localhost:8103/'
).replace(/\/+$/, '') + '/';

export const MEDPLUM_CLIENT_ID = import.meta.env.VITE_MEDPLUM_CLIENT_ID || undefined;

export const IS_SYNTHETIC_BETA = true;
