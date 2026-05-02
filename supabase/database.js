// ================================================================
// DATABASE.JS — CRM Agendamentos v2 com Supabase
// ================================================================
import { sb } from './client.js';
import { ADMIN_UID } from './supabase-config.js';

// ─── UTILS ────────────────────────────────────────────────────

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
}
export function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

// Formata telefone (XX) XXXXX-XXXX
export function formatPhone(v) {
  if (!v) return '';
  const d = v.replace(/\D/g,'');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return v;
}

// Formata CPF XXX.XXX.XXX-XX
export function formatCPF(v) {
  if (!v) return '';
  const d = v.replace(/\D/g,'');
  if (d.length === 11)
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  return v;
}

// Máscara de telefone aplicada em input
export function applyPhoneMask(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g,'');
    if (v.length > 11) v = v.slice(0,11);
    if (v.length > 6)      input.value = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    else if (v.length > 2) input.value = `(${v.slice(0,2)}) ${v.slice(2)}`;
    else if (v.length > 0) input.value = `(${v}`;
    else                   input.value = v;
  });
}

// Máscara de CPF aplicada em input
export function applyCPFMask(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g,'');
    if (v.length > 11) v = v.slice(0,11);
    if (v.length > 9)       input.value = `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6,9)}-${v.slice(9)}`;
    else if (v.length > 6)  input.value = `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6)}`;
    else if (v.length > 3)  input.value = `${v.slice(0,3)}.${v.slice(3)}`;
    else                    input.value = v;
  });
}

export const STATUS_LABELS = {
  pendente:   { label: 'Pendente',   color: '#f59e0b', icon: '🕐' },
  confirmado: { label: 'Confirmado', color: '#6366f1', icon: '✅' },
  concluido:  { label: 'Concluído',  color: '#10b981', icon: '✔️' },
  cancelado:  { label: 'Cancelado',  color: '#ef4444', icon: '❌' },
  faltou:     { label: 'Faltou',     color: '#6b7280', icon: '⚠️' }
};

export const PAGAMENTO_LABELS = {
  dinheiro:       'Dinheiro',
  pix:            'PIX',
  cartao_debito:  'Cartão Débito',
  cartao_credito: 'Cartão Crédito',
  outros:         'Outros'
};

const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
export { DIAS_SEMANA };

// ─── AUTH ─────────────────────────────────────────────────────

export async function signUp(email, password, nome, telefone = '') {
  const redirectTo = window.location.hostname.includes('github.io')
    ? `https://kayhamcristoffer.github.io/crm-agendamentos.io/index.html`
    : `${window.location.origin}/index.html`;
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: redirectTo, data: { nome } }
  });
  if (error) throw error;
  if (data.user) {
    await sb.from('users').upsert({
      id: data.user.id, email, nome, telefone: telefone || null, role: 'user'
    }, { onConflict: 'id' });
  }
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.user) await ensureProfile(data.user);
  return data;
}

export async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email) {
  const base = window.location.hostname.includes('github.io')
    ? 'https://kayhamcristoffer.github.io/crm-agendamentos.io'
    : window.location.origin;
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/change-password.html`
  });
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      await ensureProfile(session.user);
    }
    callback(session?.user ?? null, event);
  });
  return subscription;
}

export async function ensureProfile(user) {
  if (!user) return;
  try {
    const { data: existing } = await sb.from('users').select('id').eq('id', user.id).maybeSingle();
    if (!existing) {
      const nome = user.user_metadata?.nome || user.email.split('@')[0];
      const isAdminUser = user.id === ADMIN_UID;
      await sb.from('users').upsert({
        id: user.id, email: user.email, nome,
        role: isAdminUser ? 'admin' : 'user'
      }, { onConflict: 'id', ignoreDuplicates: true });
    }
  } catch (e) { console.warn('ensureProfile:', e.message); }
}

// ─── USERS ────────────────────────────────────────────────────

export async function getUser(userId) {
  const { data, error } = await sb.from('users').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function getAllUsers() {
  const { data, error } = await sb.from('users').select('*').order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function updateUserProfile(userId, updates) {
  const { data, error } = await sb
    .from('users').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId).select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function setUserRole(userId, role) {
  return updateUserProfile(userId, { role });
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

// ─── HORÁRIOS DE FUNCIONAMENTO ────────────────────────────────

export async function getHorarios() {
  const { data, error } = await sb.from('horarios_funcionamento')
    .select('*').order('dia_semana');
  if (error) return [];
  return data ?? [];
}

export async function updateHorario(diaSemana, updates) {
  const { error } = await sb.from('horarios_funcionamento')
    .upsert({ dia_semana: diaSemana, ...updates }, { onConflict: 'dia_semana' });
  if (error) throw error;
}

// Retorna slots de horário disponíveis para uma data considerando o estabelecimento
export async function getSlotsDisponiveis(date, profissionalId = null, duracaoMin = 60) {
  const d = new Date(date);
  const diaSemana = d.getDay();
  const horarios = await getHorarios();
  const h = horarios.find(x => x.dia_semana === diaSemana);
  if (!h || !h.aberto) return [];

  const [ahH, ahM] = h.hora_abertura.split(':').map(Number);
  const [afH, afM] = h.hora_fechamento.split(':').map(Number);

  const inicio = new Date(d); inicio.setHours(ahH, ahM, 0, 0);
  const fim    = new Date(d); fim.setHours(afH, afM, 0, 0);

  // Busca agendamentos existentes do profissional nesse dia
  let ocupados = [];
  if (profissionalId) {
    const startDay = new Date(d); startDay.setHours(0,0,0,0);
    const endDay   = new Date(d); endDay.setHours(23,59,59,999);
    const { data: ags } = await sb.from('agendamento_servicos')
      .select('hora_inicio, hora_fim')
      .eq('profissional_id', profissionalId)
      .gte('hora_inicio', startDay.toISOString())
      .lte('hora_inicio', endDay.toISOString());
    ocupados = ags ?? [];
  }

  const slots = [];
  let cur = new Date(inicio);
  while (cur.getTime() + duracaoMin * 60000 <= fim.getTime()) {
    const slotFim = new Date(cur.getTime() + duracaoMin * 60000);
    const busy = ocupados.some(o => {
      const oI = new Date(o.hora_inicio);
      const oF = new Date(o.hora_fim);
      return cur < oF && slotFim > oI;
    });
    if (!busy) {
      slots.push({
        hora: cur.toTimeString().slice(0,5),
        iso:  cur.toISOString()
      });
    }
    cur = new Date(cur.getTime() + 30 * 60000); // slots de 30 em 30 min
  }
  return slots;
}

// ─── CLIENTES ────────────────────────────────────────────────

export async function getAllClientes(includeInactive = false) {
  let q = sb.from('clientes').select('*').order('nome');
  if (!includeInactive) q = q.eq('ativo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getCliente(id) {
  const { data, error } = await sb.from('clientes').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function searchClientes(query) {
  const { data, error } = await sb.from('clientes')
    .select('*')
    .or(`nome.ilike.%${query}%,email.ilike.%${query}%,telefone.ilike.%${query}%,cpf.ilike.%${query}%`)
    .eq('ativo', true)
    .order('nome').limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function createCliente(clienteData) {
  // Garante criado_por = uid do usuário autenticado para evitar FK violation
  const { data: authData } = await sb.auth.getUser();
  const payload = { ...clienteData };
  if (authData?.user) {
    payload.criado_por = authData.user.id;
  } else {
    delete payload.criado_por; // anonymous fallback
  }
  const { data, error } = await sb.from('clientes').insert(payload).select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function updateCliente(id, updates) {
  // Remove criado_por do update para não violar FK
  const payload = { ...updates };
  delete payload.criado_por;
  const { data, error } = await sb.from('clientes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function deleteCliente(id) {
  const { error } = await sb.from('clientes').update({ ativo: false }).eq('id', id);
  if (error) throw error;
}

export async function getClienteStats(clienteId) {
  const { data: ags } = await sb.from('agendamentos')
    .select('status, valor_total, data_hora').eq('cliente_id', clienteId)
    .order('data_hora', { ascending: false });
  const total       = ags?.length ?? 0;
  const concluidos  = ags?.filter(a => a.status === 'concluido').length ?? 0;
  const gastoTotal  = ags?.filter(a => a.status === 'concluido')
    .reduce((s, a) => s + (a.valor_total || 0), 0) ?? 0;
  const ultimaVisita = ags?.find(a => a.status === 'concluido')?.data_hora ?? null;
  return { total, concluidos, gastoTotal, ultimaVisita };
}

export async function atualizarEstatisticasCliente(clienteId) {
  try {
    const { data: ags } = await sb.from('agendamentos')
      .select('status, valor_total, data_hora')
      .eq('cliente_id', clienteId)
      .eq('status', 'concluido')
      .order('data_hora', { ascending: false });
    const concluidos   = ags?.length ?? 0;
    const totalGasto   = ags?.reduce((s, a) => s + (a.valor_total || 0), 0) ?? 0;
    const ultimaVisita = ags?.[0]?.data_hora ?? null;
    await sb.from('clientes').update({
      total_visitas: concluidos,
      total_gasto:   totalGasto,
      ultima_visita: ultimaVisita,
      updated_at:    new Date().toISOString()
    }).eq('id', clienteId);
  } catch(e) { console.warn('atualizarEstatisticasCliente:', e.message); }
}

// ─── EQUIPE ───────────────────────────────────────────────────

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

export async function deleteProfissional(id) {
  const { error } = await sb.from('equipe').update({ ativo: false }).eq('id', id);
  if (error) throw error;
}

// ─── EQUIPE LIKES ─────────────────────────────────────────────

export async function getLikesPorProfissional() {
  const { data, error } = await sb.from('equipe_likes')
    .select('profissional_id, user_id');
  if (error) return {};
  const map = {};
  (data ?? []).forEach(l => {
    if (!map[l.profissional_id]) map[l.profissional_id] = [];
    map[l.profissional_id].push(l.user_id);
  });
  return map;
}

export async function toggleLike(profissionalId, userId) {
  const { data: existing } = await sb.from('equipe_likes')
    .select('id')
    .eq('profissional_id', profissionalId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) {
    await sb.from('equipe_likes').delete().eq('id', existing.id);
    return false;
  } else {
    await sb.from('equipe_likes').insert({ profissional_id: profissionalId, user_id: userId });
    return true;
  }
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

export async function createServico(servicoData) {
  const { data, error } = await sb.from('servicos').insert(servicoData).select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function updateServico(id, updates) {
  const { data, error } = await sb.from('servicos').update(updates).eq('id', id).select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function deleteServico(id) {
  const { error } = await sb.from('servicos').update({ ativo: false }).eq('id', id);
  if (error) throw error;
}

// ─── AGENDAMENTOS ────────────────────────────────────────────

export async function getAllAgendamentos(filters = {}) {
  let q = sb.from('agendamentos')
    .select(`*,
      clientes(id, nome, telefone, email),
      agendamento_servicos(
        id, preco, duracao_min, hora_inicio, hora_fim,
        servicos(id, nome, preco, duracao_min, icone),
        equipe(id, nome, cargo, cor_agenda)
      ),
      agendamento_produtos(
        id, quantidade, preco_unitario,
        servicos(id, nome, preco, icone)
      ),
      users(id, nome)
    `)
    .order('data_hora', { ascending: false });

  if (filters.status)         q = q.eq('status', filters.status);
  if (filters.cliente_id)     q = q.eq('cliente_id', filters.cliente_id);
  if (filters.profissional_id) {
    // Filtrar via agendamento_servicos requer subquery — fazemos no lado JS
  }
  if (filters.dataInicio)     q = q.gte('data_hora', filters.dataInicio);
  if (filters.dataFim)        q = q.lte('data_hora', filters.dataFim);
  if (filters.limit)          q = q.limit(filters.limit);

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
  const { data, error } = await sb.from('agendamentos')
    .select(`*,
      clientes(*),
      agendamento_servicos(*, servicos(*), equipe(*)),
      agendamento_produtos(*, servicos(*)),
      users(id, nome)
    `)
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getAgendamentosDoDia(date) {
  const start = new Date(date); start.setHours(0,0,0,0);
  const end   = new Date(date); end.setHours(23,59,59,999);
  return getAllAgendamentos({ dataInicio: start.toISOString(), dataFim: end.toISOString() });
}

export async function getAgendamentosDoMes(year, month) {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);
  return getAllAgendamentos({ dataInicio: start.toISOString(), dataFim: end.toISOString() });
}

// Cria agendamento com múltiplos serviços e produtos
export async function createAgendamento(agendamentoData) {
  const { servicos: servicosItems = [], produtos: produtosItems = [], ...agData } = agendamentoData;

  // Garante criado_por = uid do usuário autenticado para evitar FK violation
  if (!agData.criado_por) {
    const { data: authData } = await sb.auth.getUser();
    if (authData?.user) agData.criado_por = authData.user.id;
  }

  // Verifica conflito de horário por profissional em agendamento_servicos
  for (const svc of servicosItems) {
    if (!svc.profissional_id) continue;
    const inicio  = new Date(svc.hora_inicio);
    const durMin  = svc.duracao_min || 60;
    const fimSlot = new Date(inicio.getTime() + durMin * 60000);
    const { data: conflito } = await sb.from('agendamento_servicos')
      .select('id, agendamentos(status)')
      .eq('profissional_id', svc.profissional_id)
      .gte('hora_inicio', inicio.toISOString())
      .lt('hora_inicio', fimSlot.toISOString())
      .limit(1);
    const ativo = (conflito ?? []).filter(c =>
      ['pendente','confirmado'].includes(c.agendamentos?.status)
    );
    if (ativo.length > 0) {
      throw new Error(`Conflito de horário! O profissional já tem um atendimento nesse horário.`);
    }
  }

  // Calcula valor total
  const totalServicos = servicosItems.reduce((s, i) => s + (i.preco || 0), 0);
  const totalProdutos = produtosItems.reduce((s, i) => s + (i.preco_unitario || 0) * (i.quantidade || 1), 0);
  agData.valor_total  = totalServicos + totalProdutos - (agData.desconto || 0);

  // Duração total calculada a partir dos serviços
  if (!agData.duracao_min) {
    agData.duracao_min = servicosItems.reduce((s, i) => s + (i.duracao_min || 60), 0) || 60;
  }

  const { data, error } = await sb.from('agendamentos').insert(agData).select();
  if (error) throw error;
  const ag = data?.[0];
  if (!ag) throw new Error('Erro ao criar agendamento.');

  // Insere itens de serviço
  if (servicosItems.length) {
    const svcRows = servicosItems.map(s => ({
      agendamento_id:  ag.id,
      servico_id:      s.servico_id || null,
      profissional_id: s.profissional_id || null,
      preco:           s.preco || 0,
      duracao_min:     s.duracao_min || 60,
      hora_inicio:     s.hora_inicio || ag.data_hora,
      hora_fim:        s.hora_fim || new Date(new Date(ag.data_hora).getTime() + (s.duracao_min||60)*60000).toISOString()
    }));
    const { error: svcErr } = await sb.from('agendamento_servicos').insert(svcRows);
    if (svcErr) console.warn('agendamento_servicos insert:', svcErr.message);
  }

  // Insere itens de produto
  if (produtosItems.length) {
    const prodRows = produtosItems.map(p => ({
      agendamento_id: ag.id,
      servico_id:     p.servico_id || null,
      quantidade:     p.quantidade || 1,
      preco_unitario: p.preco_unitario || 0
    }));
    const { error: prodErr } = await sb.from('agendamento_produtos').insert(prodRows);
    if (prodErr) console.warn('agendamento_produtos insert:', prodErr.message);
  }

  await atualizarEstatisticasCliente(agData.cliente_id);
  return ag;
}

export async function updateAgendamento(id, updates) {
  const { data, error } = await sb.from('agendamentos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (error) throw error;

  if (updates.status && data?.[0]?.cliente_id) {
    await atualizarEstatisticasCliente(data[0].cliente_id);
    if (updates.status === 'concluido') {
      const ag = data[0];
      // Garante criado_por para evitar FK violation no financeiro
      const { data: authData } = await sb.auth.getUser();
      await sb.from('financeiro').insert({
        tipo: 'receita',
        descricao: `Agendamento concluído`,
        valor: ag.valor_total || 0,
        categoria: 'servico',
        data: new Date().toISOString().slice(0,10),
        agendamento_id: id,
        criado_por: authData?.user?.id || null
      }).then(({ error: fe }) => { if (fe) console.warn('financeiro insert:', fe.message); });
    }
  }
  return data?.[0] ?? null;
}

export async function deleteAgendamento(id) {
  const { error } = await sb.from('agendamentos').delete().eq('id', id);
  if (error) throw error;
}

// Heatmap — conta agendamentos por dia do mês
export async function getHeatmapDoMes(year, month) {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);
  const { data, error } = await sb.from('agendamentos')
    .select('data_hora, status')
    .gte('data_hora', start.toISOString())
    .lte('data_hora', end.toISOString())
    .not('status', 'eq', 'cancelado');
  if (error) return {};
  const map = {};
  (data ?? []).forEach(a => {
    const day = new Date(a.data_hora).getDate();
    map[day] = (map[day] || 0) + 1;
  });
  return map;
}

// ─── FINANCEIRO ──────────────────────────────────────────────

export async function getLancamentos(filters = {}) {
  let q = sb.from('financeiro')
    .select('*, agendamentos(id, clientes(nome)), users(nome)')
    .order('data', { ascending: false });
  if (filters.tipo)      q = q.eq('tipo', filters.tipo);
  if (filters.dataInicio) q = q.gte('data', filters.dataInicio);
  if (filters.dataFim)    q = q.lte('data', filters.dataFim);
  if (filters.limit)      q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createLancamento(lancamentoData) {
  const { data, error } = await sb.from('financeiro').insert(lancamentoData).select();
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
  const { data, error } = await sb.from('financeiro')
    .select('tipo, valor').gte('data', inicio).lte('data', fim);
  if (error) throw error;
  const receitas = (data ?? []).filter(l => l.tipo === 'receita').reduce((s,l) => s+(l.valor||0), 0);
  const despesas = (data ?? []).filter(l => l.tipo === 'despesa').reduce((s,l) => s+(l.valor||0), 0);
  return { receitas, despesas, lucro: receitas - despesas };
}

export async function getResumoFinanceiroMensal(ano) {
  const inicio = `${ano}-01-01`;
  const fim    = `${ano}-12-31`;
  const { data, error } = await sb.from('financeiro')
    .select('tipo, valor, data').gte('data', inicio).lte('data', fim);
  if (error) throw error;
  const meses = Array.from({length:12}, (_,i) => ({ mes:i+1, receitas:0, despesas:0, lucro:0 }));
  (data ?? []).forEach(l => {
    const m = parseInt(l.data.slice(5,7), 10) - 1;
    if (l.tipo === 'receita') meses[m].receitas += l.valor||0;
    else                      meses[m].despesas += l.valor||0;
    meses[m].lucro = meses[m].receitas - meses[m].despesas;
  });
  return meses;
}

// ─── DASHBOARD STATS ─────────────────────────────────────────

export async function getDashboardStats() {
  try {
    const hoje       = new Date();
    const inicioDia  = new Date(hoje); inicioDia.setHours(0,0,0,0);
    const fimDia     = new Date(hoje); fimDia.setHours(23,59,59,999);
    const inicioMes  = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes     = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0, 23,59,59);

    const [
      { count: totalClientes },
      { count: agendamentosHoje },
      { count: agendamentosMes },
      { count: pendentes }
    ] = await Promise.all([
      sb.from('clientes').select('*',{count:'exact',head:true}).eq('ativo',true),
      sb.from('agendamentos').select('*',{count:'exact',head:true})
        .gte('data_hora', inicioDia.toISOString()).lte('data_hora', fimDia.toISOString()),
      sb.from('agendamentos').select('*',{count:'exact',head:true})
        .gte('data_hora', inicioMes.toISOString()).lte('data_hora', fimMes.toISOString()),
      sb.from('agendamentos').select('*',{count:'exact',head:true}).eq('status','pendente')
    ]);

    const resumo = await getResumoFinanceiro(hoje.getFullYear(), hoje.getMonth()+1);

    const { data: proximosAgendamentos } = await sb.from('agendamentos')
      .select(`*,
        clientes(nome, telefone),
        agendamento_servicos(servicos(nome, icone), equipe(nome, cor_agenda))
      `)
      .gte('data_hora', new Date().toISOString())
      .in('status', ['pendente','confirmado'])
      .order('data_hora').limit(5);

    const { data: topClientes } = await sb.from('clientes')
      .select('id, nome, total_visitas, total_gasto, ultima_visita')
      .eq('ativo', true)
      .order('total_visitas', { ascending: false }).limit(5);

    return {
      totalClientes:    totalClientes    ?? 0,
      agendamentosHoje: agendamentosHoje ?? 0,
      agendamentosMes:  agendamentosMes  ?? 0,
      pendentes:        pendentes        ?? 0,
      receitaMes:       resumo.receitas,
      despesasMes:      resumo.despesas,
      lucroMes:         resumo.lucro,
      proximosAgendamentos: proximosAgendamentos ?? [],
      topClientes:          topClientes          ?? []
    };
  } catch(e) {
    console.error('getDashboardStats:', e);
    return null;
  }
}

// ─── CHAT ─────────────────────────────────────────────────────

export async function getChatMessages(clienteId) {
  const { data, error } = await sb.from('chat_messages')
    .select('*, users(nome)').eq('cliente_id', clienteId).order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function sendChatMessage(clienteId, userId, mensagem, deCliente = false) {
  const { data, error } = await sb.from('chat_messages').insert({
    cliente_id: clienteId, user_id: userId,
    mensagem, de_cliente: deCliente, lida: false
  }).select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function markMessagesAsRead(clienteId) {
  await sb.from('chat_messages')
    .update({ lida: true }).eq('cliente_id', clienteId).eq('de_cliente', true).eq('lida', false);
}

export async function subscribeChat(clienteId, callback) {
  return sb.channel(`chat-${clienteId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'chat_messages',
      filter: `cliente_id=eq.${clienteId}`
    }, payload => callback(payload.new))
    .subscribe();
}

export async function subscribeAgendamentos(callback) {
  return sb.channel('agendamentos-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' },
      async () => callback())
    .subscribe();
}
