function readMeta(name) {
  const el = document.querySelector(`meta[name="${name}"]`);
  const value = el?.getAttribute('content')?.trim();
  if (!value) {
    console.error(`[LinkLens config] Missing required meta: ${name}`);
    return '';
  }
  return value;
}

export const SUPABASE_URL = readMeta('LL_SUPABASE_URL');
export const SUPABASE_KEY = readMeta('LL_SUPABASE_KEY');
export const WORKER_BASE_URL = readMeta('LL_WORKER_BASE_URL');
