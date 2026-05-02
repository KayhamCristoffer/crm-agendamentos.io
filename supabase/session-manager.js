// ============================================================
// SESSION MANAGER — CRM Agendamentos
// Gestão de sessão com Supabase Auth
// ============================================================
import { sb, getCurrentUser, getUserProfile } from './client.js';
import { ADMIN_UID } from './supabase-config.js';

const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutos
const WARNING_TIME    = 5  * 60 * 1000; // aviso 5 min antes

let _activityTimer  = null;
let _warningTimer   = null;
let _countdownTimer = null;

export let currentUser    = null;
export let currentProfile = null;

// ── Inicializa sessão ────────────────────────────────────────
export async function initSession(onReady, onLogout) {
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (!session?.user) { onLogout?.(); return; }
      currentUser = session.user;
      try {
        currentProfile = await getUserProfile(session.user.id);
      } catch {
        currentProfile = { id: session.user.id, role: 'user', nome: session.user.email };
      }
      setupActivityTracking(onLogout);
      onReady?.(currentUser, currentProfile);
    } else if (event === 'SIGNED_OUT') {
      currentUser    = null;
      currentProfile = null;
      clearTimers();
      onLogout?.();
    }
  });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) onLogout?.();
}

// ── Garante que está logado, senão redireciona ───────────────
export async function requireAuth(adminRequired = false) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return null; }

  currentUser = session.user;
  try {
    currentProfile = await getUserProfile(session.user.id);
  } catch {
    currentProfile = { id: session.user.id, role: 'user' };
  }

  if (adminRequired) {
    const isAdm = currentProfile?.role === 'admin' || currentUser.id === ADMIN_UID;
    if (!isAdm) { window.location.href = 'dashboard.html'; return null; }
  }

  setupActivityTracking(() => window.location.href = 'index.html');
  return { user: currentUser, profile: currentProfile };
}

// ── Verifica se é admin ──────────────────────────────────────
export function isAdmin(user = currentUser, profile = currentProfile) {
  return profile?.role === 'admin' || user?.id === ADMIN_UID;
}

// ── Activity tracking ────────────────────────────────────────
function setupActivityTracking(onLogout) {
  const resetActivity = () => {
    clearTimers();
    _activityTimer = setTimeout(() => showSessionWarning(onLogout), SESSION_TIMEOUT - WARNING_TIME);
  };
  ['click','keydown','mousemove','touchstart','scroll'].forEach(evt =>
    window.addEventListener(evt, resetActivity, { passive: true })
  );
  resetActivity();
}

function showSessionWarning(onLogout) {
  const banner = document.getElementById('sessionTimerBanner');
  const text   = document.getElementById('sessionTimerText');
  if (banner) banner.classList.add('show');
  let remaining = Math.floor(WARNING_TIME / 1000);
  const update = () => {
    if (text) {
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      text.textContent = `Sessão expira em ${m}:${String(s).padStart(2,'0')}`;
    }
    if (remaining <= 0) {
      clearTimers();
      sb.auth.signOut().then(() => onLogout?.());
    }
    remaining--;
  };
  update();
  _countdownTimer = setInterval(update, 1000);
}

function clearTimers() {
  clearTimeout(_activityTimer);
  clearTimeout(_warningTimer);
  clearInterval(_countdownTimer);
  const banner = document.getElementById('sessionTimerBanner');
  if (banner) banner.classList.remove('show');
}

// ── Renderiza usuário na sidebar ─────────────────────────────
export function renderUserInSidebar(profile) {
  if (!profile) return;
  const elNome  = document.getElementById('sidebarNome');
  const elRole  = document.getElementById('sidebarRole');
  const elAvatar= document.getElementById('sidebarAvatar');
  const roleLabels = { admin:'👑 Admin', atendente:'🧑‍💼 Atendente', user:'👤 Usuário' };
  if (elNome)   elNome.textContent   = profile.nome || profile.email || 'Usuário';
  if (elRole)   elRole.textContent   = roleLabels[profile.role] || '👤 Usuário';
  if (elAvatar) {
    if (profile.avatar_url) {
      elAvatar.style.backgroundImage = `url(${profile.avatar_url})`;
      elAvatar.style.backgroundSize  = 'cover';
      elAvatar.style.fontSize        = '0';
      elAvatar.textContent = '';
    } else if (profile.avatar_emote) {
      elAvatar.style.backgroundImage = '';
      elAvatar.style.fontSize        = '1.2rem';
      elAvatar.textContent = profile.avatar_emote;
    } else {
      elAvatar.style.backgroundImage = '';
      elAvatar.style.fontSize        = '';
      elAvatar.textContent = (profile.nome || 'U')[0].toUpperCase();
    }
  }
}

// ── Verifica se é atendente ou admin ─────────────────────────
export function isAtendente(user = null, profile = null) {
  return profile?.role === 'atendente' || profile?.role === 'admin' ||
         (user?.id === (typeof ADMIN_UID !== 'undefined' ? ADMIN_UID : ''));
}

// ── Toast notifications ──────────────────────────────────────
export function showToast(message, type = 'info', duration = 4000) {
  const icons = {
    success: 'fa-check-circle',
    error:   'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info:    'fa-info-circle'
  };
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}
