import { sb, refreshSession } from '../supabase.js';
import { state } from './state.js';
import { toast } from './ui.js';

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
  const runLoad = async () => {
    const [artsRes, colsRes] = await Promise.all([
      sb.from('articles').select('*').order('created_at', { ascending: false }),
      sb.from('collections').select('*').order('created_at', { ascending: true }),
    ]);
    if (artsRes.error) throw artsRes.error;
    if (colsRes.error) throw colsRes.error;
    state.articles = (artsRes.data || []).map(mapArticleRow);
    state.collections = (colsRes.data || []).map(mapCollectionRow);
  };

  try {
    await runLoad();
  } catch (e) {
    const msg = (e?.message || String(e)).toLowerCase();
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
  const { data, error } = await sb.from('articles').insert(toDB(a)).select().single();
  if (error) throw new Error(error.message + ' (code:' + error.code + ')');
  if (!data) throw new Error('저장 실패 - Supabase 응답이 없습니다');
  return data.id;
}

export async function dbUpd(id, f) {
  await sb.from('articles').update(f).eq('id', id);
}

export async function dbDel(id) {
  await sb.from('articles').delete().eq('id', id);
}

export async function dbInsCol(c) {
  const { data, error } = await sb
    .from('collections')
    .insert({ user_id: state.currentUser.id, name: c.name, color: c.color })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

export async function dbUpdCol(id, f) {
  const { error } = await sb.from('collections').update(f).eq('id', id);
  if (error) throw error;
}

export async function dbDelCol(id) {
  const { error } = await sb.from('collections').delete().eq('id', id);
  if (error) throw error;
}
