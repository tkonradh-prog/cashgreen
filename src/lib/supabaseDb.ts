import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeLogin } from './auth';
import { FinanceDB } from './types';

export interface SupabaseSyncResult {
  db: FinanceDB | null;
  source: 'supabase' | 'cookies' | 'default';
  isConfigured: boolean;
  tablesReady: boolean;
  error?: string;
}

export function getFinanceSyncRowId(username?: string): string | null {
  const normalized = normalizeLogin(username ?? '');
  if (!normalized) return null;
  return `user:${normalized}`;
}

/**
 * Attempts to load the active user's FinanceDB from Supabase.
 * Never shares data across users. Returns null when no row exists for this user yet.
 */
export async function fetchFinanceDBFromSupabase(
  supabase: SupabaseClient,
  username?: string
): Promise<SupabaseSyncResult> {
  const rowId = getFinanceSyncRowId(username);
  if (!rowId) {
    return {
      db: null,
      source: 'default',
      isConfigured: true,
      tablesReady: true,
    };
  }

  try {
    const { data: syncRow, error: syncError } = await supabase
      .from('finance_sync')
      .select('data, version, updated_at')
      .eq('id', rowId)
      .maybeSingle();

    if (syncRow && syncRow.data) {
      const db = syncRow.data as FinanceDB;
      return {
        db,
        source: 'supabase',
        isConfigured: true,
        tablesReady: true,
      };
    }

    if (syncError) {
      const isMissing =
        syncError.code === 'PGRST205' ||
        syncError.message.includes('schema cache') ||
        syncError.message.includes('relation');

      return {
        db: null,
        source: 'cookies',
        isConfigured: true,
        tablesReady: !isMissing,
        error: syncError.message,
      };
    }

    // Table exists but user has no saved record yet (new user -> clean start)
    return {
      db: null,
      source: 'default',
      isConfigured: true,
      tablesReady: true,
    };
  } catch (err) {
    return {
      db: null,
      source: 'cookies',
      isConfigured: true,
      tablesReady: false,
      error: err instanceof Error ? err.message : 'Nieznany błąd Supabase',
    };
  }
}

/**
 * Saves the active user's FinanceDB to Supabase under `user:<login>`.
 */
export async function saveFinanceDBToSupabase(
  supabase: SupabaseClient,
  db: FinanceDB,
  username?: string
): Promise<{ ok: boolean; error?: string; tablesMissing?: boolean }> {
  const rowId = getFinanceSyncRowId(username);
  if (!rowId) {
    return { ok: false, error: 'Brak zalogowanego użytkownika' };
  }

  try {
    const { error } = await supabase.from('finance_sync').upsert(
      {
        id: rowId,
        data: db,
        version: db.version,
        mode: db.mode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      const isMissing =
        error.code === 'PGRST205' ||
        error.message.includes('schema cache') ||
        error.message.includes('relation');

      return {
        ok: false,
        error: error.message,
        tablesMissing: isMissing,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Błąd zapisu do Supabase',
    };
  }
}

/**
 * Check if Supabase connection is healthy and if tables exist.
 */
export async function checkSupabaseConnection(
  supabase: SupabaseClient
): Promise<{ ok: boolean; tablesReady: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('finance_sync').select('id').limit(1);
    if (!error) {
      return { ok: true, tablesReady: true };
    }
    const isMissing =
      error.code === 'PGRST205' ||
      error.message.includes('schema cache') ||
      error.message.includes('relation');

    return {
      ok: true,
      tablesReady: !isMissing,
      error: error.message,
    };
  } catch (err) {
    return {
      ok: false,
      tablesReady: false,
      error: err instanceof Error ? err.message : 'Brak połączenia',
    };
  }
}
