import { WORKER_BASE_URL } from './config.js';
import { getAccessToken } from './supabase.js';
import { toast } from './ui.js';

const ANALYZE_URL = WORKER_BASE_URL + '/analyze';
const PREVIEW_URL = WORKER_BASE_URL + '/preview';

function buildJsonHeaders(options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.authorization && !headers.Authorization) {
    headers.Authorization = options.authorization;
  }
  return headers;
}

async function requestWorker(url, body, options = {}) {
  const token = await getAccessToken();
  const headers = buildJsonHeaders({
    ...options,
    authorization: token ? `Bearer ${token}` : undefined,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (res.status === 401) {
    toast('세션이 만료되었습니다', 'err');
  }

  if (!res.ok) {
    throw new Error('Worker ' + res.status);
  }

  return await res.json();
}

export function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export async function analyzeWithAI(url, options = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 25000);
  try {
    return await requestWorker(ANALYZE_URL, { url }, { ...options, signal: options.signal || ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

export async function previewWithAI(url, options = {}) {
  return await requestWorker(PREVIEW_URL, { url }, options);
}

export function getPreviewEndpoint() {
  return PREVIEW_URL;
}
