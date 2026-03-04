const memStore = {};

export const safeStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return Object.prototype.hasOwnProperty.call(memStore, key) ? memStore[key] : null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
    memStore[key] = value;
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
    delete memStore[key];
  },
};

export function getJson(key, fallback) {
  const raw = safeStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setJson(key, value) {
  safeStorage.setItem(key, JSON.stringify(value));
}

export function getTheme() {
  return safeStorage.getItem('ll_theme') || 'dark';
}

export function setTheme(theme) {
  safeStorage.setItem('ll_theme', theme);
}

export function getTrash() {
  return getJson('ll_trash', []);
}

export function setTrash(trash) {
  setJson('ll_trash', trash);
}

function cacheKey(userId) {
  return `ll_cache_${userId || 'anon'}`;
}

export function getArticleCache(userId) {
  return getJson(cacheKey(userId), { articles: [], collections: [], ts: 0 });
}

export function setArticleCache(userId, payload) {
  if (!userId) return;
  setJson(cacheKey(userId), {
    articles: Array.isArray(payload?.articles) ? payload.articles : [],
    collections: Array.isArray(payload?.collections) ? payload.collections : [],
    ts: Date.now(),
  });
}

export function clearArticleCache(userId) {
  safeStorage.removeItem(cacheKey(userId));
}

export function clearAppStorage() {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-') || k.startsWith('supabase') || k === 'll_auth' || k.startsWith('ll_cache_')) {
        localStorage.removeItem(k);
      }
    });
  } catch {}

  Object.keys(memStore).forEach((k) => {
    delete memStore[k];
  });
}
