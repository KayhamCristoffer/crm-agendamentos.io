// ============================================================
// SUPABASE CLIENT — CRM Agendamentos v4.0
// Tabela: usuarios (antigo users)
// ============================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const { createClient } = supabase; // via CDN global

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: localStorage
  }
});

export async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function getUserProfile(userId) {
  // Use maybeSingle + explicit columns to avoid RLS edge cases
  const { data, error } = await sb
    .from('usuarios')
    .select('id, email, nome, telefone, role, avatar_url, avatar_emote, ativo, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Perfil não encontrado');
  return data;
}

export default sb;
