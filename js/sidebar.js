// ============================================================
// SIDEBAR COMPONENT v2 — com controle de acesso por role
// ============================================================
export function getSidebarHTML(activePage = '', userRole = 'user') {
  const pages = [
    { id: 'dashboard',     href: 'dashboard.html',    icon: 'fa-chart-line',    label: 'Dashboard',       section: 'Principal' },
    { id: 'agendamentos',  href: 'agendamentos.html',  icon: 'fa-calendar-alt',  label: 'Agendamentos',    section: 'Principal' },
    { id: 'clientes',      href: 'clientes.html',      icon: 'fa-users',         label: 'Clientes',        section: 'Principal', adminOnly: true },
    { id: 'equipe',        href: 'equipe.html',         icon: 'fa-user-tie',      label: 'Equipe',          section: 'Principal' },
    { id: 'servicos',      href: 'servicos.html',       icon: 'fa-tags',          label: 'Serviços',        section: 'Gestão',    adminOnly: true },
    { id: 'financeiro',    href: 'financeiro.html',     icon: 'fa-dollar-sign',   label: 'Financeiro',      section: 'Gestão',    adminOnly: true },
    { id: 'admin',         href: 'admin.html',          icon: 'fa-shield-alt',    label: 'Administração',   section: 'Sistema',   adminOnly: true },
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
        <small>v2.0</small>
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
    const sectionItems = items.filter(i => !i.adminOnly);
    const adminItems   = items.filter(i => i.adminOnly);

    if (sectionItems.length) {
      html += `<div class="nav-section">${section}</div>`;
      sectionItems.forEach(item => {
        const active = activePage === item.id ? ' active' : '';
        html += `
        <a href="${item.href}" class="nav-item${active}" data-page="${item.id}">
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
          ${item.id === 'agendamentos' ? '<span class="nav-badge" id="badgePendentes" style="display:none">0</span>' : ''}
        </a>`;
      });
    }

    if (adminItems.length) {
      if (!sectionItems.length) html += `<div class="nav-section">${section}</div>`;
      adminItems.forEach(item => {
        const active = activePage === item.id ? ' active' : '';
        html += `
        <a href="${item.href}" class="nav-item${active}" data-admin-only="true" style="display:none" data-page="${item.id}">
          <i class="fas ${item.icon}"></i>
          <span>${item.label}</span>
        </a>`;
      });
    }
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

export function showAdminItems() {
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.style.display = '';
  });
}
