import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  type RegistrationResponseJSON,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { WEBAUTHN_CHALLENGE_COOKIE } from '@/lib/auth';
import {
  detectDeviceLabel,
  getAllPasskeys,
  getAuthenticatedUsername,
  getRpConfig,
  savePasskey,
} from '@/lib/authStore';

export async function GET(request: Request) {
  try {
    const username = await getAuthenticatedUsername();
    if (!username) {
      return NextResponse.json(
        { ok: false, error: 'Zaloguj się najpierw, aby dodać Face ID / Biometrię.' },
        { status: 401 }
      );
    }

    const { rpID } = getRpConfig(request);
    const existingKeys = await getAllPasskeys(username);

    const options = await generateRegistrationOptions({
      rpName: 'CashFlow',
      rpID,
      userName: username,
      userDisplayName: username,
      attestationType: 'none',
      excludeCredentials: existingKeys.map((k) => ({
        id: k.id,
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
      preferredAuthenticatorType: 'localDevice',
    });

    const cookieStore = await cookies();
    cookieStore.set(
      WEBAUTHN_CHALLENGE_COOKIE,
      JSON.stringify({ challenge: options.challenge, username }),
      {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 300,
      }
    );

    return NextResponse.json({ ok: true, options });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Nie udało się przygotować biometrii.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const username = await getAuthenticatedUsername();
    if (!username) {
      return NextResponse.json({ ok: false, error: 'Brak aktywnej sesji.' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const rawChallenge = cookieStore.get(WEBAUTHN_CHALLENGE_COOKIE)?.value;
    if (!rawChallenge) {
      return NextResponse.json(
        { ok: false, error: 'Sesja biometryczna wygasła. Spróbuj ponownie.' },
        { status: 400 }
      );
    }

    const parsedChallenge = JSON.parse(rawChallenge) as {
      challenge: string;
      username: string;
    };

    if (parsedChallenge.username !== username) {
      return NextResponse.json(
        { ok: false, error: 'Niezgodny użytkownik rejestracji.' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      response?: RegistrationResponseJSON;
      deviceLabel?: string;
    };

    if (!body.response) {
      return NextResponse.json({ ok: false, error: 'Brak odpowiedzi WebAuthn.' }, { status: 400 });
    }

    const { rpID, expectedOrigin } = getRpConfig(request);
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: parsedChallenge.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { ok: false, error: 'Weryfikacja Face ID / Biometrii nie powiodła się.' },
        { status: 400 }
      );
    }

    const { credential } = verification.registrationInfo;
    const deviceLabel =
      body.deviceLabel?.trim() || detectDeviceLabel(request.headers.get('user-agent'));

    const saved = {
      id: credential.id,
      username,
      publicKeyB64: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: body.response.response.transports,
      deviceLabel,
      createdAt: new Date().toISOString(),
    };

    await savePasskey(saved);
    cookieStore.delete(WEBAUTHN_CHALLENGE_COOKIE);

    return NextResponse.json({
      ok: true,
      passkey: {
        id: saved.id,
        deviceLabel: saved.deviceLabel,
        createdAt: saved.createdAt,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Błąd rejestracji biometrii.',
      },
      { status: 400 }
    );
  }
}
