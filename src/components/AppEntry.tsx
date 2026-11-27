'use client';

import React, { useState } from 'react';
import { FinanceDB, SupabaseConfigInfo } from '@/lib/types';
import { FinanceApp } from './FinanceApp';
import { FinanceProvider } from './FinanceProvider';
import { LoginScreen } from './LoginScreen';
import { ToastProvider } from './ui/ToastProvider';

export function AppEntry({
  initialAuthenticated,
  initialUsername = 'admin',
  initialDb,
  todayStr,
  hadExistingCookies,
  supabaseInitialConfig,
}: {
  initialAuthenticated: boolean;
  initialUsername?: string;
  initialDb: FinanceDB;
  todayStr: string;
  hadExistingCookies: boolean;
  supabaseInitialConfig?: SupabaseConfigInfo;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [username, setUsername] = useState(initialUsername);

  if (!authenticated) {
    return (
      <LoginScreen
        onSuccess={(user) => {
          setUsername(user || 'admin');
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <ToastProvider>
      <FinanceProvider
        initialDb={initialDb}
        todayStr={todayStr}
        hadExistingCookies={hadExistingCookies}
        supabaseInitialConfig={supabaseInitialConfig}
      >
        <FinanceApp
          username={username}
          onLoggedOut={() => setAuthenticated(false)}
        />
      </FinanceProvider>
    </ToastProvider>
  );
}
