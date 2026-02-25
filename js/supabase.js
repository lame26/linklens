import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { safeStorage } from './storage.js';

export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
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
});

export async function refreshSession() {
  return sb.auth.refreshSession();
}

export async function getAccessToken() {
  const { data, error } = await sb.auth.getSession();
  if (error) return '';
  return data?.session?.access_token || '';
}
