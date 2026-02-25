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

let isBootPhase = true;

try {
  initThemeUI();
} catch (error) {
  console.error('initThemeUI failed:', error);
}

try {
  refresh();
} catch (error) {
  console.error('refresh failed:', error);
}

try {
  bindAuthUIEvents();
} catch (error) {
  console.error('bindAuthUIEvents failed:', error);
}

try {
  bindAuthStateChange();
} catch (error) {
  console.error('bindAuthStateChange failed:', error);
}

window.addEventListener('error', (event) => {
  const msg = event?.error?.message || event?.message || 'Unknown error';
  const stagePrefix = isBootPhase ? '[부트 단계 실패] ' : '[런타임 실패] ';
  console.error('Global error:', event?.error || event);
  toast(stagePrefix + '에러: ' + msg, 'err');
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const msg = reason?.message || String(reason || 'Unhandled rejection');
  const stagePrefix = isBootPhase ? '[부트 단계 실패] ' : '[런타임 실패] ';
  console.error('Unhandled rejection:', reason);
  toast(stagePrefix + '비동기 에러: ' + msg, 'err');
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

try {
  const bootAuthResult = bootAuth();
  if (bootAuthResult && typeof bootAuthResult.finally === 'function') {
    bootAuthResult.finally(() => {
      isBootPhase = false;
    });
  } else {
    isBootPhase = false;
  }
} catch (error) {
  console.error('bootAuth failed:', error);
  isBootPhase = false;
}
