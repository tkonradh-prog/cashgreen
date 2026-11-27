'use client';

import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { PASSKEY_HINT_COOKIE } from './auth';

export type BiometricPlatformKind = 'iphone' | 'samsung' | 'android' | 'desktop';

export interface BiometricEnvironment {
  isSecureContext: boolean;
  supported: boolean;
  platformAvailable: boolean;
  hasRegisteredPasskeyHint: boolean;
  platformKind: BiometricPlatformKind;
  biometricLabel: string;
}

function detectPlatformKind(): BiometricPlatformKind {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iphone';
  if (/SM-|Samsung/i.test(ua)) return 'samsung';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function getBiometricLabel(kind: BiometricPlatformKind): string {
  switch (kind) {
    case 'iphone':
      return 'Face ID / Touch ID';
    case 'samsung':
      return 'Odcisk palca / Biometria Samsung';
    case 'android':
      return 'Biometria / Odcisk palca';
    default:
      return 'Biometria / Passkey';
  }
}

export function hasLocalPasskeyHint(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((c) => c.startsWith(`${PASSKEY_HINT_COOKIE}=1`));
}

export async function checkBiometricEnvironment(): Promise<BiometricEnvironment> {
  const platformKind = detectPlatformKind();
  const biometricLabel = getBiometricLabel(platformKind);
  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;
  const supported = isSecureContext && browserSupportsWebAuthn();
  let platformAvailable = false;

  if (supported) {
    try {
      platformAvailable = await platformAuthenticatorIsAvailable();
    } catch {
      platformAvailable = false;
    }
  }

  return {
    isSecureContext,
    supported,
    platformAvailable,
    hasRegisteredPasskeyHint: hasLocalPasskeyHint(),
    platformKind,
    biometricLabel,
  };
}

function formatWebAuthnError(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name: string }).name);
    if (name === 'NotAllowedError') {
      return 'Anulowano weryfikację biometryczną lub upłynął limit czasu.';
    }
    if (name === 'InvalidStateError') {
      return 'To urządzenie ma już przypisany klucz biometryczny do tego konta.';
    }
    if (name === 'SecurityError') {
      return 'Biometria w przeglądarce wymaga bezpiecznego połączenia HTTPS (lub localhost).';
    }
    if (name === 'NotSupportedError') {
      return 'Twoja przeglądarka lub urządzenie nie obsługuje Passkeys.';
    }
  }
  return err instanceof Error ? err.message : 'Błąd uwierzytelniania biometrycznego.';
}

export async function registerDeviceBiometric(deviceLabel?: string): Promise<{
  ok: boolean;
  passkey?: { id: string; deviceLabel: string; createdAt: string };
  error?: string;
}> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      ok: false,
      error: 'Face ID i biometria w przeglądarce wymagają połączenia HTTPS (lub localhost).',
    };
  }
  if (!browserSupportsWebAuthn()) {
    return {
      ok: false,
      error: 'Przeglądarka nie obsługuje WebAuthn / Passkeys.',
    };
  }

  try {
    const optRes = await fetch('/api/auth/webauthn/register', { method: 'GET' });
    const optData = (await optRes.json()) as {
      ok?: boolean;
      options?: Parameters<typeof startRegistration>[0]['optionsJSON'];
      error?: string;
    };

    if (!optRes.ok || !optData.ok || !optData.options) {
      return { ok: false, error: optData.error ?? 'Nie udało się rozpocząć rejestracji.' };
    }

    const attResp = await startRegistration({ optionsJSON: optData.options });

    const verifyRes = await fetch('/api/auth/webauthn/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: attResp, deviceLabel }),
    });
    const verifyData = (await verifyRes.json()) as {
      ok?: boolean;
      passkey?: { id: string; deviceLabel: string; createdAt: string };
      error?: string;
    };

    if (!verifyRes.ok || !verifyData.ok) {
      return { ok: false, error: verifyData.error ?? 'Rejestracja biometrii odrzucona.' };
    }

    return { ok: true, passkey: verifyData.passkey };
  } catch (err) {
    return { ok: false, error: formatWebAuthnError(err) };
  }
}

export async function authenticateWithBiometric(loginHint?: string): Promise<{
  ok: boolean;
  user?: string;
  error?: string;
}> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      ok: false,
      error: 'Face ID i biometria w przeglądarce wymagają połączenia HTTPS (lub localhost).',
    };
  }
  if (!browserSupportsWebAuthn()) {
    return {
      ok: false,
      error: 'Przeglądarka nie obsługuje logowania biometrycznego.',
    };
  }

  try {
    const qs = loginHint ? `?login=${encodeURIComponent(loginHint.trim())}` : '';
    const optRes = await fetch(`/api/auth/webauthn/login${qs}`, { method: 'GET' });
    const optData = (await optRes.json()) as {
      ok?: boolean;
      options?: Parameters<typeof startAuthentication>[0]['optionsJSON'];
      error?: string;
    };

    if (!optRes.ok || !optData.ok || !optData.options) {
      return { ok: false, error: optData.error ?? 'Nie udało się przygotować logowania biometrią.' };
    }

    const assertion = await startAuthentication({ optionsJSON: optData.options });

    const verifyRes = await fetch('/api/auth/webauthn/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: assertion }),
    });
    const verifyData = (await verifyRes.json()) as {
      ok?: boolean;
      user?: string;
      error?: string;
    };

    if (!verifyRes.ok || !verifyData.ok) {
      return { ok: false, error: verifyData.error ?? 'Weryfikacja biometryczna nie powiodła się.' };
    }

    return { ok: true, user: verifyData.user };
  } catch (err) {
    return { ok: false, error: formatWebAuthnError(err) };
  }
}
