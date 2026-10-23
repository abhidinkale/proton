/**
 * Proton session token storage.
 *
 * Deliberately separate from the doctor profile (`proton_auth_session`): the
 * profile is display state, this is the credential. They are written and cleared
 * together, but only this module knows how to read the credential.
 *
 * Storage choice: mirrored to localStorage *and* sessionStorage so a second tab
 * or a restored tab does not present a signed-in shell with no API credential.
 * The token is short-lived (12h) and the API enforces a 15-minute inactivity
 * window, so the exposure window is bounded.
 */

const STORAGE_KEY = 'proton_session_token';

function safeRead(storage: Storage | undefined): string | null {
  try {
    return storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function safeWrite(storage: Storage | undefined, value: string | null): void {
  try {
    if (value === null) storage?.removeItem(STORAGE_KEY);
    else storage?.setItem(STORAGE_KEY, value);
  } catch {
    // Storage can be unavailable (private mode, quota). The in-memory token
    // still works for the current document.
  }
}

let memoryToken: string | null = null;

export function getSessionToken(): string | null {
  if (memoryToken) return memoryToken;

  if (typeof window === 'undefined') return null;

  memoryToken = safeRead(window.sessionStorage) ?? safeRead(window.localStorage);
  return memoryToken;
}

export function setSessionToken(token: string | null): void {
  memoryToken = token;

  if (typeof window === 'undefined') return;

  safeWrite(window.sessionStorage, token);
  safeWrite(window.localStorage, token);
}

export function clearSessionToken(): void {
  setSessionToken(null);
}

export function hasSessionToken(): boolean {
  return getSessionToken() !== null;
}
