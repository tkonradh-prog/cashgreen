import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { AuthenticatorTransport } from '@simplewebauthn/server';
import { createClient } from '@/utils/supabase/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_VALUE,
  AUTH_USER_COOKIE,
  PASSKEYS_COOKIE_NAME,
  PASSKEY_HINT_COOKIE,
  StoredPasskey,
  StoredUser,
  USERS_COOKIE_NAME,
  normalizeLogin,
} from './auth';

const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 dni
const CREDENTIAL_STORE_MAX_AGE = 60 * 60 * 24 * 365; // 1 rok

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasswordHash(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  try {
    const keyBuf = Buffer.from(keyHex, 'hex');
    const derived = crypto.scryptSync(password, salt, 64);
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

export function getRpConfig(request: Request): { rpID: string; expectedOrigin: string } {
  const originHeader = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const hostHeader = forwardedHost ?? request.headers.get('host') ?? 'localhost:3000';
  const protoHeader =
    request.headers.get('x-forwarded-proto') ??
    (hostHeader.startsWith('localhost') || hostHeader.startsWith('127.0.0.1') ? 'http' : 'https');

  const hostname = hostHeader.split(':')[0].toLowerCase();
  const expectedOrigin = originHeader ?? `${protoHeader}://${hostHeader}`;

  return {
    rpID: hostname,
    expectedOrigin,
  };
}

function readCookieJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getAuthenticatedUsername(): Promise<string | null> {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get(AUTH_COOKIE_NAME)?.value === AUTH_SESSION_VALUE;
  if (!isAuthed) return null;
  const user = cookieStore.get(AUTH_USER_COOKIE)?.value;
  return user ? normalizeLogin(user) : null;
}

export async function setSessionCookies(username: string): Promise<void> {
  const cookieStore = await cookies();
  const normalized = normalizeLogin(username);

  cookieStore.set(AUTH_COOKIE_NAME, AUTH_SESSION_VALUE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  cookieStore.set(AUTH_USER_COOKIE, normalized, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getStoredUsers(): Promise<StoredUser[]> {
  const cookieStore = await cookies();
  const localUsers = readCookieJson<StoredUser[]>(
    cookieStore.get(USERS_COOKIE_NAME)?.value,
    []
  );

  try {
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase
      .from('app_users')
      .select('login, display_name, password_hash, created_at');

    if (!error && Array.isArray(data)) {
      const merged = new Map<string, StoredUser>();
      for (const u of localUsers) merged.set(normalizeLogin(u.login), u);
      for (const row of data) {
        const login = normalizeLogin(row.login);
        merged.set(login, {
          login,
          displayName: row.display_name || login,
          passwordHash: row.password_hash,
          createdAt: row.created_at,
        });
      }
      return Array.from(merged.values());
    }
  } catch {
    // Graceful fallback to cookie store
  }

  return localUsers;
}

export async function registerUserAccount(params: {
  login: string;
  displayName?: string;
  password: string;
}): Promise<{ ok: true; user: StoredUser } | { ok: false; error: string }> {
  const login = normalizeLogin(params.login);
  const displayName = (params.displayName ?? params.login).trim() || login;
  const password = params.password;

  if (!/^[a-z0-9._-]{3,32}$/.test(login)) {
    return {
      ok: false,
      error: 'Login musi mieć od 3 do 32 znaków (litery, cyfry, kropka, - lub _).',
    };
  }
  if (password.length < 4) {
    return { ok: false, error: 'Hasło musi mieć minimum 4 znaki.' };
  }

  const existing = await getStoredUsers();
  if (existing.some((u) => normalizeLogin(u.login) === login)) {
    return { ok: false, error: 'Konto o takim loginie już istnieje.' };
  }

  const created: StoredUser = {
    login,
    displayName,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  const cookieStore = await cookies();
  const localUsers = readCookieJson<StoredUser[]>(
    cookieStore.get(USERS_COOKIE_NAME)?.value,
    []
  );
  const nextLocal = [...localUsers.filter((u) => normalizeLogin(u.login) !== login), created];

  cookieStore.set(USERS_COOKIE_NAME, JSON.stringify(nextLocal), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: CREDENTIAL_STORE_MAX_AGE,
  });

  // Sync to Supabase if app_users table exists
  try {
    const supabase = createClient(cookieStore);
    await supabase.from('app_users').upsert(
      {
        login: created.login,
        display_name: created.displayName,
        password_hash: created.passwordHash,
        created_at: created.createdAt,
      },
      { onConflict: 'login' }
    );
  } catch {
    // Silent fallback when table not yet migrated
  }

  return { ok: true, user: created };
}

export async function verifyUserCredentials(
  loginInput: string,
  password: string
): Promise<{ ok: true; username: string } | { ok: false }> {
  const login = normalizeLogin(loginInput);
  const users = await getStoredUsers();
  const match = users.find((u) => normalizeLogin(u.login) === login);
  if (!match) return { ok: false };

  if (verifyPasswordHash(password, match.passwordHash)) {
    return { ok: true, username: match.login };
  }
  return { ok: false };
}

export async function getAllPasskeys(username?: string): Promise<StoredPasskey[]> {
  const cookieStore = await cookies();
  const localKeys = readCookieJson<StoredPasskey[]>(
    cookieStore.get(PASSKEYS_COOKIE_NAME)?.value,
    []
  );

  const merged = new Map<string, StoredPasskey>();
  for (const k of localKeys) merged.set(k.id, k);

  try {
    const supabase = createClient(cookieStore);
    const query = supabase
      .from('passkey_credentials')
      .select('id, username, public_key_b64, counter, transports, device_label, created_at');
    const { data, error } = username
      ? await query.eq('username', normalizeLogin(username))
      : await query;

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        merged.set(row.id, {
          id: row.id,
          username: normalizeLogin(row.username),
          publicKeyB64: row.public_key_b64,
          counter: Number(row.counter ?? 0),
          transports: Array.isArray(row.transports) ? row.transports : undefined,
          deviceLabel: row.device_label || 'Urządzenie biometryczne',
          createdAt: row.created_at,
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  const all = Array.from(merged.values());
  if (!username) return all;
  const normalized = normalizeLogin(username);
  return all.filter((k) => normalizeLogin(k.username) === normalized);
}

export async function savePasskey(passkey: StoredPasskey): Promise<void> {
  const cookieStore = await cookies();
  const localKeys = readCookieJson<StoredPasskey[]>(
    cookieStore.get(PASSKEYS_COOKIE_NAME)?.value,
    []
  );
  const nextLocal = [...localKeys.filter((k) => k.id !== passkey.id), passkey];

  cookieStore.set(PASSKEYS_COOKIE_NAME, JSON.stringify(nextLocal), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: CREDENTIAL_STORE_MAX_AGE,
  });

  cookieStore.set(PASSKEY_HINT_COOKIE, '1', {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: CREDENTIAL_STORE_MAX_AGE,
  });

  try {
    const supabase = createClient(cookieStore);
    await supabase.from('passkey_credentials').upsert(
      {
        id: passkey.id,
        username: normalizeLogin(passkey.username),
        public_key_b64: passkey.publicKeyB64,
        counter: passkey.counter,
        transports: passkey.transports ?? [],
        device_label: passkey.deviceLabel,
        created_at: passkey.createdAt,
      },
      { onConflict: 'id' }
    );
  } catch {
    // Silent fallback
  }
}

export async function updatePasskeyCounter(id: string, newCounter: number): Promise<void> {
  const cookieStore = await cookies();
  const localKeys = readCookieJson<StoredPasskey[]>(
    cookieStore.get(PASSKEYS_COOKIE_NAME)?.value,
    []
  );
  const nextLocal = localKeys.map((k) => (k.id === id ? { ...k, counter: newCounter } : k));

  cookieStore.set(PASSKEYS_COOKIE_NAME, JSON.stringify(nextLocal), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: CREDENTIAL_STORE_MAX_AGE,
  });

  try {
    const supabase = createClient(cookieStore);
    await supabase.from('passkey_credentials').update({ counter: newCounter }).eq('id', id);
  } catch {
    // Silent fallback
  }
}

export async function deletePasskey(id: string, username: string): Promise<void> {
  const cookieStore = await cookies();
  const normalized = normalizeLogin(username);
  const localKeys = readCookieJson<StoredPasskey[]>(
    cookieStore.get(PASSKEYS_COOKIE_NAME)?.value,
    []
  );
  const nextLocal = localKeys.filter(
    (k) => !(k.id === id && normalizeLogin(k.username) === normalized)
  );

  cookieStore.set(PASSKEYS_COOKIE_NAME, JSON.stringify(nextLocal), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: CREDENTIAL_STORE_MAX_AGE,
  });

  try {
    const supabase = createClient(cookieStore);
    await supabase
      .from('passkey_credentials')
      .delete()
      .eq('id', id)
      .eq('username', normalized);
  } catch {
    // Silent fallback
  }

  const remaining = await getAllPasskeys();
  if (remaining.length === 0) {
    cookieStore.delete(PASSKEY_HINT_COOKIE);
  }
}

export function detectDeviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? '';
  if (/iPhone/i.test(ua)) return 'iPhone · Face ID / Touch ID';
  if (/iPad/i.test(ua)) return 'iPad · Face ID / Touch ID';
  if (/SM-|Samsung/i.test(ua)) return 'Samsung · Biometria';
  if (/Android/i.test(ua)) return 'Android · Biometria';
  if (/Macintosh|Mac OS/i.test(ua)) return 'Mac · Touch ID';
  if (/Windows/i.test(ua)) return 'Windows Hello';
  return 'Urządzenie z Passkey';
}

export function toWebAuthnCredential(passkey: StoredPasskey) {
  return {
    id: passkey.id,
    publicKey: new Uint8Array(Buffer.from(passkey.publicKeyB64, 'base64url')),
    counter: passkey.counter,
    transports: passkey.transports as AuthenticatorTransport[] | undefined,
  };
}
