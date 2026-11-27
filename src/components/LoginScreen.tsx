'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  ScanFace,
  User,
  UserPlus,
} from 'lucide-react';
import {
  BiometricEnvironment,
  authenticateWithBiometric,
  checkBiometricEnvironment,
  registerDeviceBiometric,
} from '@/lib/biometricsClient';
import { CashFlowLogo } from './ui/CashFlowLogo';

type AuthPanelMode = 'splash' | 'login' | 'register';
type ShowcaseSlide = 'wallet' | 'analytics' | 'security';

const SHOWCASE_ORDER: ShowcaseSlide[] = ['wallet', 'analytics', 'security'];

const MINI_BARS = [38, 54, 44, 72, 66, 94];

export function LoginScreen({
  onSuccess,
}: {
  onSuccess?: (username: string) => void;
}) {
  const router = useRouter();
  const [panelMode, setPanelMode] = useState<AuthPanelMode>('splash');
  const [activeSlide, setActiveSlide] = useState<ShowcaseSlide>('wallet');

  const [login, setLogin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [enableBiometricsOnRegister, setEnableBiometricsOnRegister] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioEnv, setBioEnv] = useState<BiometricEnvironment | null>(null);

  useEffect(() => {
    let active = true;
    checkBiometricEnvironment().then((env) => {
      if (active) setBioEnv(env);
    });
    return () => {
      active = false;
    };
  }, []);

  // Automatic ambient animation cycling on splash screen (no clicking required)
  useEffect(() => {
    if (panelMode !== 'splash') return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => {
        const idx = SHOWCASE_ORDER.indexOf(prev);
        return SHOWCASE_ORDER[(idx + 1) % SHOWCASE_ORDER.length];
      });
    }, 3400);
    return () => clearInterval(timer);
  }, [panelMode]);

  const submitAuth = async (
    action: 'login' | 'register',
    loginVal: string,
    passwordVal: string,
    nameVal?: string
  ) => {
    setError('');
    setInfoMsg('');

    if (action === 'register' && passwordVal !== passwordConfirm) {
      setError('Hasła nie są identyczne.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          login: loginVal,
          password: passwordVal,
          displayName: nameVal,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        user?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.user) {
        setError(data.error ?? 'Nie udało się uwierzytelnić.');
        setLoading(false);
        return;
      }

      if (action === 'register' && enableBiometricsOnRegister && bioEnv?.supported) {
        setInfoMsg('Konto utworzone! Potwierdź Face ID / biometrię, aby dodać to urządzenie...');
        const regBio = await registerDeviceBiometric();
        if (!regBio.ok) {
          setInfoMsg('Konto utworzone! Biometrię możesz włączyć później w ustawieniach.');
        }
      }

      onSuccess?.(data.user);
      router.refresh();
    } catch {
      setError('Błąd połączenia z serwerem.');
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError('');
    setInfoMsg('');
    setBioLoading(true);
    try {
      const res = await authenticateWithBiometric(login || undefined);
      if (!res.ok || !res.user) {
        setError(res.error ?? 'Logowanie biometryczne nie powiodło się.');
        return;
      }
      onSuccess?.(res.user);
      router.refresh();
    } finally {
      setBioLoading(false);
    }
  };

  const BiometricIcon = bioEnv?.platformKind === 'iphone' ? ScanFace : Fingerprint;

  return (
    <div className="fixed inset-0 bg-transparent text-white flex flex-col px-5 py-safe-or-6 max-w-md mx-auto overflow-hidden select-none" style={{ paddingTop: 'max(env(safe-area-inset-top), 1.5rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
      {/* Ambient glow */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[300px] h-[200px] bg-gradient-to-b from-teal-400/15 via-sky-400/8 to-transparent blur-3xl pointer-events-none" />

      {/* Logo — small, non-link look */}
      <div className="flex items-center gap-2 z-10 mb-4 animate-card-in">
        <CashFlowLogo size="sm" />
        <span className="text-[11px] font-semibold text-neutral-500 tracking-widest uppercase">CashFlow</span>
      </div>

      {/* Headline — compact */}
      <div className="z-10 mb-4 animate-card-in">
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight text-white">
          Twoje finanse<br />pod pełną kontrolą
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Gotówka, konta i oszczędności — zawsze pod ręką.
        </p>
      </div>

      {/* Animated App Preview Card — fixed height, compact */}
      {panelMode === 'splash' && (
        <div className="z-10 animate-card-in stagger-2 mb-4">
          <div className="relative overflow-hidden rounded-2xl finte-card-elevated px-5 py-5 h-[148px] flex flex-col justify-between">
            <div className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent pointer-events-none animate-sheen" />

            {activeSlide === 'wallet' && (
              <div key="slide-wallet" className="my-auto space-y-1.5 animate-view-enter relative z-10">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2dd4bf] animate-pulse" />
                  <span>Dostępne środki</span>
                </div>
                <div className="text-2xl font-black tabular-nums tracking-tight text-white">
                  14 820,00 zł
                </div>
                <div className="text-[10px] text-neutral-400">
                  Zsynchronizowane na żywo
                </div>
              </div>
            )}

            {activeSlide === 'analytics' && (
              <div key="slide-analytics" className="my-auto space-y-2 animate-view-enter relative z-10">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-neutral-400">Miesięczny bilans</span>
                  <span className="font-bold text-[#2dd4bf] tabular-nums">+18,4%</span>
                </div>
                <div className="h-14 flex items-end gap-1.5">
                  {MINI_BARS.map((pct, i) => (
                    <div key={i} className="flex-1 h-full flex items-end">
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-[#2dd4bf]/40 to-[#2dd4bf] animate-bar-grow"
                        style={{ height: `${pct}%`, animationDelay: `${i * 70}ms` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSlide === 'security' && (
              <div key="slide-security" className="my-auto flex flex-col items-center text-center space-y-2 animate-view-enter relative z-10">
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-12 h-12 rounded-full bg-[#2dd4bf]/15 animate-ping opacity-30" />
                  <span className="relative w-10 h-10 rounded-xl ios-glass-inset border border-white/15 flex items-center justify-center text-[#2dd4bf]">
                    <BiometricIcon className="w-5 h-5" />
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Face ID / Biometria</div>
                  <div className="text-[10px] text-neutral-400">Bezpieczna chmura Supabase</div>
                </div>
              </div>
            )}

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1 relative z-10" aria-hidden="true">
              {SHOWCASE_ORDER.map((slide) => (
                <span
                  key={slide}
                  className={`h-[3px] rounded-full transition-all duration-500 ${activeSlide === slide ? 'w-4 bg-white/70' : 'w-1 bg-white/18'}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CTA / Forms — pushed to bottom, compact spacing */}
      <div className="mt-auto space-y-2.5 z-10 animate-card-in stagger-3">
        {error && (
          <div className="rounded-2xl bg-red-500/15 border border-red-500/30 px-4 py-2 text-xs font-medium text-red-300 text-center animate-fade-in">
            {error}
          </div>
        )}
        {infoMsg && (
          <div className="rounded-2xl bg-[#2dd4bf]/15 border border-[#2dd4bf]/30 px-4 py-2 text-xs font-medium text-[#2dd4bf] text-center animate-fade-in">
            {infoMsg}
          </div>
        )}

        {/* Face ID button */}
        {(bioEnv === null || bioEnv.supported || bioEnv.hasRegisteredPasskeyHint) && (
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={bioLoading || loading}
            className="w-full py-3 px-6 rounded-full bg-white/95 hover:bg-white active:scale-[0.97] text-black font-extrabold text-sm transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(255,255,255,0.20)]"
          >
            <BiometricIcon className="w-4.5 h-4.5 stroke-[2.2]" />
            <span>
              {bioLoading
                ? 'Autoryzacja...'
                : bioEnv?.hasRegisteredPasskeyHint
                  ? `Odblokuj przez ${bioEnv.biometricLabel}`
                  : 'Zaloguj Face ID / Biometrią'}
            </span>
          </button>
        )}

        {panelMode === 'splash' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setError(''); setPanelMode('register'); }}
              className="py-3 px-4 rounded-full ios-glass-pill active:scale-[0.98] text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Utwórz konto</span>
            </button>
            <button
              type="button"
              onClick={() => { setError(''); setPanelMode('login'); }}
              className="py-3 px-4 rounded-full ios-glass-pill active:scale-[0.98] text-neutral-200 hover:text-white font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Zaloguj hasłem</span>
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitAuth(panelMode === 'register' ? 'register' : 'login', login, password, displayName);
            }}
            className="space-y-2.5 rounded-2xl ios-glass-sheet p-4 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 p-0.5 rounded-lg ios-glass-inset">
                <button
                  type="button"
                  onClick={() => { setError(''); setPanelMode('login'); }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${panelMode === 'login' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
                >
                  Logowanie
                </button>
                <button
                  type="button"
                  onClick={() => { setError(''); setPanelMode('register'); }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${panelMode === 'register' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
                >
                  Nowe konto
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setError(''); setPanelMode('splash'); }}
                className="text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer px-1"
              >
                Wróć
              </button>
            </div>

            {/* Login field */}
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/[0.1] px-3 py-2.5 focus-within:border-white/40 focus-within:bg-white/[0.08] transition-all">
              <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="text"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={panelMode === 'register' ? 'Login (np. konrad)' : 'Twój login'}
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full bg-transparent focus:outline-none text-white text-sm"
              />
            </div>

            {panelMode === 'register' && (
              <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/[0.1] px-3 py-2.5 focus-within:border-white/40 focus-within:bg-white/[0.08] transition-all">
                <UserPlus className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Imię (opcjonalnie)"
                  className="w-full bg-transparent focus:outline-none text-white text-sm"
                />
              </div>
            )}

            {/* Password field */}
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/[0.1] px-3 py-2.5 focus-within:border-white/40 focus-within:bg-white/[0.08] transition-all">
              <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Hasło"
                className="w-full bg-transparent focus:outline-none text-white text-sm"
              />
              <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-neutral-400 hover:text-white cursor-pointer">
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {panelMode === 'register' && (
              <>
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/[0.1] px-3 py-2.5 focus-within:border-white/40 focus-within:bg-white/[0.08] transition-all">
                  <Lock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Powtórz hasło"
                    className="w-full bg-transparent focus:outline-none text-white text-sm"
                  />
                </div>
                {bioEnv?.supported && (
                  <button
                    type="button"
                    onClick={() => setEnableBiometricsOnRegister((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 rounded-xl ios-glass-inset px-3 py-2 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-200">
                      <BiometricIcon className="w-3.5 h-3.5 text-[#2dd4bf] shrink-0" />
                      <span>Włącz {bioEnv.biometricLabel} po rejestracji</span>
                    </div>
                    <span className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${enableBiometricsOnRegister ? 'bg-white text-black border-white' : 'border-white/20 text-transparent'}`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  </button>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-full bg-white hover:bg-neutral-200 active:scale-[0.98] text-black font-extrabold text-xs transition-all cursor-pointer shadow-[0_4px_16px_rgba(255,255,255,0.18)]"
            >
              {loading ? 'Przetwarzanie...' : panelMode === 'register' ? 'Utwórz konto i wejdź' : 'Zaloguj się'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="text-center text-[10px] text-neutral-500">
          {bioEnv && !bioEnv.isSecureContext ? (
            <span className="text-amber-300/80">Face ID wymaga HTTPS lub localhost</span>
          ) : (
            <span>Połączenie szyfrowane · Supabase</span>
          )}
        </div>
      </div>
    </div>
  );
}
