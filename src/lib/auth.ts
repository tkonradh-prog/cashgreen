export const AUTH_COOKIE_NAME = 'finte_auth';
export const AUTH_USER_COOKIE = 'finte_user';
export const AUTH_SESSION_VALUE = 'authenticated_v1';

export const USERS_COOKIE_NAME = 'cf_users_db';
export const PASSKEYS_COOKIE_NAME = 'cf_passkeys_db';
export const PASSKEY_HINT_COOKIE = 'cf_has_passkey';
export const WEBAUTHN_CHALLENGE_COOKIE = 'cf_webauthn_challenge';

export interface StoredUser {
  login: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

export interface StoredPasskey {
  id: string; // Base64URL credential ID
  username: string;
  publicKeyB64: string; // Base64URL COSE public key
  counter: number;
  transports?: string[];
  deviceLabel: string;
  createdAt: string;
}

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}
