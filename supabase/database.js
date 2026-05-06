// ================================================================
// DATABASE.JS — CRM Agendamentos v4.0
// Tabela: usuarios (antigo users) | Roles: cliente/atendente/admin
// ================================================================
import { sb } from './client.js';
import { ADMIN_UID } from './supabase-config.js';

// ─── UTILS ───────────────────────────────────────────────────
export function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v||0);
}
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
export function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
export function formatPhone(v) {
  if (!v) return '';
  const d = v.replace(/\D/g,'');
  if (d.length===11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length===10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return v;
}
export function formatCPF(v) {
  if (!v) return '';
  const d = v.replace(/\D/g,'');
  if (d.length===11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  return v;
}
export function applyPhoneMask(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g,'');
    if (v.length>11) v = v.slice(0,11);
    if (v.length>6)      input.value = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length>2) input.value = `(${v.slice(0,2)}) ${v.slice(2)}`;
    else if (v.length>0) input.value = `(${v}`;
    else                 input.value = v;
  });
}
export function applyCPFMask(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g,'');
    if (v.length>11) v = v.slice(0,11);
    if (v.length>9)      input.value = `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6,9)}-${v.slice(9)}`;
    else if (v.length>6) input.value = `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6)}`;
    else if (v.length>3) input.value = `${v.slice(0,3)}.${v.slice(3)}`;
    else                 input.value = v;
  });
}

export const STATUS_LABELS = {
  pendente:   { label:'Pendente',   color:'#f59e0b', icon:'🕐' },
  confirmado: { label:'Confirmado', color:'#6366f1', icon:'✅' },
  concluido:  { label:'Concluído',  color:'#10b981', icon:'✔️' },
  cancelado:  { label:'Cancelado',  color:'#ef4444', icon:'❌' },
  faltou:     { label:'Faltou',     color:'#6b7280', icon:'⚠️' }
};
export const PAGAMENTO_LABELS = {
  dinheiro:'Dinheiro', pix:'PIX',
  cartao_debito:'Cartão Débito', cartao_credito:'Cartão Crédito', outros:'Outros'
};
export const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

// ─── AUTH ────────────────────────────────────────────────────

export async function signUp(email, password, nome, telefone = '') {
  // Verifica se já existe — evita duplicata com mensagem clara
  const { data: existing } = await sb.from('usuarios').select('id').eq('email', email).maybeSingle();
  if (existing) {
    const err = new Error('Usuário já cadastrado com este e-mail.'); err.code = 'user_already_exists'; throw err;
  }

  // Produção: GitHub Pages, Cloudflare Pages ou domínio configurado
  // Garante que o redirectTo aponta para a raiz correta
  function getRedirectBase() {
    const h = window.location.hostname;
    const p = window.location.pathname;
    if (h === 'localhost' || h === '127.0.0.1') return window.location.origin;
    if (h.includes('github.io')) {
      // GitHub Pages: https://user.github.io/repo-name
      const repo = p.split('/')[1] || '';
      return repo ? `https://${h}/${repo}` : `https://${h}`;
    }
    // Custom domain / Cloudflare Pages / other
    return window.location.origin;
  }
  const redirectTo = `${getRedirectBase()}/index.html`;

  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: redirectTo, data: { nome, telefone } }
  });
  if (error) throw error;

  if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
    const err = new Error('Usuário já cadastrado com este e-mail.'); err.code = 'user_already_exists'; throw err;
  }

  if (data.user) {
    // handle_new_user trigger cria usuarios + clientes automaticamente
    // Chamamos ensure para garantir telefone e vínculo correto
    await ensureUserAndClient(data.user, nome, telefone);
  }
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Garante registro usuario + cliente em TODA autenticação
  if (data.user) await ensureUserAndClient(data.user);
  return data;
}

export async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email) {
  const h = window.location.hostname;
  const p = window.location.pathname;
  let base;
  if (h === 'localhost' || h === '127.0.0.1') {
    base = window.location.origin;
  } else if (h.includes('github.io')) {
    const repo = p.split('/')[1] || '';
    base = repo ? `https://${h}/${repo}` : `https://${h}`;
  } else {
    base = window.location.origin;
  }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/change-password.html`
  });
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      await ensureUserAndClient(session.user);
    }
    callback(session?.user ?? null, event);
  });
  return subscription;
}

/**
 * ensureUserAndClient — garante que usuario existe em `usuarios` e tem um registro em `clientes`.
 * Chamado em TODA autenticação (login, register, refresh).
 */
export async function ensureUserAndClient(user, nomeFallback = null, telefoneFallback = null) {
  if (!user) return null;
  try {
    const nome = nomeFallback || user.user_metadata?.nome || user.email.split('@')[0];
    const tel  = telefoneFallback || user.user_metadata?.telefone || null;

    // Tenta via stored procedure (atomicidade)
    const { data, error } = await sb.rpc('ensure_user_and_client', {
      p_user_id:  user.id,
      p_email:    user.email,
      p_nome:     nome,
      p_telefone: tel
    });

    if (error) {
      console.warn('ensure_user_and_client RPC:', error.message);
      return await _ensureUserAndClientFallback(user, nome, tel);
    }
    return data;
  } catch (e) {
    console.warn('ensureUserAndClient:', e.message);
    return null;
  }
}

// Fallback JS puro caso a stored procedure não esteja disponível
async function _ensureUserAndClientFallback(user, nome, telefone) {
  const isAdm = user.id === ADMIN_UID;

  // Upsert usuario
  await sb.from('usuarios').upsert({
    id: user.id, email: user.email, nome,
    telefone: telefone || null,
    role: isAdm ? 'admin' : 'cliente'
  }, { onConflict: 'id' });

  // Upsert cliente vinculado por user_id ou email
  const { data: existing } = await sb.from('clientes')
    .select('id')
    .or(`user_id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  if (!existing) {
    const { data: novo } = await sb.from('clientes').insert({
      user_id: user.id, nome, email: user.email,
      telefone: telefone || null, criado_por: user.id, ativo: true
    }).select('id').maybeSingle();
    return { cliente_id: novo?.id || null };
  } else {
    await sb.from('clientes').update({ user_id: user.id }).eq('id', existing.id);
    return { cliente_id: existing.id };
  }
}

// Busca cliente pelo user_id
export async function getClienteByUserId(userId) {
  if (!userId) return null;
  try {
    const { data: authData } = await sb.auth.getUser();
    if (authData?.user) await ensureUserAndClient(authData.user);
  } catch { /* ignore */ }

  const { data } = await sb.from('clientes').select('*')
    .eq('user_id', userId).eq('ativo', true).maybeSingle();
  return data || null;
}

// ─── USUARIOS (antigo users) ─────────────────────────────────

export async function getUser(userId) {
  const { data, error } = await sb.from('usuarios').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}
export async function getAllUsers() {
  const { data, error } = await sb.from('usuarios').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}
export async function updateUserProfile(userId, updates) {
  const { data, error } = await sb.from('usuarios')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId).select();
  if (error) throw error;
  return data?.[0] ?? null;
}
export async function setUserRole(userId, role) {
  // Validate role
  const validRoles = ['cliente','atendente','admin'];
  if (!validRoles.includes(role)) throw new Error(`Role inválido: ${role}`);
  const { data, error } = await sb.from('usuarios')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select();
  if (error) throw error;
  return data?.[0] ?? null;
}

// ─── CONFIG SISTEMA ──────────────────────────────────────────

export async function getConfigSistema() {
  const { data, error } = await sb.from('config_sistema').select('*');
  if (error) return {};
  const cfg = {};
  (data ?? []).forEach(r => { cfg[r.chave] = r.valor; });
  return cfg;
}
export async function setConfigSistema(chave, valor) {
  const { error } = await sb.from('config_sistema')
    .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
  if (error) throw error;
}

// ─── HORÁRIOS ────────────────────────────────────────────────

export async function getHorarios() {
  const { data, error } = await sb.from('horarios_funcionamento').select('*').order('dia_semana');
  if (error) return [];
  return data ?? [];
}
export async function updateHorario(diaSemana, updates) {
  const { error } = await sb.from('horarios_funcionamento')
    .upsert({ dia_semana: diaSemana, ...updates }, { onConflict: 'dia_semana' });
  if (error) throw error;
}

// ─── SLOTS DISPONÍVEIS ───────────────────────────────────────
// Retorna slots livres E ocupados (com nomes dos profissionais e info de cliente para admin)

export async function getSlotsDisponiveis(date, profissionalId = null, duracaoMin = 60) {
  const d = new Date(date);
  const diaSemana = d.getDay();
  const horarios  = await getHorarios();
  const h = horarios.find(x => x.dia_semana === diaSemana);
  if (!h || !h.aberto) return [];

  const [ahH, ahM] = h.hora_abertura.split(':').map(Number);
  const [afH, afM] = h.hora_fechamento.split(':').map(Number);

  const inicio = new Date(d); inicio.setHours(ahH, ahM, 0, 0);
  const fim    = new Date(d); fim.setHours(afH, afM, 0, 0);

  const startDay = new Date(d); startDay.setHours(0,0,0,0);
  const endDay   = new Date(d); endDay.setHours(23,59,59,999);

  // Busca ocupações com dados de cliente e serviço para exibição no calendário
  let q = sb.from('agendamento_servicos')
    .select(`
      hora_inicio, hora_fim, profissional_id,
      equipe(id, nome, cor_agenda),
      agendamentos!inner(
        id, status, para_outro, nome_outro,
        clientes(id, nome, telefone)
      ),
      servicos(id, nome, icone)
    `)
    .gte('hora_inicio', startDay.toISOString())
    .lte('hora_inicio', endDay.toISOString())
    .in('agendamentos.status', ['pendente','confirmado']);

  if (profissionalId) q = q.eq('profissional_id', profissionalId);

  const { data: ocupadosRaw } = await q;
  const ocupados = (ocupadosRaw ?? []).map(o => ({
    profissional_id:   o.profissional_id,
    profissional_nome: o.equipe?.nome || null,
    profissional_cor:  o.equipe?.cor_agenda || '#6366f1',
    cliente_nome:      o.agendamentos?.para_outro
                         ? (o.agendamentos?.nome_outro || 'Outra pessoa')
                         : (o.agendamentos?.clientes?.nome || null),
    cliente_tel:       o.agendamentos?.clientes?.telefone || null,
    agendamento_id:    o.agendamentos?.id || null,
    servico_nome:      o.servicos?.nome || null,
    servico_icone:     o.servicos?.icone || '✂️',
    status:            o.agendamentos?.status || 'pendente',
    inicio: new Date(o.hora_inicio),
    fim:    new Date(o.hora_fim)
  }));

  const slots = [];
  let cur = new Date(inicio);
  while (cur.getTime() + duracaoMin * 60000 <= fim.getTime()) {
    const slotFim  = new Date(cur.getTime() + duracaoMin * 60000);
    const busyList = ocupados.filter(o => cur < o.fim && slotFim > o.inicio);
    const livre    = busyList.length === 0;

    slots.push({
      hora: cur.toTimeString().slice(0,5),
      iso:  cur.toISOString(),
      livre,
      ocupacoes: livre ? [] : busyList
    });
    cur = new Date(cur.getTime() + 30 * 60000);
  }
  return slots;
}

export async function getSlotsLivres(date, profissionalId = null, duracaoMin = 60) {
  const todos = await getSlotsDisponiveis(date, profissionalId, duracaoMin);
  return todos.filter(s => s.livre);
}

// ─── CLIENTES ────────────────────────────────────────────────

export async function getAllClientes(includeInactive = false) {
  let q = sb.from('clientes').select('*, usuarios(role, avatar_emote)').order('nome');
  if (!includeInactive) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function getCliente(id) {
  const { data, error } = await sb.from('clientes').select('*, usuarios(*)').eq('id', id).single();
  if (error) throw error;
  return data;
}
export async function searchClientes(query) {
  const { data, error } = await sb.from('clientes').select('*')
    .or(`nome.ilike.%${query}%,email.ilike.%${query}%,telefone.ilike.%${query}%,cpf.ilike.%${query}%`)
    .eq('ativo', true).order('nome').limit(50);
  if (error) throw error;
  return data ?? [];
}
export async function createCliente(clienteData) {
  const { data: authData } = await sb.auth.getUser();
  const payload = { ...clienteData };
  if (authData?.user) payload.criado_por = authData.user.id;
  else delete payload.criado_por;
  const { data, error } = await sb.from('clientes').insert(payload).select();
  if (error) throw error;
  return data?.[0] ?? null;
}
export async function updateCliente(id, updates) {
  const payload = { ...updates };
  delete payload.criado_por;
  const { data, error } = await sb.from('clientes')
    .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (error) throw error;
  return data?.[0] ?? null;
}
export async function deleteCliente(id) {
  const { error } = await sb.from('clientes').update({ ativo: false }).eq('id', id);
  if (error) throw error;
}
export async function atualizarEstatisticasCliente(clienteId) {
  if (!clienteId) return;
  try {
    await sb.rpc('update_cliente_stats', { p_cliente_id: clienteId });
  } catch {
    const { data: ags } = await sb.from('agendamentos')
      .select('status, valor_total, data_hora').eq('cliente_id', clienteId).eq('status','concluido');
    await sb.from('clientes').update({
      total_visitas: ags?.length ?? 0,
      total_gasto:   ags?.reduce((s,a)=>s+(a.valor_total||0),0) ?? 0,
      ultima_visita: ags?.[0]?.data_hora ?? null,
      updated_at:    new Date().toISOString()
    }).eq('id', clienteId);
  }
}

// ─── EQUIPE ──────────────────────────────────────────────────

export async function getAllEquipe(includeInactive = false) {
  let q = sb.from('equipe').select('*').order('nome');
  if (!includeInactive) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function createProfissional(profData) {
  const { data, error } = await sb.from('equipe').insert(profData).select();
  if (error) throw error;
  return data?.[0] ?? null;
}
export async function updateProfissional(id, updates) {
  const { data, error } = await sb.from('equipe').update(updates).eq('id', id).select();
  if (error) throw error;
  return data?.[0] ?? null;
}
// Hard delete — se tiver FK violations, faz soft-delete
export async function deleteProfissional(id) {
  const { error } = await sb.from('equipe').delete().eq('id', id);
  if (error) {
    const { error: e2 } = await sb.from('equipe').update({ ativo: false }).eq('id', id);
    if (e2) throw new Error('Não foi possível remover o profissional: ' + (e2.message || e2));
  }
}

// ─── EQUIPE LIKES ────────────────────────────────────────────

export async function getLikesPorProfissional() {
  const { data, error } = await sb.from('equipe_likes').select('profissional_id, user_id');
  if (error) return {};
  const map = {};
  (data ?? []).forEach(l => {
    if (!map[l.profissional_id]) map[l.profissional_id] = [];
    map[l.profissional_id].push(l.user_id);
  });
  return map;
}
export async function toggleLike(profissionalId, userId) {
  const { data: existing } = await sb.from('equipe_likes').select('id')
    .eq('profissional_id', profissionalId).eq('user_id', userId).maybeSingle();
  if (existing) {
    await sb.from('equipe_likes').delete().eq('id', existing.id);
    return false;
  }
  await sb.from('equipe_likes').insert({ profissional_id: profissionalId, user_id: userId });
  return true;
}

// ─── SERVIÇOS ────────────────────────────────────────────────

export async function getAllServicos(includeInactive = false) {
  let q = sb.from('servicos').select('*').order('nome');
  if (!includeInactive) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function getServicos(categoria = null) {
  let q = sb.from('servicos').select('*').eq('ativo', true).order('nome');
  if (categoria) q = q.eq('categoria', categoria);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function createServico(d) {
  const { data, error } = await sb.from('servicos').insert(d).select();
  if (error) throw error;
  return data?.[0] ?? null;
}
export async function updateServico(id, u) {
  const { data, error } = await sb.from('servicos').update(u).eq('id', id).select();
  if (error) throw error;
  return data?.[0] ?? null;
}
export async function deleteServico(id) {
  const { error } = await sb.from('servicos').update({ ativo: false }).eq('id', id);
  if (error) throw error;
}

// ─── AGENDAMENTOS ────────────────────────────────────────────

export async function getAllAgendamentos(filters = {}) {
  let q = sb.from('agendamentos').select(`*,
    clientes(id, nome, telefone, email),
    agendamento_servicos(
      id, preco, duracao_min, hora_inicio, hora_fim,
      servicos(id, nome, preco, duracao_min, icone),
      equipe(id, nome, cargo, cor_agenda)
    ),
    agendamento_produtos(id, quantidade, preco_unitario, servicos(id, nome, preco, icone)),
    usuarios(id, nome)
  `).order('data_hora', { ascending: false });

  if (filters.status)      q = q.eq('status', filters.status);
  if (filters.cliente_id)  q = q.eq('cliente_id', filters.cliente_id);
  if (filters.dataInicio)  q = q.gte('data_hora', filters.dataInicio);
  if (filters.dataFim)     q = q.lte('data_hora', filters.dataFim);
  if (filters.limit)       q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) throw error;

  let result = data ?? [];
  if (filters.profissional_id) {
    result = result.filter(a =>
      a.agendamento_servicos?.some(s => s.equipe?.id === filters.profissional_id)
    );
  }
  return result;
}

export async function getAgendamento(id) {
  const { data, error } = await sb.from('agendamentos').select(`*,
    clientes(*),
    agendamento_servicos(*, servicos(*), equipe(*)),
    agendamento_produtos(*, servicos(*)),
    usuarios(id, nome)
  `).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getAgendamentosDoDia(date) {
  const start = new Date(date); start.setHours(0,0,0,0);
  const end   = new Date(date); end.setHours(23,59,59,999);
  return getAllAgendamentos({ dataInicio: start.toISOString(), dataFim: end.toISOString() });
}

export async function getAgendamentosDoMes(year, month) {
  const start = new Date(year, month-1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);
  return getAllAgendamentos({ dataInicio: start.toISOString(), dataFim: end.toISOString() });
}

// createAgendamento — com verificação de conflito mostrando nome do profissional
export async function createAgendamento(agendamentoData) {
  const { servicos: servicosItems = [], produtos: produtosItems = [], ...agData } = agendamentoData;

  if (!agData.criado_por) {
    const { data: authData } = await sb.auth.getUser();
    if (authData?.user) agData.criado_por = authData.user.id;
  }

  // Verifica conflito de horário — mostra nome do profissional no erro
  for (const svc of servicosItems) {
    if (!svc.profissional_id) continue;
    const inicio  = new Date(svc.hora_inicio);
    const fimSlot = new Date(inicio.getTime() + (svc.duracao_min||60)*60000);

    const { data: conflito } = await sb.from('agendamento_servicos')
      .select('id, equipe(nome), agendamentos!inner(status)')
      .eq('profissional_id', svc.profissional_id)
      .lt('hora_inicio', fimSlot.toISOString())
      .gt('hora_fim',    inicio.toISOString())
      .in('agendamentos.status', ['pendente','confirmado'])
      .limit(1);

    if (conflito?.length > 0) {
      const profNome = conflito[0]?.equipe?.nome || 'este profissional';
      throw new Error(`⚠️ Conflito de horário! ${profNome} já tem um atendimento neste horário. Escolha outro horário ou profissional.`);
    }
  }

  const totalServicos = servicosItems.reduce((s,i) => s+(i.preco||0), 0);
  const totalProdutos = produtosItems.reduce((s,i) => s+(i.preco_unitario||0)*(i.quantidade||1), 0);
  agData.valor_total  = totalServicos + totalProdutos - (agData.desconto||0);
  if (!agData.duracao_min)
    agData.duracao_min = servicosItems.reduce((s,i) => s+(i.duracao_min||60), 0) || 60;

  const { data, error } = await sb.from('agendamentos').insert(agData).select();
  if (error) throw error;
  const ag = data?.[0];
  if (!ag) throw new Error('Erro ao criar agendamento.');

  if (servicosItems.length) {
    const rows = servicosItems.map(s => ({
      agendamento_id:  ag.id,
      servico_id:      s.servico_id || null,
      profissional_id: s.profissional_id || null,
      preco:           s.preco || 0,
      duracao_min:     s.duracao_min || 60,
      hora_inicio:     s.hora_inicio || ag.data_hora,
      hora_fim:        s.hora_fim || new Date(new Date(ag.data_hora).getTime()+(s.duracao_min||60)*60000).toISOString()
    }));
    const { error: svcErr } = await sb.from('agendamento_servicos').insert(rows);
    if (svcErr) console.warn('agendamento_servicos:', svcErr.message);
  }
  if (produtosItems.length) {
    const rows = produtosItems.map(p => ({
      agendamento_id: ag.id,
      servico_id:     p.servico_id || null,
      quantidade:     p.quantidade || 1,
      preco_unitario: p.preco_unitario || 0
    }));
    const { error: pErr } = await sb.from('agendamento_produtos').insert(rows);
    if (pErr) console.warn('agendamento_produtos:', pErr.message);
  }

  await atualizarEstatisticasCliente(agData.cliente_id);
  return ag;
}

export async function updateAgendamento(id, updates) {
  const { data, error } = await sb.from('agendamentos')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (error) throw error;

  if (updates.status && data?.[0]?.cliente_id) {
    await atualizarEstatisticasCliente(data[0].cliente_id);
    if (updates.status === 'concluido') {
      const ag = data[0];
      const { data: authData } = await sb.auth.getUser();
      sb.from('financeiro').insert({
        tipo: 'receita', descricao: 'Agendamento concluído',
        valor: ag.valor_total || 0, categoria: 'servico',
        data: new Date().toISOString().slice(0,10),
        agendamento_id: id, criado_por: authData?.user?.id || null
      }).then(({ error: fe }) => { if (fe) console.warn('financeiro:', fe.message); });
    }
  }
  return data?.[0] ?? null;
}

export async function deleteAgendamento(id) {
  const { error } = await sb.from('agendamentos').delete().eq('id', id);
  if (error) throw error;
}

// Heatmap
export async function getHeatmapDoMes(year, month) {
  const start = new Date(year, month-1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);
  const { data, error } = await sb.from('agendamentos').select('data_hora, status')
    .gte('data_hora', start.toISOString()).lte('data_hora', end.toISOString())
    .not('status','eq','cancelado');
  if (error) return {};
  const map = {};
  (data ?? []).forEach(a => { const d = new Date(a.data_hora).getDate(); map[d]=(map[d]||0)+1; });
  return map;
}

// ─── FINANCEIRO ──────────────────────────────────────────────

export async function getLancamentos(filters = {}) {
  let q = sb.from('financeiro')
    .select('*, agendamentos(id, clientes(nome)), usuarios(nome)')
    .order('data', { ascending: false });
  if (filters.tipo)       q = q.eq('tipo', filters.tipo);
  if (filters.dataInicio) q = q.gte('data', filters.dataInicio);
  if (filters.dataFim)    q = q.lte('data', filters.dataFim);
  if (filters.limit)      q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function createLancamento(d) {
  const { data, error } = await sb.from('financeiro').insert(d).select();
  if (error) throw error;
  return data?.[0] ?? null;
}
export async function deleteLancamento(id) {
  const { error } = await sb.from('financeiro').delete().eq('id', id);
  if (error) throw error;
}
export async function getResumoFinanceiro(ano, mes) {
  const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const fim    = `${ano}-${String(mes).padStart(2,'0')}-31`;
  const { data, error } = await sb.from('financeiro').select('tipo, valor').gte('data',inicio).lte('data',fim);
  if (error) throw error;
  const receitas = (data??[]).filter(l=>l.tipo==='receita').reduce((s,l)=>s+(l.valor||0),0);
  const despesas = (data??[]).filter(l=>l.tipo==='despesa').reduce((s,l)=>s+(l.valor||0),0);
  return { receitas, despesas, lucro: receitas-despesas };
}
export async function getResumoFinanceiroMensal(ano) {
  const { data, error } = await sb.from('financeiro').select('tipo, valor, data')
    .gte('data',`${ano}-01-01`).lte('data',`${ano}-12-31`);
  if (error) throw error;
  const meses = Array.from({length:12},(_,i)=>({mes:i+1,receitas:0,despesas:0,lucro:0}));
  (data??[]).forEach(l => {
    const m = parseInt(l.data.slice(5,7),10)-1;
    if (l.tipo==='receita') meses[m].receitas+=l.valor||0;
    else                    meses[m].despesas+=l.valor||0;
    meses[m].lucro = meses[m].receitas - meses[m].despesas;
  });
  return meses;
}

// ─── DASHBOARD ───────────────────────────────────────────────

export async function getDashboardStats() {
  try {
    const hoje      = new Date();
    const inicioDia = new Date(hoje); inicioDia.setHours(0,0,0,0);
    const fimDia    = new Date(hoje); fimDia.setHours(23,59,59,999);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes    = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0, 23, 59, 59);

    const [
      { count: totalClientes },
      { count: agendamentosHoje },
      { count: agendamentosMes },
      { count: pendentes }
    ] = await Promise.all([
      sb.from('clientes').select('*',{count:'exact',head:true}).eq('ativo',true),
      sb.from('agendamentos').select('*',{count:'exact',head:true}).gte('data_hora',inicioDia.toISOString()).lte('data_hora',fimDia.toISOString()),
      sb.from('agendamentos').select('*',{count:'exact',head:true}).gte('data_hora',inicioMes.toISOString()).lte('data_hora',fimMes.toISOString()),
      sb.from('agendamentos').select('*',{count:'exact',head:true}).eq('status','pendente')
    ]);

    const resumo = await getResumoFinanceiro(hoje.getFullYear(), hoje.getMonth()+1);

    const { data: proximosAgendamentos } = await sb.from('agendamentos').select(`*,
      clientes(nome, telefone),
      agendamento_servicos(servicos(nome, icone), equipe(nome, cor_agenda))
    `).gte('data_hora', new Date().toISOString()).in('status',['pendente','confirmado']).order('data_hora').limit(5);

    const { data: topClientes } = await sb.from('clientes')
      .select('id, nome, total_visitas, total_gasto, ultima_visita')
      .eq('ativo',true).order('total_visitas',{ascending:false}).limit(5);

    return {
      totalClientes: totalClientes??0, agendamentosHoje: agendamentosHoje??0,
      agendamentosMes: agendamentosMes??0, pendentes: pendentes??0,
      receitaMes: resumo.receitas, despesasMes: resumo.despesas, lucroMes: resumo.lucro,
      proximosAgendamentos: proximosAgendamentos??[], topClientes: topClientes??[]
    };
  } catch(e) { console.error('getDashboardStats:', e); return null; }
}

// ─── CHAT ────────────────────────────────────────────────────

export async function getChatMessages(clienteId, limit = 100) {
  const { data, error } = await sb.from('chat_messages')
    .select('*, usuarios(nome, avatar_emote, role)')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getChatClientes() {
  const { data, error } = await sb.from('chat_messages')
    .select('cliente_id, clientes(id, nome, telefone, email)')
    .order('created_at', { ascending: false });
  if (error) return [];
  const seen = new Set();
  return (data ?? []).filter(m => {
    if (seen.has(m.cliente_id)) return false;
    seen.add(m.cliente_id);
    return true;
  }).map(m => m.clientes).filter(Boolean);
}

export async function sendChatMessage(clienteId, userId, mensagem, deAdmin = false) {
  // Insert com campo de_admin explícito para evitar cache schema issues
  const payload = {
    cliente_id: clienteId,
    user_id:    userId,
    mensagem:   String(mensagem),
    de_admin:   Boolean(deAdmin),
    lida:       false
  };
  const { data, error } = await sb.from('chat_messages')
    .insert(payload)
    .select('id, cliente_id, user_id, mensagem, de_admin, lida, created_at, usuarios(nome, avatar_emote, role)');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function markMessagesAsRead(clienteId, isAdmin = false) {
  // Admin marca como lidas as mensagens de clientes (de_admin = false)
  // Cliente marca como lidas as mensagens de admins (de_admin = true)
  await sb.from('chat_messages')
    .update({ lida: true })
    .eq('cliente_id', clienteId)
    .eq('de_admin', isAdmin ? false : true)
    .eq('lida', false);
}

export async function getUnreadChatCount(isAdmin = false) {
  const { count } = await sb.from('chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('lida', false)
    .eq('de_admin', isAdmin ? false : true);
  return count ?? 0;
}

export function subscribeChat(clienteId, callback) {
  return sb.channel(`chat:${clienteId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'chat_messages',
      filter: `cliente_id=eq.${clienteId}`
    }, payload => callback(payload.new))
    .subscribe();
}

export function subscribeAgendamentos(callback) {
  return sb.channel('agendamentos-live')
    .on('postgres_changes', { event:'*', schema:'public', table:'agendamentos' }, () => callback())
    .subscribe();
}
