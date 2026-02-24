import { state, CAT_LABEL, CAT_TAG_CLASS, COL_COLORS, SVG } from './state.js';
import { setTrash } from './storage.js';
import { analyzeWithAI, getDomain, previewWithAI, today } from './workerClient.js';
import { dbDel, dbDelCol, dbIns, dbInsCol, dbUpd, dbUpdCol } from './db.js';
import { escapeHtml, refresh, startLoading, stopLoading, toast } from './ui.js';

export function cancelUrlAnalysis() {
  clearTimeout(state.urlDebounce);
  if (state.urlAbortCtrl) {
    state.urlAbortCtrl.abort();
    state.urlAbortCtrl = null;
  }
}

export async function onUrlInput() {
  const url = document.getElementById('fUrl').value.trim();
  const titleEl = document.getElementById('fTitle');
  cancelUrlAnalysis();
  if (!url || titleEl.dataset.manualEdit === '1') return;

  try {
    new URL(url);
  } catch {
    return;
  }

  state.urlDebounce = setTimeout(async () => {
    titleEl.placeholder = 'URL 미리보기 로딩 중..';
    state.urlAbortCtrl = new AbortController();

    try {
      const result = await previewWithAI(url, { signal: state.urlAbortCtrl.signal });
      if (result.title && document.getElementById('fTitle').dataset.manualEdit !== '1') {
        document.getElementById('fTitle').value = result.title;
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.warn('미리보기 실패:', e.message);
    } finally {
      state.urlAbortCtrl = null;
      titleEl.placeholder = '기사 제목을 입력하거나 자동 감지됩니다';
    }
  }, 600);
}

function makeTagChip(label, onRemove) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tag-editable';

  const span = document.createElement('span');
  span.textContent = label;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '×';
  btn.addEventListener('click', onRemove);

  wrapper.append(span, btn);
  return wrapper;
}

export function openAddModal() {
  state.addingTags = [];
  renderAddTags();
  document.getElementById('fUrl').value = '';
  const ft = document.getElementById('fTitle');
  ft.value = '';
  ft.dataset.manualEdit = '0';
  ft.placeholder = '기사 제목을 입력하거나 자동 감지됩니다';
  document.getElementById('fMemo').value = '';
  document.getElementById('fCat').value = 'tech';
  document.getElementById('fStatus').value = 'unread';
  document.getElementById('addOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fUrl').focus(), 100);
}

export function closeAddModal() {
  document.getElementById('addOverlay').classList.remove('open');
}

export async function doPaste() {
  try {
    const t = await navigator.clipboard.readText();
    document.getElementById('fUrl').value = t;
    onUrlInput();
  } catch {
    toast('클립보드 접근 권한이 필요합니다', 'err');
  }
}

export function renderAddTags() {
  const editor = document.getElementById('fTagEditor');
  const input = document.getElementById('fTagInput');
  editor.innerHTML = '';

  state.addingTags.forEach((t, i) => {
    editor.appendChild(makeTagChip(t, () => removeAddTag(i)));
  });

  editor.appendChild(input);
  input.value = '';
}

export function addTagKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/^#/, '');
    if (val && !state.addingTags.includes(val)) {
      state.addingTags.push(val);
      renderAddTags();
    }
    e.target.value = '';
  }
}

export function removeAddTag(i) {
  state.addingTags.splice(i, 1);
  renderAddTags();
}

export async function saveArticle() {
  const url = document.getElementById('fUrl').value.trim();
  if (!url) {
    toast('URL을 입력해주세요', 'err');
    return;
  }

  try {
    new URL(url);
  } catch {
    toast('올바른 URL을 입력해주세요', 'err');
    return;
  }

  cancelUrlAnalysis();

  const btn = document.querySelector('#addOverlay .btn-primary');
  const btnOriginal = btn.innerHTML;
  const SPIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;animation:spin 0.8s linear infinite"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`;

  btn.disabled = true;
  btn.innerHTML = SPIN + ' 저장 중...';
  startLoading();

  const cat = document.getElementById('fCat').value;
  const status = document.getElementById('fStatus').value;
  const memo = document.getElementById('fMemo').value;
  const titleInp = document.getElementById('fTitle').value.trim();

  const a = {
    url,
    category: cat,
    status,
    memo,
    title: titleInp || getDomain(url) || url,
    source: getDomain(url),
    summary: '',
    keywords: [],
    tags: [...state.addingTags],
    date: today(),
    starred: false,
    rating: 0,
    collections: [],
  };

  let savedId = null;
  try {
    savedId = await dbIns(a);
  } catch (e) {
    console.error('dbIns failed:', e);
    toast('저장 실패: ' + e.message, 'err');
    stopLoading();
    btn.disabled = false;
    btn.innerHTML = btnOriginal;
    return;
  }

  a.id = savedId;
  state.articles.unshift(a);
  refresh();
  closeAddModal();
  stopLoading();
  btn.disabled = false;
  btn.innerHTML = btnOriginal;
  toast('저장되었습니다. AI 분석 중입니다...', 'ok');

  try {
    const result = await analyzeWithAI(url);
    const finalTitle = titleInp || result.title || getDomain(url) || url;
    const updates = {
      title: finalTitle,
      summary: result.summary || '',
      keywords: result.keywords || [],
      category: result.category || cat,
    };
    await dbUpd(savedId, updates);
    const art = state.articles.find((x) => x.id === savedId);
    if (art) Object.assign(art, updates);
    refresh();
    toast('AI 분석이 완료되었습니다', 'ok');
  } catch (e) {
    console.warn('AI 분석 실패:', e.message);
    toast('AI 분석 실패: 잠시 후 다시 시도해주세요', 'err');
  }
}

export function renderColorPicker(selectedColor) {
  const cp = document.getElementById('colorPicker');
  if (!cp) return;
  cp.innerHTML = COL_COLORS.map((c) => `<div class="color-swatch ${c === selectedColor ? 'selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectColor(this)"></div>`).join('');
}

export function selectColor(el) {
  document.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'));
  el.classList.add('selected');
}

export function openColModal(colId = null) {
  state.editingCollectionId = colId;
  const target = state.collections.find((c) => c.id === colId);
  document.getElementById('colName').value = target?.name || '';
  renderColorPicker(target?.color || COL_COLORS[0]);
  document.getElementById('colModalTitle').textContent = target ? '컬렉션 수정' : '컬렉션 만들기';
  document.getElementById('colSaveBtn').textContent = target ? '저장' : '만들기';
  document.getElementById('colOverlay').classList.add('open');
  setTimeout(() => document.getElementById('colName').focus(), 100);
}

export function closeColModal() {
  state.editingCollectionId = null;
  document.getElementById('colOverlay').classList.remove('open');
}

export async function saveCollection() {
  const name = document.getElementById('colName').value.trim();
  if (!name) {
    toast('컬렉션 이름을 입력해주세요', 'err');
    return;
  }

  const sel = document.querySelector('.color-swatch.selected');
  const color = sel ? sel.dataset.color : COL_COLORS[0];

  try {
    if (state.editingCollectionId) {
      await dbUpdCol(state.editingCollectionId, { name, color });
      const col = state.collections.find((c) => c.id === state.editingCollectionId);
      if (col) {
        col.name = name;
        col.color = color;
      }
      toast('컬렉션이 수정되었습니다', 'ok');
    } else {
      const newId = await dbInsCol({ name, color });
      state.collections.push({ id: newId, name, color });
      toast(`컬렉션 "${name}" 만들어졌습니다`, 'ok');
    }
    refresh();
    closeColModal();
  } catch (e) {
    toast('컬렉션 저장 실패: ' + e.message, 'err');
  }
}

export async function deleteCollection(colId) {
  const col = state.collections.find((c) => c.id === colId);
  if (!col) return;
  if (!confirm(`컬렉션 "${col.name}" 을(를) 삭제할까요?`)) return;

  try {
    await dbDelCol(colId);
    const touched = state.articles.filter((a) => (a.collections || []).includes(colId));
    for (const art of touched) {
      art.collections = (art.collections || []).filter((id) => id !== colId);
      await dbUpd(art.id, { collections: art.collections });
    }
    state.collections = state.collections.filter((c) => c.id !== colId);
    if (state.colFilter === colId) state.colFilter = null;
    refresh();
    toast('컬렉션이 삭제되었습니다', 'ok');
  } catch (e) {
    toast('컬렉션 삭제 실패: ' + e.message, 'err');
  }
}

export function openPanel(id) {
  const a = state.articles.find((x) => x.id === id);
  if (!a) return;
  state.selectedId = id;

  document.getElementById('pThumb').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
  document.getElementById('pTitle').textContent = a.title;
  document.getElementById('pSource').textContent = a.source || '';
  document.getElementById('pDate').textContent = a.date || '';
  document.getElementById('pSummary').textContent = a.summary || '요약 없음';
  document.getElementById('pMemo').value = a.memo || '';
  document.getElementById('pStatus').value = a.status;
  document.getElementById('pLink').href = a.url;

  const ct = document.getElementById('pCatTag');
  ct.textContent = CAT_LABEL[a.category] || '기타';
  ct.className = `tag ${CAT_TAG_CLASS[a.category] || 'tag-default'}`;

  const starBtn = document.getElementById('pStarBtn');
  starBtn.classList.toggle('active', !!a.starred);
  starBtn.innerHTML = a.starred ? SVG.starFill : SVG.star;

  document.getElementById('pKeywords').innerHTML = (a.keywords || []).map((k) => `<span class="kw">${escapeHtml(k)}</span>`).join('');

  state.editingTags = [...(a.tags || [])];
  renderPanelTags();
  renderColAssign(a);
  renderPanelStars(a.rating || 0);

  document.getElementById('panel').classList.add('open');
  document.getElementById('panelOv').classList.add('open');

  if (a.status === 'unread') {
    a.status = 'read';
    dbUpd(a.id, { status: 'read' });
    refresh();
  }
}

export function closePanel() {
  document.getElementById('panel').classList.remove('open');
  document.getElementById('panelOv').classList.remove('open');
  state.selectedId = null;
}

export function renderPanelTags() {
  const editor = document.getElementById('pTagEditor');
  const input = document.getElementById('pTagInput');
  editor.innerHTML = '';

  state.editingTags.forEach((t, i) => {
    editor.appendChild(makeTagChip(t, () => removePanelTag(i)));
  });

  editor.appendChild(input);
  input.value = '';
}

export function addPanelTagKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/^#/, '');
    if (val && !state.editingTags.includes(val)) {
      state.editingTags.push(val);
      renderPanelTags();
      const a = state.articles.find((x) => x.id === state.selectedId);
      if (a) {
        a.tags = state.editingTags;
        dbUpd(a.id, { tags: state.editingTags });
      }
    }
    e.target.value = '';
  }
}

export function removePanelTag(i) {
  state.editingTags.splice(i, 1);
  renderPanelTags();
  const a = state.articles.find((x) => x.id === state.selectedId);
  if (a) {
    a.tags = state.editingTags;
    dbUpd(a.id, { tags: state.editingTags });
  }
}

export function renderColAssign(a) {
  const wrap = document.getElementById('pColAssign');
  if (!wrap) return;

  if (state.collections.length === 0) {
    wrap.innerHTML = '<span style="font-size:12px;color:var(--text3)">컬렉션이 없습니다</span>';
    return;
  }

  wrap.innerHTML = '';
  state.collections.forEach((c) => {
    const assigned = (a.collections || []).includes(c.id);
    const btn = document.createElement('button');
    btn.className = `col-chip ${assigned ? 'assigned' : ''}`;
    btn.type = 'button';

    const dot = document.createElement('div');
    dot.className = 'col-chip-dot';
    dot.style.background = c.color;

    const name = document.createElement('span');
    name.textContent = c.name;

    btn.appendChild(dot);
    btn.appendChild(name);
    btn.addEventListener('click', () => toggleColAssign(c.id));
    wrap.appendChild(btn);
  });
}

export async function toggleColAssign(colId) {
  const a = state.articles.find((x) => x.id === state.selectedId);
  if (!a) return;
  if (!a.collections) a.collections = [];
  const idx = a.collections.indexOf(colId);
  if (idx >= 0) a.collections.splice(idx, 1);
  else a.collections.push(colId);
  await dbUpd(a.id, { collections: a.collections });
  refresh();
  renderColAssign(a);
}

export function renderPanelStars(r) {
  const wrap = document.getElementById('pStars');
  wrap.innerHTML = '';
  [1, 2, 3, 4, 5].forEach((i) => {
    const span = document.createElement('span');
    span.className = 'star-btn';
    span.textContent = r >= i ? '★' : '☆';
    span.addEventListener('click', () => setRating(i));
    wrap.appendChild(span);
  });
}

export async function setRating(r) {
  const a = state.articles.find((x) => x.id === state.selectedId);
  if (!a) return;
  a.rating = r;
  await dbUpd(a.id, { rating: r });
  refresh();
  renderPanelStars(r);
}

export async function savePanelMemo() {
  const a = state.articles.find((x) => x.id === state.selectedId);
  if (a) {
    a.memo = document.getElementById('pMemo').value;
    await dbUpd(a.id, { memo: a.memo });
  }
}

export async function savePanelStatus() {
  const a = state.articles.find((x) => x.id === state.selectedId);
  if (a) {
    a.status = document.getElementById('pStatus').value;
    await dbUpd(a.id, { status: a.status });
    refresh();
    toast('상태가 업데이트되었습니다', 'info');
  }
}

export async function togglePanelStar() {
  const a = state.articles.find((x) => x.id === state.selectedId);
  if (!a) return;
  a.starred = !a.starred;
  const starBtn = document.getElementById('pStarBtn');
  starBtn.classList.toggle('active', a.starred);
  starBtn.innerHTML = a.starred ? SVG.starFill : SVG.star;
  await dbUpd(a.id, { starred: a.starred });
  refresh();
  toast(a.starred ? '즐겨찾기에 추가했습니다' : '즐겨찾기에서 제거했습니다', 'info');
}

export function trashFromPanel() {
  if (!confirm('기사를 휴지통으로 이동할까요?')) return;
  moveToTrash(state.selectedId);
  closePanel();
}

export async function toggleStar(id) {
  const a = state.articles.find((x) => x.id === id);
  if (!a) return;
  a.starred = !a.starred;
  await dbUpd(id, { starred: a.starred });
  refresh();
  toast(a.starred ? '즐겨찾기에 추가했습니다' : '즐겨찾기에서 제거했습니다', 'info');
}

export async function moveToTrash(id) {
  const idx = state.articles.findIndex((a) => a.id === id);
  if (idx < 0) return;
  const [a] = state.articles.splice(idx, 1);
  a.trashedAt = Date.now();
  state.trash.unshift(a);
  setTrash(state.trash);
  await dbDel(id);
  refresh();
  toast('휴지통으로 이동했습니다', 'info');
}

export function restoreFromTrash(id) {
  const idx = state.trash.findIndex((a) => a.id === id);
  if (idx < 0) return;
  const [a] = state.trash.splice(idx, 1);
  delete a.trashedAt;
  dbIns(a).then((newId) => {
    a.id = newId;
    state.articles.unshift(a);
    setTrash(state.trash);
    refresh();
    toast('기사를 복원했습니다', 'ok');
  });
}

export function deleteForever(id) {
  if (!confirm('이 기사를 영구 삭제할까요?')) return;
  state.trash = state.trash.filter((a) => a.id !== id);
  setTrash(state.trash);
  refresh();
  toast('영구 삭제되었습니다', 'info');
}

export function emptyTrash() {
  if (!confirm(`휴지통의 ${state.trash.length}개 항목을 모두 삭제할까요?`)) return;
  state.trash = [];
  setTrash(state.trash);
  refresh();
  toast('휴지통을 비웠습니다', 'ok');
}
