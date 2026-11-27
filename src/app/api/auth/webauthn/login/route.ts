import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { WEBAUTHN_CHALLENGE_COOKIE } from '@/lib/auth';
import {
  getAllPasskeys,
  getRpConfig,
  setSessionCookies,
  toWebAuthnCredential,
  updatePasskeyCounter,
} from '@/lib/authStore';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const login = url.searchParams.get('login')?.trim() || undefined;
    const { rpID } = getRpConfig(request);

    const candidates = await getAllPasskeys(login);

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials:
        candidates.length > 0
          ? candidates.map((k) => ({
              id: k.id,
            }))
          : undefined,
    });

    const cookieStore = await cookies();
    cookieStore.set(
      WEBAUTHN_CHALLENGE_COOKIE,
      JSON.stringify({ challenge: options.challenge }),
      {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 300,
      }
    );

    return NextResponse.json({
      ok: true,
      options,
      hasStoredKeys: candidates.length > 0,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Nie udało się rozpocząć logowania biometrią.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const rawChallenge = cookieStore.get(WEBAUTHN_CHALLENGE_COOKIE)?.value;
    if (!rawChallenge) {
      return NextResponse.json(
        { ok: false, error: 'Sesja biometryczna wygasła. Spróbuj ponownie.' },
        { status: 400 }
      );
    }

    const parsedChallenge = JSON.parse(rawChallenge) as { challenge: string };
    const body = (await request.json()) as { response?: AuthenticationResponseJSON };

    if (!body.response) {
      return NextResponse.json({ ok: false, error: 'Brak odpowiedzi WebAuthn.' }, { status: 400 });
    }

    const allKeys = await getAllPasskeys();
    const matched = allKeys.find((k) => k.id === body.response!.id);

    if (!matched) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Nie znaleziono zapisanego klucza biometrycznego. Zaloguj się hasłem i dodaj Face ID w ustawieniach konta.',
        },
        { status: 404 }
      );
    }

    const { rpID, expectedOrigin } = getRpConfig(request);
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: parsedChallenge.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: toWebAuthnCredential(matched),
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return NextResponse.json(
        { ok: false, error: 'Weryfikacja biometryczna odrzucona.' },
        { status: 401 }
      );
    }

    await updatePasskeyCounter(matched.id, verification.authenticationInfo.newCounter);
    await setSessionCookies(matched.username);
    cookieStore.delete(WEBAUTHN_CHALLENGE_COOKIE);

    return NextResponse.json({
      ok: true,
      user: matched.username,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Błąd logowania biometrią.',
      },
      { status: 400 }
    );
  }
}
