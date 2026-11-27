'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Fingerprint,
  Plus,
  ScanFace,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  BiometricEnvironment,
  checkBiometricEnvironment,
  registerDeviceBiometric,
} from '@/lib/biometricsClient';
import { ModalDrawer } from '../ui/ModalDrawer';
import { useToast } from '../ui/ToastProvider';

interface PasskeyItem {
  id: string;
  deviceLabel: string;
  createdAt: string;
}

export function SecurityModal({
  open,
  onClose,
  username,
}: {
  open: boolean;
  onClose: () => void;
  username: string;
}) {
  const { pushToast } = useToast();
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [bioEnv, setBioEnv] = useState<BiometricEnvironment | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [env, res] = await Promise.all([
        checkBiometricEnvironment(),
        fetch('/api/auth/passkeys', { method: 'GET' }),
      ]);
      setBioEnv(env);
      if (res.ok) {
        const data = (await res.json()) as { passkeys?: PasskeyItem[] };
        setPasskeys(data.passkeys ?? []);
      }
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([
      checkBiometricEnvironment(),
      fetch('/api/auth/passkeys', { method: 'GET' }).then(async (r) =>
        r.ok ? ((await r.json()) as { passkeys?: PasskeyItem[] }) : null
      ),
    ])
      .then(([env, data]) => {
        if (!active) return;
        setBioEnv(env);
        if (data) setPasskeys(data.passkeys ?? []);
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const handleAddPasskey = async () => {
    setRegistering(true);
    try {
      const res = await registerDeviceBiometric();
      if (!res.ok) {
        pushToast({
          message: 'Nie udało się dodać biometrii',
          detail: res.error,
          tone: 'coral',
        });
        return;
      }
      pushToast({
        message: 'Aktywowano Face ID / Biometrię!',
        detail: res.passkey?.deviceLabel ?? 'Urządzenie zapisane',
        tone: 'info',
      });
      await loadData();
    } finally {
      setRegistering(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    const res = await fetch('/api/auth/passkeys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setPasskeys((prev) => prev.filter((k) => k.id !== id));
      pushToast({
        message: 'Usunięto klucz biometryczny',
        tone: 'info',
      });
    }
  };

  const BiometricIcon = bioEnv?.platformKind === 'iphone' ? ScanFace : Fingerprint;

  return (
    <ModalDrawer
      open={open}
      onClose={onClose}
      title="Konto & Face ID / Biometria"
      subtitle="Dodaj logowanie biometryczne (iPhone Face ID, Samsung odcisk palca) przez WebAuthn Passkeys."
    >
      <div className="space-y-4">
        {/* Account Banner */}
        <div className="rounded-2xl ios-glass-inset p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5 text-[#2dd4bf]" />
            </span>
            <div>
              <div className="text-xs text-neutral-400">Zalogowany użytkownik</div>
              <div className="text-base font-extrabold text-white">{username}</div>
            </div>
          </div>

          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-neutral-200">
            WebAuthn Passkey
          </span>
        </div>

        {/* HTTPS Warning if opened on plain LAN IP */}
        {bioEnv && !bioEnv.isSecureContext && (
          <div className="rounded-2xl bg-amber-500/12 border border-amber-500/30 p-3.5 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
            <div>
              <div className="font-bold">Wymagane bezpieczne połączenie HTTPS</div>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                Przeglądarki iOS Safari i Samsung Chrome blokują Face ID / odcisk palca pod adresem HTTP z sieci lokalnej. Otwórz aplikację przez HTTPS (np. po wdrożeniu na Vercel lub tunel Cloudflare/ngrok), aby używać biometrii na telefonie.
              </p>
            </div>
          </div>
        )}

        {/* Add Biometric Action */}
        <button
          type="button"
          onClick={handleAddPasskey}
          disabled={registering || (bioEnv !== null && !bioEnv.supported)}
          className="w-full py-3.5 px-4 rounded-2xl bg-white/95 hover:bg-white disabled:opacity-50 active:scale-[0.98] text-black font-extrabold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_6px_22px_rgba(255,255,255,0.2)]"
        >
          <BiometricIcon className="w-4 h-4 stroke-[2.2]" />
          <span>
            {registering
              ? 'Potwierdź biometrię na urządzeniu...'
              : `Aktywuj ${bioEnv?.biometricLabel ?? 'Face ID / Biometrię'} na tym urządzeniu`}
          </span>
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* Registered Devices List */}
        <div className="rounded-2xl ios-glass-inset p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-neutral-300" />
              Przypisane urządzenia ({passkeys.length})
            </span>
          </div>

          {loadingList ? (
            <div className="text-xs text-neutral-400 py-3 text-center">Wczytywanie...</div>
          ) : passkeys.length === 0 ? (
            <div className="text-xs text-neutral-400 py-3 text-center">
              Brak przypisanej biometrii. Kliknij przycisk powyżej na telefonie lub komputerze, aby odblokowywać aplikację jednym spojrzeniem lub palcem.
            </div>
          ) : (
            <div className="space-y-2">
              {passkeys.map((pk) => (
                <div
                  key={pk.id}
                  className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{pk.deviceLabel}</div>
                    <div className="text-[10px] text-neutral-400">
                      Dodano: {pk.createdAt.slice(0, 10)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeletePasskey(pk.id)}
                    title="Usuń klucz biometryczny"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalDrawer>
  );
}
