import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, AUTH_USER_COOKIE } from '@/lib/auth';
import {
  registerUserAccount,
  setSessionCookies,
  verifyUserCredentials,
} from '@/lib/authStore';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: 'login' | 'register';
      login?: string;
      displayName?: string;
      password?: string;
    };

    const action = body.action ?? 'login';
    const login = body.login ?? '';
    const password = body.password ?? '';

    if (action === 'register') {
      const reg = await registerUserAccount({
        login,
        displayName: body.displayName,
        password,
      });

      if (!reg.ok) {
        return NextResponse.json({ ok: false, error: reg.error }, { status: 400 });
      }

      await setSessionCookies(reg.user.login);
      return NextResponse.json({
        ok: true,
        user: reg.user.login,
        displayName: reg.user.displayName,
      });
    }

    const auth = await verifyUserCredentials(login, password);
    if (!auth.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Nieprawidłowy login lub hasło.',
        },
        { status: 401 }
      );
    }

    await setSessionCookies(auth.username);
    return NextResponse.json({ ok: true, user: auth.username });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Błąd przetwarzania żądania logowania.' },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(AUTH_USER_COOKIE);
  return NextResponse.json({ ok: true });
}
