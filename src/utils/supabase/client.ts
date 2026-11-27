import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './config';

export const createClient = (overrideUrl?: string, overrideKey?: string) => {
  const { url, key, isConfigured } = getSupabaseEnv(overrideUrl, overrideKey);
  if (!isConfigured) {
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    );
  }
  return createBrowserClient(url, key);
};
