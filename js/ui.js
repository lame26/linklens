import { state, CAT_TAG_CLASS, CAT_LABEL, STATUS_CLASS, STATUS_LABEL, SVG } from './state.js';
import { setTheme as saveTheme } from './storage.js';

export function escapeHtml(text) {
  const s = String(text ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function initThemeUI() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeBtn').textContent = state.theme === 'dark' ? '☾' : '☀';
}

export function startLoading() {
  const b = document.getElementById('loadingBar');
  b.classList.remove('done');
  b.classList.add('go');
}

export function stopLoading() {
  const b = document.getElementById('loadingBar');
  b.classList.add('done');
  setTimeout(() => b.classList.remove('go', 'done'), 300);
}

export function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.className = `toast ${type}`;
  document.getElementById('toastMsg').textContent = msg;
  el.classList.add('show');
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

export function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('themeBtn').textContent = state.theme === 'dark' ? '☾' : '☀';
  saveTheme(state.theme);
}

export function setFilter(f, el) {
  state.filter = f;
  state.catFilter = null;
  state.colFilter = null;
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const t = {
    all: '전체 기사',
    unread: '미읽음',
    later: '나중에 읽기',
    starred: '즐겨찾기',
    trash: '휴지통',
  };
  document.getElementById('pageTitle').textContent = t[f] || f;
  renderArticles();
}

export function setCat(cat, el) {
  state.filter = 'all';
  state.catFilter = cat;
  state.colFilter = null;
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const l = {
    tech: '테크/IT',
    economy: '경제/금융',
    ai: 'AI/미래',
    science: '과학',
    politics: '정치/사회',
  };
  document.getElementById('pageTitle').textContent = l[cat] || cat;
  renderArticles();
}

export function setColFilter(id, el) {
  state.filter = 'all';
  state.catFilter = null;
  state.colFilter = id;
  document.querySelectorAll('.nav-btn,.col-btn').forEach((b) => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const col = state.collections.find((c) => c.id === id);
  document.getElementById('pageTitle').textContent = col ? col.name : '컬렉션';
  renderArticles();
}

export function setSort(s, el) {
  state.sortMode = s;
  document.querySelectorAll('.toolbar .chip').forEach((c, idx) => {
    if (idx < 3) c.classList.remove('active');
  });
  if (el) el.classList.add('active');
  renderArticles();
}

export function toggleUnread(el) {
  state.unreadOnly = !state.unreadOnly;
  el.classList.toggle('active', state.unreadOnly);
  renderArticles();
}

export function setView(v) {
  state.viewMode = v;
  document.getElementById('btnGrid').classList.toggle('active', v === 'grid');
  document.getElementById('btnList').classList.toggle('active', v === 'list');
  renderArticles();
}

export function doSearch() {
  state.searchQ = document.getElementById('searchInput').value;
  renderArticles();
}

function getList() {
  if (state.filter === 'trash') return [...state.trash].sort((a, b) => b.id - a.id);
  let list = [...state.articles];
  if (state.filter === 'unread') list = list.filter((a) => a.status === 'unread');
  else if (state.filter === 'later') list = list.filter((a) => a.status === 'later');
  else if (state.filter === 'starred') list = list.filter((a) => a.starred);
  if (state.catFilter) list = list.filter((a) => a.category === state.catFilter);
  if (state.colFilter !== null) list = list.filter((a) => a.collections && a.collections.includes(state.colFilter));
  if (state.unreadOnly) list = list.filter((a) => a.status === 'unread');
  if (state.searchQ) {
    const q = state.searchQ.toLowerCase();
    list = list.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      (a.summary || '').toLowerCase().includes(q) ||
      (a.keywords || []).some((k) => k.toLowerCase().includes(q)) ||
      (a.tags || []).some((t) => t.toLowerCase().includes(q)) ||
      (a.source || '').toLowerCase().includes(q),
    );
  }
  if (state.sortMode === 'newest') list.sort((a, b) => b.id - a.id);
  else if (state.sortMode === 'oldest') list.sort((a, b) => a.id - b.id);
  else if (state.sortMode === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return list;
}

function cardHTML(a) {
  const it = state.filter === 'trash';
  const tc = CAT_TAG_CLASS[a.category] || 'tag-default';
  const cl = CAT_LABEL[a.category] || '기타';
  const sc = STATUS_CLASS[a.status] || 'status-read';
  const sl = STATUS_LABEL[a.status] || '';

  const source = escapeHtml(a.source || '');
  const date = escapeHtml(a.date || '');
  const title = escapeHtml(a.title || '');
  const summary = escapeHtml(a.summary || '요약 없음');
  const catLabel = escapeHtml(cl);
  const ut = (a.tags || []).slice(0, 2).map((t) => `<span class="tag tag-default">#${escapeHtml(t)}</span>`).join('');

  const ta = it
    ? `<button class="sm-btn" onclick="event.stopPropagation();restoreFromTrash(${a.id})" title="복원">${SVG.restore}</button><button class="sm-btn trash" onclick="event.stopPropagation();deleteForever(${a.id})">${SVG.trash}</button>`
    : `<button class="sm-btn ${a.starred ? 'starred' : ''}" onclick="event.stopPropagation();toggleStar(${a.id})">${a.starred ? SVG.starFill : SVG.star}</button><button class="sm-btn trash" onclick="event.stopPropagation();moveToTrash(${a.id})">${SVG.trash}</button>`;

  return `<div class="card" onclick="${it ? '' : `openPanel(${a.id})`}" ${it ? 'style="cursor:default"' : ''}>${a.status === 'unread' && !it ? '<div class="card-unread-dot"></div>' : ''}<div class="card-thumb"><div class="card-thumb-placeholder">${SVG.link}</div></div><div class="card-body"><div class="card-meta"><span class="card-source">${source}</span><span class="card-date">${date}</span></div><div class="card-title">${title}</div><div class="card-summary">${summary}</div><div class="card-tags"><span class="tag ${tc}">${catLabel}</span>${ut}</div><div class="card-footer"><div class="card-actions">${ta}</div>${!it ? `<span class="status-pill ${sc}">${sl}</span>` : ''}</div></div></div>`;
}

function listHTML(a) {
  const it = state.filter === 'trash';
  const tc = CAT_TAG_CLASS[a.category] || 'tag-default';
  const cl = CAT_LABEL[a.category] || '기타';
  const sc = STATUS_CLASS[a.status] || 'status-read';
  const sl = STATUS_LABEL[a.status] || '';

  const source = escapeHtml(a.source || '');
  const date = escapeHtml(a.date || '');
  const title = escapeHtml(a.title || '');
  const summary = escapeHtml(a.summary || '');
  const catLabel = escapeHtml(cl);

  const ta = it
    ? `<button class="sm-btn" onclick="event.stopPropagation();restoreFromTrash(${a.id})">${SVG.restore}</button><button class="sm-btn trash" onclick="event.stopPropagation();deleteForever(${a.id})">${SVG.trash}</button>`
    : `<button class="sm-btn ${a.starred ? 'starred' : ''}" onclick="event.stopPropagation();toggleStar(${a.id})">${a.starred ? SVG.starFill : SVG.star}</button><button class="sm-btn trash" onclick="event.stopPropagation();moveToTrash(${a.id})">${SVG.trash}</button>`;

  return `<div class="list-item" onclick="${it ? '' : `openPanel(${a.id})`}" ${it ? 'style="cursor:default"' : ''}><div class="list-thumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div><div class="list-body"><div class="list-title">${title}</div><div class="list-sub"><span class="card-source">${source}</span><span class="card-date">${date}</span><span class="tag ${tc}">${catLabel}</span></div><div class="list-summary">${summary}</div></div><div class="list-right">${!it ? `<span class="status-pill ${sc}">${sl}</span>` : ''}<div class="card-actions">${ta}</div></div></div>`;
}

export function renderArticles() {
  const wrap = document.getElementById('articlesWrap');
  wrap.className = state.viewMode === 'grid' ? 'grid-view' : 'list-view';
  const list = getList();
  let trashBar = '';

  if (state.filter === 'trash' && state.trash.length > 0) {
    trashBar = `<div class="trash-note" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>삭제한 항목이 임시 보관됩니다.<button class="btn-empty-trash" onclick="emptyTrash()">휴지통 비우기</button></div>`;
  }

  if (list.length === 0) {
    const em = state.filter === 'trash' ? '휴지통이 비어 있습니다' : '아직 저장된 기사가 없습니다';
    const ed = state.filter === 'trash' ? '삭제한 기사는 여기에 표시됩니다' : '"링크 추가" 버튼으로 기사를 저장해보세요';
    wrap.innerHTML = `${trashBar}<div class="empty" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><div class="empty-title">${em}</div><div class="empty-desc">${ed}</div></div>`;
    return;
  }

  wrap.innerHTML = trashBar + list.map((a) => (state.viewMode === 'grid' ? cardHTML(a) : listHTML(a))).join('');
}

export function renderCollectionList() {
  const wrap = document.getElementById('colList');
  if (!wrap) return;
  if (state.collections.length === 0) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = state.collections
    .map((c) => {
      const cnt = state.articles.filter((a) => a.collections && a.collections.includes(c.id)).length;
      const active = state.colFilter === c.id ? 'active' : '';
      const colName = escapeHtml(c.name);
      return `<div style="display:flex;align-items:center;gap:4px;margin-bottom:2px"><button class="col-btn ${active}" onclick="setColFilter(${c.id},this)" ondblclick="openColModal(${c.id})"><div class="col-dot" style="background:${c.color}"></div><span class="col-name">${colName}</span><span class="col-count">${cnt}</span></button><button class="sm-btn" title="수정" onclick="event.stopPropagation();openColModal(${c.id})">✎</button><button class="sm-btn trash" title="삭제" onclick="event.stopPropagation();deleteCollection(${c.id})">${SVG.trash}</button></div>`;
    })
    .join('');
}

export function renderSidebadges() {
  const set = (id, n) => {
    const el = document.getElementById(id);
    if (el) el.textContent = n;
  };

  set('nb-all', state.articles.length);
  set('nb-unread', state.articles.filter((a) => a.status === 'unread').length);
  set('nb-later', state.articles.filter((a) => a.status === 'later').length);
  set('nb-starred', state.articles.filter((a) => a.starred).length);
  set('nb-trash', state.trash.length);
  set('nb-tech', state.articles.filter((a) => a.category === 'tech').length);
  set('nb-economy', state.articles.filter((a) => a.category === 'economy').length);
  set('nb-ai', state.articles.filter((a) => a.category === 'ai').length);
  set('nb-science', state.articles.filter((a) => a.category === 'science').length);
  set('nb-politics', state.articles.filter((a) => a.category === 'politics').length);
}

export function updateStats() {
  document.getElementById('s-total').textContent = state.articles.length;
  document.getElementById('s-unread').textContent = state.articles.filter((a) => a.status === 'unread').length;
  document.getElementById('s-ai').textContent = state.articles.filter((a) => a.summary).length;
  document.getElementById('s-starred').textContent = state.articles.filter((a) => a.starred).length;
}

export function updatePlanBar() {
  const n = state.articles.length;
  document.getElementById('planVal').textContent = `${n} / 무제한`;
  document.getElementById('planBar').style.width = Math.min(100, (n / 50) * 100) + '%';
}

export function refresh() {
  renderSidebadges();
  renderCollectionList();
  renderArticles();
  updateStats();
  updatePlanBar();
}
