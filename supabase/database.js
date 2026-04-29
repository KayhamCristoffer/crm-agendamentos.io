// ================================================================
// DATABASE.JS — CRM Agendamentos com Supabase
// Todas as funções de acesso ao banco de dados
// ================================================================
import { sb } from './client.js';
import { ADMIN_UID } from './supabase-config.js';

// ─── AUTH ─────────────────────────────────────────────────────

export async function signUp(email, password, nome, telefone = '') {
  const redirectTo = window.location.hostname.includes('github.io')
    ? `https://kayhamcristoffer.github.io/crm-agendamentos.io/index.html`
    : `${window.location.origin}/index.html`;

  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
  if (data.user) {
    await sb.from('users').upsert({
      id: data.user.id, email, nome, telefone, role: 'user'
    }, { onConflict: 'id' }).select();
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
      await sb.from('users').upsert({
        id: user.id, email: user.email,
        nome: user.email.split('@')[0],
        role: 'user'
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
  const { data, error } = await sb.from('clientes').insert(clienteData).select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function updateCliente(id, updates) {
  const { data, error } = await sb.from('clientes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function deleteCliente(id) {
  const { error } = await sb.from('clientes').update({ ativo: false }).eq('id', id);
  if (error) throw error;
}

export async function getClienteStats(clienteId) {
  const { data: agendamentos } = await sb.from('agendamentos')
    .select('status, valor, data_hora').eq('cliente_id', clienteId)
    .order('data_hora', { ascending: false });
  const total = agendamentos?.length ?? 0;
  const concluidos = agendamentos?.filter(a => a.status === 'concluido').length ?? 0;
  const gastoTotal = agendamentos?.filter(a => a.status === 'concluido')
    .reduce((s, a) => s + (a.valor || 0), 0) ?? 0;
  const ultimaVisita = agendamentos?.find(a => a.status === 'concluido')?.data_hora ?? null;
  return { total, concluidos, gastoTotal, ultimaVisita };
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

// ─── SERVIÇOS ────────────────────────────────────────────────

export async function getAllServicos(includeInactive = false) {
  let q = sb.from('servicos').select('*').order('nome');
  if (!includeInactive) q = q.eq('ativo', true);
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
      equipe(id, nome, cargo, cor_agenda),
      servicos(id, nome, preco, duracao_min, icone),
      users(id, nome)
    `)
    .order('data_hora', { ascending: false });

  if (filters.status)         q = q.eq('status', filters.status);
  if (filters.cliente_id)     q = q.eq('cliente_id', filters.cliente_id);
  if (filters.profissional_id) q = q.eq('profissional_id', filters.profissional_id);
  if (filters.dataInicio)     q = q.gte('data_hora', filters.dataInicio);
  if (filters.dataFim)        q = q.lte('data_hora', filters.dataFim);
  if (filters.limit)          q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getAgendamento(id) {
  const { data, error } = await sb.from('agendamentos')
    .select(`*, clientes(*), equipe(*), servicos(*), users(id, nome)`)
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function getAgendamentosDoDia(date) {
  const start = new Date(date); start.setHours(0,0,0,0);
  const end   = new Date(date); end.setHours(23,59,59,999);
  return getAllAgendamentos({
    dataInicio: start.toISOString(),
    dataFim:    end.toISOString()
  });
}

export async function getAgendamentosDoMes(year, month) {
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);
  return getAllAgendamentos({
    dataInicio: start.toISOString(),
    dataFim:    end.toISOString()
  });
}

export async function createAgendamento(agendamentoData) {
  // Verifica conflito de horário
  if (agendamentoData.profissional_id) {
    const inicio = new Date(agendamentoData.data_hora);
    const durMin = agendamentoData.duracao_min || 60;
    const fim    = new Date(inicio.getTime() + durMin * 60000);
    const { data: conflito } = await sb.from('agendamentos')
      .select('id, data_hora')
      .eq('profissional_id', agendamentoData.profissional_id)
      .in('status', ['pendente','confirmado'])
      .gte('data_hora', inicio.toISOString())
      .lt('data_hora',  fim.toISOString())
      .limit(1);
    if (conflito?.length > 0) {
      throw new Error('Conflito de horário! O profissional já tem um agendamento nesse período.');
    }
  }

  const { data, error } = await sb.from('agendamentos').insert(agendamentoData).select();
  if (error) throw error;

  // Atualiza total_visitas do cliente
  await atualizarEstatisticasCliente(agendamentoData.cliente_id);
  return data?.[0] ?? null;
}

export async function updateAgendamento(id, updates) {
  const { data, error } = await sb.from('agendamentos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select();
  if (error) throw error;

  // Atualiza stats do cliente se mudou status
  if (updates.status && data?.[0]?.cliente_id) {
    await atualizarEstatisticasCliente(data[0].cliente_id);
    // Cria lançamento financeiro quando concluído
    if (updates.status === 'concluido') {
      const ag = data[0];
      await sb.from('financeiro').insert({
        tipo: 'receita',
        descricao: `Agendamento concluído`,
        valor: ag.valor || 0,
        categoria: 'servico',
        data: new Date().toISOString().slice(0,10),
        agendamento_id: id
      });
    }
  }
  return data?.[0] ?? null;
}

export async function deleteAgendamento(id) {
  const { error } = await sb.from('agendamentos').delete().eq('id', id);
  if (error) throw error;
}

export async function atualizarEstatisticasCliente(clienteId) {
  try {
    const { data: ags } = await sb.from('agendamentos')
      .select('status, valor, data_hora')
      .eq('cliente_id', clienteId)
      .eq('status', 'concluido')
      .order('data_hora', { ascending: false });
    const concluidos   = ags?.length ?? 0;
    const totalGasto   = ags?.reduce((s, a) => s + (a.valor || 0), 0) ?? 0;
    const ultimaVisita = ags?.[0]?.data_hora ?? null;
    await sb.from('clientes').update({
      total_visitas: concluidos,
      total_gasto:   totalGasto,
      ultima_visita: ultimaVisita,
      updated_at:    new Date().toISOString()
    }).eq('id', clienteId);
  } catch(e) { console.warn('atualizarEstatisticasCliente:', e.message); }
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
  const receitas = (data ?? []).filter(l => l.tipo === 'receita').reduce((s,l) => s + (l.valor||0), 0);
  const despesas = (data ?? []).filter(l => l.tipo === 'despesa').reduce((s,l) => s + (l.valor||0), 0);
  return { receitas, despesas, lucro: receitas - despesas };
}

export async function getResumoFinanceiroMensal(ano) {
  const inicio = `${ano}-01-01`;
  const fim    = `${ano}-12-31`;
  const { data, error } = await sb.from('financeiro')
    .select('tipo, valor, data').gte('data', inicio).lte('data', fim);
  if (error) throw error;
  const meses = Array.from({length:12}, (_,i) => ({
    mes: i+1, receitas:0, despesas:0, lucro:0
  }));
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
    const hoje   = new Date();
    const inicioDia = new Date(hoje); inicioDia.setHours(0,0,0,0);
    const fimDia    = new Date(hoje); fimDia.setHours(23,59,59,999);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes    = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0, 23,59,59);

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
      .select(`*, clientes(nome, telefone), equipe(nome, cor_agenda), servicos(nome, icone)`)
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
    .select('*, users(nome)')
    .eq('cliente_id', clienteId)
    .order('created_at');
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
  const ch = sb.channel(`chat-${clienteId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'chat_messages',
      filter: `cliente_id=eq.${clienteId}`
    }, payload => callback(payload.new))
    .subscribe();
  return ch;
}

export async function subscribeAgendamentos(callback) {
  const ch = sb.channel('agendamentos-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' },
      async () => callback())
    .subscribe();
  return ch;
}

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
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  });
}

export function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
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
