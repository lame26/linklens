import { state, authState } from './state.js';
import { loadFromDB } from './db.js';
import { analyzeWithAI, previewWithAI } from './workerClient.js';
import {
  initThemeUI,
  refresh,
  setFilter,
  setCat,
  setColFilter,
  setSort,
  toggleUnread,
  setView,
  doSearch,
  toggleTheme,
  toast,
} from './ui.js';
import {
  openAddModal,
  closeAddModal,
  doPaste,
  onUrlInput,
  addTagKey,
  removeAddTag,
  saveArticle,
  openColModal,
  closeColModal,
  saveCollection,
  selectColor,
  deleteCollection,
  openPanel,
  closePanel,
  addPanelTagKey,
  removePanelTag,
  toggleColAssign,
  setRating,
  savePanelMemo,
  savePanelStatus,
  togglePanelStar,
  trashFromPanel,
  toggleStar,
  moveToTrash,
  restoreFromTrash,
  deleteForever,
  emptyTrash,
} from './actions.js';
import {
  switchTab,
  authEnter,
  doAuth,
  doSignOut,
  toggleUserMenu,
  bindAuthUIEvents,
  bindAuthStateChange,
  bootAuth,
} from './auth.js';

window.addEventListener('error', (event) => {
  const msg = event?.error?.message || event?.message || 'Unknown error';
  console.error('Global error:', event?.error || event);
  toast('에러: ' + msg, 'err');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const msg = reason?.message || String(reason || 'Unhandled rejection');
  console.error('Unhandled rejection:', reason);
  toast('비동기 에러: ' + msg, 'err');
});

Object.assign(window, {
  switchTab,
  authEnter,
  doAuth,
  doSignOut,
  toggleUserMenu,
  toggleTheme,
  setFilter,
  setCat,
  setColFilter,
  setSort,
  toggleUnread,
  setView,
  doSearch,
  openAddModal,
  closeAddModal,
  doPaste,
  onUrlInput,
  addTagKey,
  removeAddTag,
  saveArticle,
  openColModal,
  closeColModal,
  saveCollection,
  selectColor,
  deleteCollection,
  openPanel,
  closePanel,
  addPanelTagKey,
  removePanelTag,
  toggleColAssign,
  setRating,
  savePanelMemo,
  savePanelStatus,
  togglePanelStar,
  trashFromPanel,
  toggleStar,
  moveToTrash,
  restoreFromTrash,
  deleteForever,
  emptyTrash,
});

window.LL = {
  reload: async () => {
    await loadFromDB();
    refresh();
  },
  state: () => ({
    auth: { ...authState, userId: state.currentUser?.id || null },
    counts: {
      articles: state.articles.length,
      collections: state.collections.length,
      trash: state.trash.length,
    },
    filter: {
      filter: state.filter,
      catFilter: state.catFilter,
      colFilter: state.colFilter,
      sortMode: state.sortMode,
      viewMode: state.viewMode,
      unreadOnly: state.unreadOnly,
      searchQ: state.searchQ,
    },
  }),
  analyzeUrl: (url) => analyzeWithAI(url),
  previewUrl: (url) => previewWithAI(url),
};

try { initThemeUI(); } catch (e) { console.error('initThemeUI failed:', e); }
try { refresh(); } catch (e) { console.error('refresh failed:', e); }
try { bindAuthUIEvents(); } catch (e) { console.error('bindAuthUIEvents failed:', e); }
try { bindAuthStateChange(); } catch (e) { console.error('bindAuthStateChange failed:', e); }

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAddModal();
    closeColModal();
    closePanel();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchInput').focus();
  }
});

bootAuth();
