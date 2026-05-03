-- ============================================================
-- MIGRATION v2 — CRM Agendamentos
-- Adds: avatar_emote column (if missing), atendente RLS,
--       equipe avatar_url, performance indexes,
--       agendamentos extra columns (para_outro, nome_outro)
-- Run this ONLY if you started from an older setup.sql
-- ============================================================

-- 1. Ensure avatar_emote column exists on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_emote TEXT DEFAULT '😊';

-- 2. Ensure role CHECK includes 'atendente'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'atendente', 'admin'));

-- 3. Ensure equipe has avatar_url (photo support)
ALTER TABLE equipe ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 4. Ensure agendamentos has para_outro / nome_outro columns
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS para_outro  BOOLEAN DEFAULT FALSE;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS nome_outro  TEXT;

-- 5. Fix financeiro: ensure 'data' column exists (NOT data_hora)
--    The financeiro table uses 'data DATE', not 'data_hora TIMESTAMPTZ'.
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS data DATE DEFAULT CURRENT_DATE;

-- 6. RLS policies for atendente role on agendamentos (read)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'agendamentos' AND policyname = 'ag_atendente_sel'
  ) THEN
    CREATE POLICY "ag_atendente_sel" ON agendamentos FOR SELECT
      USING (
        auth.uid() IS NOT NULL AND (
          is_admin() OR
          (SELECT role FROM users WHERE id = auth.uid()) IN ('atendente', 'user')
        )
      );
  END IF;
END $$;

-- 7. RLS policy for atendente: insert clientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'clientes' AND policyname = 'cl_atendente_ins'
  ) THEN
    CREATE POLICY "cl_atendente_ins" ON clientes FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL AND (
          is_admin() OR
          (SELECT role FROM users WHERE id = auth.uid()) IN ('atendente', 'user')
        )
      );
  END IF;
END $$;

-- 8. Performance indexes
--    NOTE: financeiro uses 'data' column, NOT 'data_hora'
CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role);
CREATE INDEX IF NOT EXISTS idx_equipe_ativo       ON equipe(ativo);
CREATE INDEX IF NOT EXISTS idx_ag_criado_por      ON agendamentos(criado_por);
CREATE INDEX IF NOT EXISTS idx_ag_data_status     ON agendamentos(data_hora, status);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo    ON financeiro(tipo, data);
CREATE INDEX IF NOT EXISTS idx_likes_prof         ON equipe_likes(profissional_id);
CREATE INDEX IF NOT EXISTS idx_likes_user         ON equipe_likes(user_id);

-- Done
SELECT 'Migration v2 applied successfully.' AS result;
