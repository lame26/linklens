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
    let body = '';
    try { body = await res.text(); } catch {}
    // Worker가 구버전일 때 OpenAI 파싱 실패를 500으로 반환할 수 있다.
    // 저장 플로우를 깨지 않도록 안전 기본값으로 처리한다.
    if (
      res.status === 500 &&
      (body.includes('OpenAI response parse failed') || body.includes('OpenAI connection failed'))
    ) {
      console.warn('[Worker] parse-failed fallback:', body);
      return { title: '', summary: '', keywords: [], category: 'default' };
    }
    console.error(`[Worker] ${res.status} ${res.url}`, body);
    throw new Error(`Worker ${res.status}${body ? ': ' + body.slice(0, 100) : ''}`);
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
