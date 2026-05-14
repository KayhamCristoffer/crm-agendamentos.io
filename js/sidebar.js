// ============================================================
// SIDEBAR COMPONENT v4.1 — controle de acesso por role
// Roles: cliente / atendente / admin
// admin + atendente = staff (veem tudo)
// cliente = vê apenas Principal (dashboard, agendamentos, equipe, chat, perfil)
// ============================================================
export function getSidebarHTML(activePage = '', userRole = 'cliente') {
  const pages = [
    // ── Principal (todos os roles)
    { id: 'dashboard',    href: 'dashboard.html',   icon: 'fa-chart-line',       label: 'Dashboard',      section: 'Principal' },
    { id: 'agendamentos', href: 'agendamentos.html', icon: 'fa-calendar-alt',     label: 'Agendamentos',   section: 'Principal' },
    { id: 'equipe',       href: 'equipe.html',       icon: 'fa-user-tie',         label: 'Equipe',         section: 'Principal' },
    { id: 'chat',         href: 'chat.html',         icon: 'fa-comments',         label: 'Chat',           section: 'Principal' },
    { id: 'perfil',       href: 'perfil.html',       icon: 'fa-user-circle',      label: 'Meu Perfil',     section: 'Principal' },
    // ── Gestão (staff: admin + atendente)
    { id: 'clientes',     href: 'clientes.html',     icon: 'fa-users',            label: 'Clientes',       section: 'Gestão',  staffOnly: true },
    { id: 'servicos',     href: 'servicos.html',     icon: 'fa-tags',             label: 'Serviços',       section: 'Gestão',  staffOnly: true },
    { id: 'financeiro',   href: 'financeiro.html',   icon: 'fa-dollar-sign',      label: 'Financeiro',     section: 'Gestão',  staffOnly: true },
    // ── Sistema (admin only)
    { id: 'admin',        href: 'admin.html',        icon: 'fa-cog',              label: 'Configurações',  section: 'Sistema', adminOnly: true },
    { id: 'admin',        href: 'admin.html',        icon: 'fa-cog',              label: 'Configurações',  section: 'Sistema', staffOnly: true },
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
        <small>v4.0</small>
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
    // Decide se a seção deve aparecer por padrão ou ficará oculta
    const allStaffOnly  = items.every(i => i.staffOnly || i.adminOnly);
    const allAdminOnly  = items.every(i => i.adminOnly);
    const sectionHidden = allStaffOnly ? ' style="display:none"' : '';

    html += `<div class="nav-section"${sectionHidden} data-section="${section}">${section}</div>`;
    items.forEach(item => {
      const active = activePage === item.id ? ' active' : '';
      const hidden = (item.staffOnly || item.adminOnly) ? ' style="display:none"' : '';
      const attrs  = [];
      if (item.staffOnly) attrs.push('data-staff-only="true"');
      if (item.adminOnly) attrs.push('data-admin-only="true"');
      html += `
      <a href="${item.href}" class="nav-item${active}"${hidden} data-page="${item.id}" ${attrs.join(' ')}>
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

// Revela itens de staff (admin + atendente): Clientes, Serviços, Financeiro, Administração
export function showAdminItems() {
  // Show all staff-only AND admin-only items
  document.querySelectorAll('[data-staff-only="true"],[data-admin-only="true"]').forEach(el => {
    el.style.display = '';
  });
  // Show section headers
  document.querySelectorAll('[data-section="Gestão"],[data-section="Sistema"]').forEach(el => {
    el.style.display = '';
  });
}

// Revela itens de staff sem o item de Administração (admin.html)
// Usado por atendente — vê Clientes, Serviços, Financeiro mas NÃO Administração
export function showStaffItems() {
  document.querySelectorAll('[data-staff-only="true"]').forEach(el => {
    el.style.display = '';
  });
  // Show Gestão section header
  const gestaoSection = document.querySelector('[data-section="Gestão"]');
  if (gestaoSection) gestaoSection.style.display = '';
}

// Alias mantido por compatibilidade com páginas existentes
export function showAtendentItems() {
  showStaffItems();
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
