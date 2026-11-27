import { SupabaseClient } from '@supabase/supabase-js';
import { FinanceDB } from './types';

export interface SupabaseSyncResult {
  db: FinanceDB | null;
  source: 'supabase' | 'cookies' | 'default';
  isConfigured: boolean;
  tablesReady: boolean;
  error?: string;
}

/**
 * Attempts to load the active FinanceDB from Supabase.
 * Returns null if Supabase is unreachable or tables are not created yet.
 */
export async function fetchFinanceDBFromSupabase(
  supabase: SupabaseClient
): Promise<SupabaseSyncResult> {
  try {
    // 1. Try fetching from finance_sync table (fastest and atomic)
    const { data: syncRow, error: syncError } = await supabase
      .from('finance_sync')
      .select('data, version, updated_at')
      .eq('id', 'current')
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
      // Table doesn't exist yet (PGRST205) or RLS blocked
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

    // Table exists but is empty (first time)
    return {
      db: null,
      source: 'cookies',
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
 * Saves the current FinanceDB to Supabase.
 * Silently catches errors if tables are not created yet.
 */
export async function saveFinanceDBToSupabase(
  supabase: SupabaseClient,
  db: FinanceDB
): Promise<{ ok: boolean; error?: string; tablesMissing?: boolean }> {
  try {
    const { error } = await supabase.from('finance_sync').upsert(
      {
        id: 'current',
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
