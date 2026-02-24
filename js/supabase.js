import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { safeStorage } from './storage.js';

const createClient = globalThis.supabase?.createClient;

if (!createClient) {
  console.error('[LinkLens] Supabase SDK is not loaded');
}

export const sb = createClient
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
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
  if (!sb) throw new Error('Supabase SDK not loaded');
  return sb.auth.refreshSession();
}

export async function getAccessToken() {
  if (!sb) return '';
  const { data, error } = await sb.auth.getSession();
  if (error) return '';
  return data?.session?.access_token || '';
}
