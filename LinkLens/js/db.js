import { sb, refreshSession } from './supabase.js';
import { state } from './state.js';
import { toast } from './ui.js';
import { getArticleCache, setArticleCache } from './storage.js';

const DB_READ_TIMEOUT_MS = 30000;
const DB_WRITE_TIMEOUT_MS = 12000;

function withTimeout(promise, message, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function mapArticleRow(r) {
  return {
    id: r.id,
    url: r.url,
    title: r.title || '',
    source: r.source || '',
    category: r.category || 'default',
    summary: r.summary || '',
    keywords: r.keywords || [],
    tags: r.tags || [],
    status: r.status || 'unread',
    starred: r.starred || false,
    rating: r.rating || 0,
    memo: r.memo || '',
    collections: r.collections || [],
    date: r.date || r.created_at?.split('T')[0] || '',
  };
}

function mapCollectionRow(r) {
  return {
    id: r.id,
    name: r.name,
    color: r.color || '#a78bfa',
  };
}

async function requireAuthContext() {
  if (!sb) throw new Error('인증 서비스가 초기화되지 않았습니다');
  if (!state.currentUser?.id) throw new Error('로그인이 필요합니다');
  return state.currentUser.id;
}

function toDB(a) {
  return {
    user_id: state.currentUser.id,
    url: a.url,
    title: a.title,
    source: a.source,
    category: a.category,
    summary: a.summary,
    keywords: a.keywords,
    tags: a.tags,
    status: a.status,
    starred: a.starred,
    rating: a.rating,
    memo: a.memo,
    collections: a.collections,
    date: a.date,
  };
}

export async function loadFromDB() {
  const userId = await requireAuthContext();
  const cachedBefore = getArticleCache(userId);
  const runLoad = async () => {
    const [artsRes, colsRes] = await withTimeout(
      Promise.all([
        sb.from('articles').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        sb.from('collections').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      ]),
      'DB 조회 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.',
      DB_READ_TIMEOUT_MS,
    );
    if (artsRes.error) throw artsRes.error;
    if (colsRes.error) throw colsRes.error;
    const loadedArticles = (artsRes.data || []).map(mapArticleRow);
    const loadedCollections = (colsRes.data || []).map(mapCollectionRow);
    const hasLoaded = loadedArticles.length > 0 || loadedCollections.length > 0;
    const hasCached = (cachedBefore.articles || []).length > 0 || (cachedBefore.collections || []).length > 0;

    // 초기 세션 복구 타이밍에 간헐적으로 빈 결과가 떨어지는 경우 캐시를 유지한다.
    if (!hasLoaded && hasCached) {
      state.articles = cachedBefore.articles || [];
      state.collections = cachedBefore.collections || [];
      toast('동기화 지연으로 이전 목록을 유지합니다', 'info');
      return;
    }

    state.articles = loadedArticles;
    state.collections = loadedCollections;
    setArticleCache(userId, { articles: state.articles, collections: state.collections });
  };

  try {
    await runLoad();
  } catch (e) {
    const msg = (e?.message || String(e)).toLowerCase();
    const isTimeout = msg.includes('시간이 초과');
    if (isTimeout) {
      const cached = getArticleCache(userId);
      if ((cached.articles || []).length || (cached.collections || []).length) {
        state.articles = cached.articles || [];
        state.collections = cached.collections || [];
        toast('네트워크 지연으로 캐시된 목록을 표시합니다', 'info');
        return;
      }
    }
    const authErr = msg.includes('jwt') || msg.includes('token') || msg.includes('refresh');
    if (authErr) {
      try {
        await refreshSession();
        await runLoad();
        return;
      } catch (e2) {
        console.error('loadFromDB retry failed:', e2);
        toast('DB 로드 실패: ' + (e2.message || e2), 'err');
        throw e2;
      }
    }
    console.error('loadFromDB failed:', e);
    toast('DB 로드 실패: ' + (e.message || e), 'err');
    throw e;
  }
}

export async function dbIns(a) {
  const userId = await requireAuthContext();
  const payload = { ...toDB(a), user_id: userId };
  const { data, error } = await withTimeout(
    sb.from('articles').insert(payload).select().single(),
    '저장 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
    DB_WRITE_TIMEOUT_MS,
  );
  if (error) throw new Error(error.message + ' (code:' + error.code + ')');
  if (!data) throw new Error('저장 실패 - Supabase 응답이 없습니다');
  return data.id;
}

export async function dbUpd(id, f) {
  const userId = await requireAuthContext();
  const { error } = await withTimeout(
    sb.from('articles').update(f).eq('id', id).eq('user_id', userId),
    '업데이트 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
    DB_WRITE_TIMEOUT_MS,
  );
  if (error) throw error;
}

export async function dbDel(id) {
  const userId = await requireAuthContext();
  const { error } = await withTimeout(
    sb.from('articles').delete().eq('id', id).eq('user_id', userId),
    '삭제 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
    DB_WRITE_TIMEOUT_MS,
  );
  if (error) throw error;
}

export async function dbInsCol(c) {
  const userId = await requireAuthContext();
  const { data, error } = await withTimeout(
    sb
      .from('collections')
      .insert({ user_id: userId, name: c.name, color: c.color })
      .select()
      .single(),
    '컬렉션 저장 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
    DB_WRITE_TIMEOUT_MS,
  );
  if (error) throw error;
  return data.id;
}

export async function dbUpdCol(id, f) {
  const userId = await requireAuthContext();
  const { error } = await withTimeout(
    sb.from('collections').update(f).eq('id', id).eq('user_id', userId),
    '컬렉션 업데이트 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
    DB_WRITE_TIMEOUT_MS,
  );
  if (error) throw error;
}

export async function dbDelCol(id) {
  const userId = await requireAuthContext();
  const { error } = await withTimeout(
    sb.from('collections').delete().eq('id', id).eq('user_id', userId),
    '컬렉션 삭제 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
    DB_WRITE_TIMEOUT_MS,
  );
  if (error) throw error;
}
