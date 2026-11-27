import { NextResponse } from 'next/server';
import {
  deletePasskey,
  getAllPasskeys,
  getAuthenticatedUsername,
} from '@/lib/authStore';

export async function GET() {
  const username = await getAuthenticatedUsername();
  if (!username) {
    return NextResponse.json({ ok: false, error: 'Brak autoryzacji.' }, { status: 401 });
  }

  const keys = await getAllPasskeys(username);
  return NextResponse.json({
    ok: true,
    username,
    passkeys: keys.map((k) => ({
      id: k.id,
      deviceLabel: k.deviceLabel,
      createdAt: k.createdAt,
    })),
  });
}

export async function DELETE(request: Request) {
  const username = await getAuthenticatedUsername();
  if (!username) {
    return NextResponse.json({ ok: false, error: 'Brak autoryzacji.' }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ ok: false, error: 'Brak ID klucza.' }, { status: 400 });
  }

  await deletePasskey(body.id, username);
  return NextResponse.json({ ok: true });
}
