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
  const { data, error } = await sb
    .from('usuarios')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export default sb;
