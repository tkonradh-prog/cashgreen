import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { AppEntry } from '@/components/AppEntry';
import { AUTH_COOKIE_NAME, AUTH_SESSION_VALUE, AUTH_USER_COOKIE } from '@/lib/auth';
import { parseFinanceDBFromCookies } from '@/lib/cookieDb';
import { getWarsawToday } from '@/lib/format';
import { createCleanDatabase } from '@/lib/seedData';
import { createClient } from '@/utils/supabase/server';
import { fetchFinanceDBFromSupabase } from '@/lib/supabaseDb';
import { SupabaseConfigInfo } from '@/lib/types';

async function FinanceCookieLoader() {
  // Next.js 16 Cache Components: defer request-time date/cookies evaluation to request time
  await connection();
  const cookieStore = await cookies();
  const currentUsername = cookieStore.get(AUTH_USER_COOKIE)?.value || '';
  const isAuthenticated =
    cookieStore.get(AUTH_COOKIE_NAME)?.value === AUTH_SESSION_VALUE && Boolean(currentUsername);
  const todayStr = getWarsawToday();

  const rawPairs = cookieStore.getAll().map((c) => ({
    name: c.name,
    value: c.value,
  }));

  if (!isAuthenticated || !currentUsername) {
    return (
      <AppEntry
        initialAuthenticated={false}
        initialUsername=""
        initialDb={createCleanDatabase(todayStr)}
        todayStr={todayStr}
        hadExistingCookies={false}
      />
    );
  }

  const existingCookieDb = parseFinanceDBFromCookies(rawPairs, currentUsername);

  // Initialize Supabase server client taking cookieStore
  const supabase = createClient(cookieStore);
  const syncResult = await fetchFinanceDBFromSupabase(supabase, currentUsername);

  // Use this user's Supabase DB, or this user's cookie DB, or a clean 0 zł database
  const initialDb = syncResult.db ?? existingCookieDb ?? createCleanDatabase(todayStr);

  const supabaseInfo: SupabaseConfigInfo = {
    isConfigured: syncResult.isConfigured,
    tablesReady: syncResult.tablesReady,
    source: syncResult.source,
    status: syncResult.tablesReady
      ? 'connected'
      : syncResult.isConfigured
        ? 'needs_migration'
        : 'offline_cookies',
    error: syncResult.error,
  };

  return (
    <AppEntry
      initialAuthenticated={isAuthenticated}
      initialUsername={currentUsername}
      initialDb={initialDb}
      todayStr={todayStr}
      hadExistingCookies={Boolean(existingCookieDb || syncResult.db)}
      supabaseInitialConfig={supabaseInfo}
    />
  );
}

function AppSkeleton() {
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
      <div className="w-8 h-8 rounded-full border-2 border-white/15 border-t-white/70 animate-spin" />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<AppSkeleton />}>
      <FinanceCookieLoader />
    </Suspense>
  );
}
