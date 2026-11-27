export function getSupabaseEnv(overrideUrl?: string, overrideKey?: string): {
  url: string;
  key: string;
  isConfigured: boolean;
} {
  const url = (
    overrideUrl ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ''
  ).trim();
  const key = (
    overrideKey ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    ''
  ).trim();

  const isConfigured =
    Boolean(url) &&
    Boolean(key) &&
    !url.includes('TWOJ_PROJEKT') &&
    !url.includes('placeholder.supabase.co');

  return { url, key, isConfigured };
}
