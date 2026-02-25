import { SUPABASE_URL, SUPABASE_KEY } from './js/config.js';
import { safeStorage } from './js/storage.js';

export const sb = typeof supabase !== 'undefined'
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
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
