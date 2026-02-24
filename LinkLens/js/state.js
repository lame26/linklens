import { getTheme, getTrash } from './storage.js';

export const state = {
  articles: [],
  collections: [],
  trash: getTrash(),
  currentUser: null,
  filter: 'all',
  catFilter: null,
  colFilter: null,
  sortMode: 'newest',
  viewMode: 'grid',
  unreadOnly: false,
  searchQ: '',
  selectedId: null,
  addingTags: [],
  editingTags: [],
  editingCollectionId: null,
  theme: getTheme(),
  authMode: 'login',
  urlDebounce: null,
  urlAbortCtrl: null,
  toastTimer: null,
};

export const authState = {
  phase: 'boot',
  initialized: false,
  lastUserId: null,
};

export const COL_COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#fb923c', '#e879f9', '#a3e635'];

export const CAT_TAG_CLASS = {
  tech: 'tag-tech',
  economy: 'tag-economy',
  ai: 'tag-ai',
  science: 'tag-science',
  politics: 'tag-politics',
  default: 'tag-default',
};

export const CAT_LABEL = {
  tech: '테크/IT',
  economy: '경제/금융',
  ai: 'AI/미래',
  science: '과학',
  politics: '정치/사회',
  default: '기타',
};

export const STATUS_CLASS = {
  unread: 'status-unread',
  read: 'status-read',
  later: 'status-later',
};

export const STATUS_LABEL = {
  unread: '미읽음',
  read: '읽음',
  later: '나중에 읽기',
};

export const SVG = {
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  starFill: `<svg viewBox="0 0 24 24" fill="var(--amber)" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  restore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
};
