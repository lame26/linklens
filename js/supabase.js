import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { safeStorage } from './storage.js';

const supabaseGlobal = typeof globalThis !== 'undefined' ? globalThis.supabase : undefined;

if (!supabaseGlobal) {
  console.error('[LinkLens] Supabase client unavailable: global `supabase` is missing');
}

export const sb = supabaseGlobal
  ? supabaseGlobal.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        lock: async (name, acquireTimeout, fn) => {
          return await fn();
        },
        storageKey: 'll_auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: safeStorage,
      },
    })
  : null;

export async function refreshSession() {
  if (!sb) return null;
  return sb.auth.refreshSession();
}

export async function getAccessToken() {
  if (!sb) return '';
  const { data, error } = await sb.auth.getSession();
  if (error) return '';
  return data?.session?.access_token || '';
}
