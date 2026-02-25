import { state, authState } from './state.js';
import { sb } from '../supabase.js';
import { clearAppStorage } from './storage.js';
import { loadFromDB } from './db.js';
import { refresh, toast } from './ui.js';

let sawInitialSession = false;
let loadingSession = false; // 추가: 동시 loadFromDB 방지

function showAuthErr(msg) {
  const el = document.getElementById('authErr');
  el.textContent = msg;
  el.className = 'auth-msg err show';
  document.getElementById('authOk').className = 'auth-msg ok';
}

function showAuthOk(msg) {
  const el = document.getElementById('authOk');
  el.textContent = msg;
  el.className = 'auth-msg ok show';
  document.getElementById('authErr').className = 'auth-msg err';
}

function hideAuthMsg() {
  document.getElementById('authErr').className = 'auth-msg err';
  document.getElementById('authOk').className = 'auth-msg ok';
}

function setUser(user) {
  state.currentUser = user;
  authState.lastUserId = user?.id || null;
  const email = user.email;
  document.getElementById('userAvatar').textContent = email[0].toUpperCase();
  document.getElementById('userEmail').textContent = email.split('@')[0];
  document.getElementById('userDropdownEmail').textContent = email;
  document.getElementById('authScreen').style.display = 'none';
}

function clearUser() {
  state.currentUser = null;
  state.articles = [];
  state.collections = [];
  authState.lastUserId = null;
  document.getElementById('authScreen').style.display = 'flex';
  refresh();
}

async function handleSession(session, { forceReload = false } = {}) {
  if (!session?.user) {
    clearUser();
    return;
  }
  const nextUserId = session.user.id;
  const shouldLoad = forceReload || state.currentUser?.id !== nextUserId || state.articles.length === 0;
  setUser(session.user);
  if (shouldLoad) {
    if (loadingSession) return; // 이미 로딩 중이면 무시
    loadingSession = true;
    try {
      await loadFromDB();
      refresh();
    } finally {
      loadingSession = false;
    }
  }
}

export function switchTab(mode) {
  state.authMode = mode;
  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabSignup').classList.toggle('active', mode === 'signup');
  document.getElementById('authTitle').textContent = mode === 'login' ? '로그인' : '회원가입';
  document.getElementById('authDesc').textContent = mode === 'login' ? '계정으로 로그인하고 저장한 링크를 관리하세요' : '계정을 만들고 시작하세요';
  document.getElementById('authBtn').textContent = mode === 'login' ? '로그인' : '회원가입';
  hideAuthMsg();
}

export function authEnter(e) {
  if (e.key === 'Enter') doAuth();
}

export async function doAuth() {
  if (!sb) {
    showAuthErr('인증 서비스를 불러올 수 없습니다. 페이지를 새로고침 해주세요.');
    return;
  }
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  if (!email || !pass) {
    showAuthErr('이메일과 비밀번호를 입력해주세요');
    return;
  }

  const btn = document.getElementById('authBtn');
  const btnLabel = state.authMode === 'login' ? '로그인' : '회원가입';
  btn.disabled = true;
  btn.textContent = '처리 중...';
  hideAuthMsg();

  try {
    if (state.authMode === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    } else {
      const { data, error } = await sb.auth.signUp({ email, password: pass });
      if (error) throw error;
      const identities = data?.user?.identities || [];
      const duplicated = !data?.session && identities.length === 0;
      if (duplicated) {
        showAuthErr('이미 가입된 이메일입니다. 로그인 해주세요.');
        switchTab('login');
        return;
      }
      showAuthOk('가입이 완료되었습니다. 로그인해보세요.');
      return;
    }
  } catch (e) {
    const msgs = {
      'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다',
      'User already registered': '이미 가입된 이메일입니다',
      'Password should be at least 6 characters': '비밀번호는 6자 이상이어야 합니다',
    };
    showAuthErr(msgs[e.message] || e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = btnLabel;
  }
}

export async function doSignOut() {
  document.getElementById('userDropdown').classList.remove('open');

  if (sb) {
    try {
      await sb.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('signOut failed:', e);
    }
  }

  // signOut 완료 후에 상태 초기화 (SIGNED_OUT 이벤트보다 먼저 처리)
  authState.phase = 'signed_out';
  authState.initialized = false;
  sawInitialSession = false;

  clearAppStorage();

  state.currentUser = null;
  state.articles = [];
  state.collections = [];
  document.getElementById('authScreen').style.display = 'flex';
  refresh();
  toast('로그아웃되었습니다', 'info');
}

export function toggleUserMenu() {
  document.getElementById('userDropdown').classList.toggle('open');
}

export function bindAuthUIEvents() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-btn')) {
      document.getElementById('userDropdown')?.classList.remove('open');
    }
  });
}

export async function bootAuth() {
  if (!sb) {
    clearUser();
    authState.initialized = true;
    authState.phase = 'signed_out';
    console.error('[LinkLens] Supabase client unavailable — check CDN loading');
    return;
  }
  // INITIAL_SESSION 이벤트가 이미 처리했으면 중복 실행 안 함
  if (sawInitialSession) {
    authState.initialized = true;
    return;
  }
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    sawInitialSession = true;
    await handleSession(data?.session, { forceReload: true });
  } catch (e) {
    console.error('bootAuth failed:', e);
    toast('세션 확인 실패: ' + (e.message || e), 'err');
    if (!state.currentUser) clearUser();
  } finally {
    authState.initialized = true;
    authState.phase = state.currentUser ? 'signed_in' : 'signed_out';
  }
}

export function bindAuthStateChange() {
  if (!sb) return;
  sb.auth.onAuthStateChange(async (event, session) => {
    try {
      if (event === 'INITIAL_SESSION') {
        sawInitialSession = true;
        authState.initialized = true;
        await handleSession(session, { forceReload: state.articles.length === 0 });
        authState.phase = session?.user ? 'signed_in' : 'signed_out';
        return;
      }

      if (event === 'SIGNED_IN') {
        await handleSession(session, { forceReload: true });
        authState.phase = 'signed_in';
        return;
      }

      if (event === 'SIGNED_OUT') {
        // doSignOut()이 이미 처리했으면 무시 (로그아웃 후 바로 로그인 시 덮어쓰기 방지)
        if (authState.phase === 'signed_out') return;
        clearUser();
        authState.phase = 'signed_out';
        authState.initialized = true;
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        if (session?.user && state.currentUser?.id === session.user.id) {
          setUser(session.user);
        }
      }
    } catch (e) {
      console.error('auth state error:', event, e);
      toast('인증 처리 오류: ' + (e.message || e), 'err');
    }
  });
}
