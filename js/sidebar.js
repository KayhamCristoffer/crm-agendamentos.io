// ============================================================
// SIDEBAR COMPONENT v5 — controle de acesso por role
// ============================================================
export function getSidebarHTML(activePage = '', userRole = 'user') {
  const pages = [
    { id: 'dashboard',    href: 'dashboard.html',   icon: 'fa-chart-line',   label: 'Dashboard',     section: 'Principal' },
    { id: 'agendamentos', href: 'agendamentos.html', icon: 'fa-calendar-alt', label: 'Agendamentos',  section: 'Principal' },
    { id: 'equipe',       href: 'equipe.html',       icon: 'fa-user-tie',     label: 'Equipe',        section: 'Principal' },
    { id: 'chat',         href: 'chat.html',         icon: 'fa-comments',     label: 'Chat',          section: 'Principal' },
    { id: 'clientes',     href: 'clientes.html',     icon: 'fa-users',        label: 'Clientes',      section: 'Gestão',    adminOnly: true },
    { id: 'servicos',     href: 'servicos.html',     icon: 'fa-tags',         label: 'Serviços',      section: 'Gestão',    adminOnly: true },
    { id: 'financeiro',   href: 'financeiro.html',   icon: 'fa-dollar-sign',  label: 'Financeiro',    section: 'Gestão',    adminOnly: true },
    { id: 'admin',        href: 'admin.html',        icon: 'fa-shield-alt',   label: 'Administração', section: 'Sistema',   adminOnly: true },
  ];

  const sections = {};
  pages.forEach(p => {
    if (!sections[p.section]) sections[p.section] = [];
    sections[p.section].push(p);
  });

  let html = `
  <div id="sidebarOverlay" class="sidebar-overlay"></div>
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">📅</div>
      <div class="sidebar-logo-text">
        <h2>CRM Agenda</h2>
        <small>v3.0</small>
      </div>
    </div>
    <div class="sidebar-user">
      <div class="sidebar-avatar" id="sidebarAvatar">?</div>
      <div class="sidebar-user-info">
        <div id="sidebarNome">Carregando…</div>
        <div id="sidebarRole">—</div>
      </div>
    </div>
    <nav class="sidebar-nav" id="sidebarNav">`;

  Object.entries(sections).forEach(([section, items]) => {
    html += `<div class="nav-section">${section}</div>`;
    items.forEach(item => {
      const active = activePage === item.id ? ' active' : '';
      // adminOnly items start hidden; showAdminItems() reveals them
      const hidden = item.adminOnly ? ' style="display:none"' : '';
      html += `
      <a href="${item.href}" class="nav-item${active}"${hidden} data-page="${item.id}"${item.adminOnly ? ' data-admin-only="true"' : ''}>
        <i class="fas ${item.icon}"></i>
        <span>${item.label}</span>
        ${item.id === 'agendamentos' ? '<span class="nav-badge" id="badgePendentes" style="display:none">0</span>' : ''}
        ${item.id === 'chat'         ? '<span class="nav-badge" id="badgeChat"      style="display:none">0</span>' : ''}
      </a>`;
    });
  });

  html += `
    </nav>
    <div class="sidebar-footer">
      <button class="btn-logout" id="logoutBtn">
        <i class="fas fa-sign-out-alt"></i> Sair do sistema
      </button>
    </div>
  </nav>
  <div id="sessionTimerBanner" class="session-banner">
    <i class="fas fa-clock"></i>
    <span id="sessionTimerText">Sessão expirando…</span>
    <button onclick="document.getElementById('sessionTimerBanner').classList.remove('show')"
      style="margin-left:12px;background:none;border:none;cursor:pointer;color:#000;font-weight:700">×</button>
  </div>`;

  return html;
}

export function initSidebarToggle() {
  const toggle  = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('show');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

// Called after auth to reveal admin-only menu items (Clientes, Serviços, Financeiro, Admin)
export function showAdminItems() {
  document.querySelectorAll('[data-admin-only="true"]').forEach(el => {
    el.style.display = '';
  });
}

// Called for atendente role — reveals only the Clientes link (read access)
export function showAtendentItems() {
  const clientesLink = document.querySelector('[data-page="clientes"]');
  if (clientesLink) clientesLink.style.display = '';
}

// Update pending appointments badge
export function updatePendingBadge(count) {
  const badge = document.getElementById('badgePendentes');
  if (!badge) return;
  if (count > 0) {
    badge.style.display = '';
    badge.textContent = count > 99 ? '99+' : String(count);
  } else {
    badge.style.display = 'none';
  }
}

// Update chat unread badge
export function updateChatBadge(count) {
  const badge = document.getElementById('badgeChat');
  if (!badge) return;
  if (count > 0) {
    badge.style.display = '';
    badge.textContent = count > 99 ? '99+' : String(count);
  } else {
    badge.style.display = 'none';
  }
}
