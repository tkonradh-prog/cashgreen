'use client';

import React, { useState } from 'react';
import { FinanceDB, SupabaseConfigInfo } from '@/lib/types';
import { FinanceApp } from './FinanceApp';
import { FinanceProvider } from './FinanceProvider';
import { LoginScreen } from './LoginScreen';
import { ToastProvider } from './ui/ToastProvider';

export function AppEntry({
  initialAuthenticated,
  initialUsername = '',
  initialDb,
  todayStr,
  hadExistingCookies,
  supabaseInitialConfig,
  supabasePublicEnv,
}: {
  initialAuthenticated: boolean;
  initialUsername?: string;
  initialDb: FinanceDB;
  todayStr: string;
  hadExistingCookies: boolean;
  supabaseInitialConfig?: SupabaseConfigInfo;
  supabasePublicEnv?: { url: string; key: string };
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [username, setUsername] = useState(initialUsername);
  const [hasSessionChanged, setHasSessionChanged] = useState(false);

  if (!authenticated || !username) {
    return (
      <LoginScreen
        onSuccess={(user) => {
          setUsername(user);
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <ToastProvider>
      <FinanceProvider
        key={username}
        username={username}
        serverLoadedForUsername={
          initialAuthenticated && !hasSessionChanged ? initialUsername : ''
        }
        initialDb={initialDb}
        todayStr={todayStr}
        hadExistingCookies={hadExistingCookies}
        supabaseInitialConfig={supabaseInitialConfig}
        supabasePublicEnv={supabasePublicEnv}
      >
        <FinanceApp
          username={username}
          onLoggedOut={() => {
            setHasSessionChanged(true);
            setAuthenticated(false);
            setUsername('');
          }}
        />
      </FinanceProvider>
    </ToastProvider>
  );
}
