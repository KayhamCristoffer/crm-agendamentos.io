-- ================================================================
-- CRM AGENDAMENTOS - SETUP SQL v2
-- Sistema completo de CRM com Supabase (PostgreSQL)
-- Execute no: Supabase > SQL Editor > New Query > Run
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- DROP (ordem importa pelas FKs)
-- ================================================================
DROP TABLE IF EXISTS agendamento_produtos   CASCADE;
DROP TABLE IF EXISTS agendamento_servicos   CASCADE;
DROP TABLE IF EXISTS chat_messages          CASCADE;
DROP TABLE IF EXISTS financeiro             CASCADE;
DROP TABLE IF EXISTS agendamentos           CASCADE;
DROP TABLE IF EXISTS servicos               CASCADE;
DROP TABLE IF EXISTS equipe_likes           CASCADE;
DROP TABLE IF EXISTS equipe                 CASCADE;
DROP TABLE IF EXISTS clientes               CASCADE;
DROP TABLE IF EXISTS horarios_funcionamento CASCADE;
DROP TABLE IF EXISTS config_sistema         CASCADE;
DROP TABLE IF EXISTS users                  CASCADE;

DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER  IF EXISTS users_updated_at     ON users;
DROP TRIGGER  IF EXISTS clientes_updated_at  ON clientes;
DROP TRIGGER  IF EXISTS agendamentos_updated_at ON agendamentos;
DROP FUNCTION IF EXISTS handle_new_user()    CASCADE;
DROP FUNCTION IF EXISTS is_admin()           CASCADE;
DROP FUNCTION IF EXISTS update_updated_at()  CASCADE;

-- ================================================================
-- USERS (perfis de acesso ao sistema)
-- ================================================================
CREATE TABLE users (
    id           UUID PRIMARY KEY
                 CONSTRAINT fk_users_auth REFERENCES auth.users(id) ON DELETE CASCADE,
    email        TEXT UNIQUE NOT NULL,
    nome         TEXT NOT NULL,
    telefone     TEXT,
    role         TEXT DEFAULT 'user' CHECK (role IN ('user','atendente','admin')),
    avatar_url   TEXT,
    avatar_emote TEXT DEFAULT '😊',
    ativo        BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- CONFIG SISTEMA
-- ================================================================
CREATE TABLE config_sistema (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chave       TEXT UNIQUE NOT NULL,
    valor       TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- HORARIOS DE FUNCIONAMENTO (por dia da semana)
-- ================================================================
CREATE TABLE horarios_funcionamento (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dia_semana    INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 1=Seg...6=Sab
    aberto        BOOLEAN DEFAULT TRUE,
    hora_abertura TIME DEFAULT '09:00',
    hora_fechamento TIME DEFAULT '18:00',
    UNIQUE(dia_semana)
);

-- ================================================================
-- CLIENTES
-- ================================================================
CREATE TABLE clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome            TEXT NOT NULL,
    email           TEXT,
    telefone        TEXT,
    cpf             TEXT,
    data_nascimento DATE,
    endereco        TEXT,
    cidade          TEXT,
    observacoes     TEXT,
    tags            TEXT[],
    total_visitas   INT DEFAULT 0,
    total_gasto     NUMERIC(10,2) DEFAULT 0,
    ultima_visita   TIMESTAMPTZ,
    ativo           BOOLEAN DEFAULT TRUE,
    criado_por      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- EQUIPE (profissionais)
-- ================================================================
CREATE TABLE equipe (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome          TEXT NOT NULL,
    cargo         TEXT,
    especialidade TEXT,
    telefone      TEXT,
    email         TEXT,
    avatar_url    TEXT,
    cor_agenda    TEXT DEFAULT '#6366f1',
    salario       NUMERIC(10,2) DEFAULT 0,
    ativo         BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- EQUIPE LIKES (usuários podem curtir profissionais)
-- ================================================================
CREATE TABLE equipe_likes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profissional_id UUID NOT NULL REFERENCES equipe(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profissional_id, user_id)
);

-- ================================================================
-- SERVICOS / PRODUTOS
-- ================================================================
CREATE TABLE servicos (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome          TEXT NOT NULL,
    descricao     TEXT,
    categoria     TEXT DEFAULT 'servico' CHECK (categoria IN ('servico','produto')),
    preco         NUMERIC(10,2) DEFAULT 0,
    duracao_min   INT DEFAULT 60,  -- NULL ou 0 para produtos
    cor           TEXT DEFAULT '#6366f1',
    icone         TEXT DEFAULT '✂️',
    ativo         BOOLEAN DEFAULT TRUE,
    estoque       INT DEFAULT -1,  -- -1 = ilimitado
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- AGENDAMENTOS (cabeçalho)
-- ================================================================
CREATE TABLE agendamentos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    criado_por      UUID REFERENCES users(id) ON DELETE SET NULL,
    data_hora       TIMESTAMPTZ NOT NULL,
    duracao_min     INT DEFAULT 60,
    status          TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','concluido','cancelado','faltou')),
    valor_total     NUMERIC(10,2) DEFAULT 0,
    desconto        NUMERIC(10,2) DEFAULT 0,
    forma_pagamento TEXT DEFAULT 'dinheiro' CHECK (forma_pagamento IN ('dinheiro','pix','cartao_debito','cartao_credito','outros')),
    observacoes     TEXT,
    notas_internas  TEXT,
    para_outro      BOOLEAN DEFAULT FALSE,   -- agendado para outra pessoa
    nome_outro      TEXT,                    -- nome da outra pessoa
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- AGENDAMENTO_SERVICOS (itens de serviço do agendamento)
-- ================================================================
CREATE TABLE agendamento_servicos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agendamento_id  UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
    servico_id      UUID REFERENCES servicos(id) ON DELETE SET NULL,
    profissional_id UUID REFERENCES equipe(id) ON DELETE SET NULL,
    preco           NUMERIC(10,2) DEFAULT 0,
    duracao_min     INT DEFAULT 60,
    hora_inicio     TIMESTAMPTZ,
    hora_fim        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- AGENDAMENTO_PRODUTOS (itens de produto do agendamento)
-- ================================================================
CREATE TABLE agendamento_produtos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agendamento_id  UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
    servico_id      UUID REFERENCES servicos(id) ON DELETE SET NULL,  -- produto
    quantidade      INT DEFAULT 1,
    preco_unitario  NUMERIC(10,2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- FINANCEIRO (lançamentos extras)
-- ================================================================
CREATE TABLE financeiro (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo           TEXT DEFAULT 'receita' CHECK (tipo IN ('receita','despesa')),
    descricao      TEXT NOT NULL,
    valor          NUMERIC(10,2) DEFAULT 0,
    categoria      TEXT,
    data           DATE DEFAULT CURRENT_DATE,
    agendamento_id UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
    criado_por     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- CHAT MESSAGES
-- ================================================================
CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    de_cliente  BOOLEAN DEFAULT FALSE,
    mensagem    TEXT NOT NULL,
    lida        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- FUNÇÕES
-- ================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
          AND role = 'admin'
    ) OR auth.uid() = 'c89ac00a-1351-4bc2-8818-e8b96a5f52ed'::uuid;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.users (id, email, nome, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
        CASE WHEN NEW.id = 'c89ac00a-1351-4bc2-8818-e8b96a5f52ed'::uuid THEN 'admin' ELSE 'user' END
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clientes_updated_at
    BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agendamentos_updated_at
    BEFORE UPDATE ON agendamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_sistema           ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_funcionamento   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_likes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamento_servicos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamento_produtos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro               ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages            ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "u_sel" ON users FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "u_ins" ON users FOR INSERT  WITH CHECK (auth.uid() = id OR is_admin());
CREATE POLICY "u_upd" ON users FOR UPDATE  USING (auth.uid() = id OR is_admin());
CREATE POLICY "u_del" ON users FOR DELETE  USING (is_admin());

-- CONFIG SISTEMA
CREATE POLICY "cfg_sel" ON config_sistema FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "cfg_ins" ON config_sistema FOR INSERT  WITH CHECK (is_admin());
CREATE POLICY "cfg_upd" ON config_sistema FOR UPDATE  USING (is_admin());
CREATE POLICY "cfg_del" ON config_sistema FOR DELETE  USING (is_admin());

-- HORÁRIOS
CREATE POLICY "h_sel" ON horarios_funcionamento FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "h_ins" ON horarios_funcionamento FOR INSERT  WITH CHECK (is_admin());
CREATE POLICY "h_upd" ON horarios_funcionamento FOR UPDATE  USING (is_admin());
CREATE POLICY "h_del" ON horarios_funcionamento FOR DELETE  USING (is_admin());

-- CLIENTES
CREATE POLICY "c_sel" ON clientes FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "c_ins" ON clientes FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "c_upd" ON clientes FOR UPDATE  USING (auth.uid() IS NOT NULL);
CREATE POLICY "c_del" ON clientes FOR DELETE  USING (is_admin());

-- EQUIPE
CREATE POLICY "e_sel"  ON equipe FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "e_ins"  ON equipe FOR INSERT  WITH CHECK (is_admin());
CREATE POLICY "e_upd"  ON equipe FOR UPDATE  USING (is_admin());
CREATE POLICY "e_del"  ON equipe FOR DELETE  USING (is_admin());

-- EQUIPE LIKES
CREATE POLICY "el_sel" ON equipe_likes FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "el_ins" ON equipe_likes FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "el_del" ON equipe_likes FOR DELETE  USING (auth.uid() = user_id OR is_admin());

-- SERVICOS
CREATE POLICY "s_sel" ON servicos FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "s_ins" ON servicos FOR INSERT  WITH CHECK (is_admin());
CREATE POLICY "s_upd" ON servicos FOR UPDATE  USING (is_admin());
CREATE POLICY "s_del" ON servicos FOR DELETE  USING (is_admin());

-- AGENDAMENTOS
CREATE POLICY "a_sel" ON agendamentos FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "a_ins" ON agendamentos FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "a_upd" ON agendamentos FOR UPDATE  USING (auth.uid() IS NOT NULL);
CREATE POLICY "a_del" ON agendamentos FOR DELETE  USING (is_admin());

-- AGENDAMENTO SERVICOS
CREATE POLICY "as_sel" ON agendamento_servicos FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "as_ins" ON agendamento_servicos FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "as_upd" ON agendamento_servicos FOR UPDATE  USING (auth.uid() IS NOT NULL);
CREATE POLICY "as_del" ON agendamento_servicos FOR DELETE  USING (auth.uid() IS NOT NULL);

-- AGENDAMENTO PRODUTOS
CREATE POLICY "ap_sel" ON agendamento_produtos FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ap_ins" ON agendamento_produtos FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ap_upd" ON agendamento_produtos FOR UPDATE  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ap_del" ON agendamento_produtos FOR DELETE  USING (auth.uid() IS NOT NULL);

-- FINANCEIRO
CREATE POLICY "f_sel" ON financeiro FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "f_ins" ON financeiro FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "f_upd" ON financeiro FOR UPDATE  USING (is_admin());
CREATE POLICY "f_del" ON financeiro FOR DELETE  USING (is_admin());

-- CHAT
CREATE POLICY "ch_sel" ON chat_messages FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ch_ins" ON chat_messages FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ch_upd" ON chat_messages FOR UPDATE  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ch_del" ON chat_messages FOR DELETE  USING (is_admin());

-- ================================================================
-- ÍNDICES
-- ================================================================
CREATE INDEX idx_clientes_nome        ON clientes(nome);
CREATE INDEX idx_clientes_email       ON clientes(email);
CREATE INDEX idx_clientes_telefone    ON clientes(telefone);
CREATE INDEX idx_agendamentos_data    ON agendamentos(data_hora);
CREATE INDEX idx_agendamentos_status  ON agendamentos(status);
CREATE INDEX idx_agendamentos_cliente ON agendamentos(cliente_id);
CREATE INDEX idx_ag_servicos_ag       ON agendamento_servicos(agendamento_id);
CREATE INDEX idx_ag_servicos_prof     ON agendamento_servicos(profissional_id);
CREATE INDEX idx_ag_produtos_ag       ON agendamento_produtos(agendamento_id);
CREATE INDEX idx_financeiro_data      ON financeiro(data);
CREATE INDEX idx_financeiro_tipo      ON financeiro(tipo);
CREATE INDEX idx_chat_cliente         ON chat_messages(cliente_id);
CREATE INDEX idx_equipe_likes_prof    ON equipe_likes(profissional_id);
CREATE INDEX idx_equipe_likes_user    ON equipe_likes(user_id);

-- ================================================================
-- DADOS INICIAIS — Horários de Funcionamento
-- ================================================================
INSERT INTO horarios_funcionamento (dia_semana, aberto, hora_abertura, hora_fechamento) VALUES
  (0, FALSE, '09:00', '18:00'), -- Domingo
  (1, TRUE,  '09:00', '19:00'), -- Segunda
  (2, TRUE,  '09:00', '19:00'), -- Terça
  (3, TRUE,  '09:00', '19:00'), -- Quarta
  (4, TRUE,  '09:00', '19:00'), -- Quinta
  (5, TRUE,  '09:00', '19:00'), -- Sexta
  (6, TRUE,  '09:00', '17:00')  -- Sábado
ON CONFLICT (dia_semana) DO NOTHING;

-- ================================================================
-- DADOS INICIAIS — Config Sistema
-- ================================================================
INSERT INTO config_sistema (chave, valor) VALUES
  ('nome_negocio',  'CRM Agendamentos'),
  ('telefone',      '(11) 99454-6931'),
  ('endereco',      'Av das Nações, São André, 454'),
  ('maps_url',      'https://maps.google.com/?q=Av+das+Nações,+São+André,+454')
ON CONFLICT (chave) DO NOTHING;

-- ================================================================
-- DADOS INICIAIS — Serviços
-- ================================================================
INSERT INTO servicos (nome, descricao, categoria, preco, duracao_min, cor, icone, ativo)
VALUES
  ('Corte Masculino',    'Corte completo com acabamento',       'servico', 45.00,  30,  '#6366f1', '✂️', true),
  ('Corte Feminino',     'Corte + escova',                      'servico', 90.00,  60,  '#ec4899', '✂️', true),
  ('Coloração',          'Coloração completa com tintura',      'servico', 180.00, 120, '#f59e0b', '🎨', true),
  ('Manicure',           'Cutícula + esmaltação',               'servico', 35.00,  45,  '#f43f5e', '💅', true),
  ('Pedicure',           'Cutícula + esmaltação nos pés',       'servico', 40.00,  45,  '#ef4444', '💅', true),
  ('Hidratação',         'Hidratação capilar intensiva',        'servico', 80.00,  60,  '#10b981', '💆', true),
  ('Escova Progressiva', 'Alisamento com progressiva',          'servico', 250.00, 180, '#8b5cf6', '💇', true),
  ('Limpeza de Pele',    'Limpeza facial completa',             'servico', 120.00, 90,  '#06b6d4', '🧖', true),
  ('Shampoo',            'Shampoo profissional 300ml',          'produto', 28.90,  0,   '#6366f1', '🧴', true),
  ('Condicionador',      'Condicionador hidratante 300ml',      'produto', 32.90,  0,   '#8b5cf6', '🧴', true),
  ('Esmalte Top',        'Esmalte de longa duração',            'produto', 15.00,  0,   '#ec4899', '💅', true)
ON CONFLICT DO NOTHING;

-- ================================================================
-- DADOS INICIAIS — Equipe
-- ================================================================
INSERT INTO equipe (nome, cargo, especialidade, cor_agenda, salario, ativo)
VALUES
  ('Taisa Joelma',    'Cabeleireira',  'Cortes, coloração e hidratação', '#6366f1', 2800.00, true),
  ('Kayham Cristoffer','Barbeiro',      'Cortes masculinos e barba',      '#10b981', 2500.00, true),
  ('Camila Ferrari',  'Manicure',      'Manicure, pedicure e nail art',  '#ec4899', 2200.00, true),
  ('Marcos Tiago',    'Esteticista',   'Limpeza de pele e tratamentos',  '#f59e0b', 2600.00, true),
  ('Felipe Emiliano', 'Cabeleireiro',  'Escova progressiva e cortes',    '#8b5cf6', 2400.00, true)
ON CONFLICT DO NOTHING;

-- ================================================================
-- FIX: Allow NULL criado_por on clientes (already ON DELETE SET NULL)
-- The FK already exists; ensure INSERT policy works for all authenticated users
-- ================================================================

-- Drop and recreate clientes insert policy to allow criado_por = auth.uid() OR NULL
DROP POLICY IF EXISTS "c_ins" ON clientes;
CREATE POLICY "c_ins" ON clientes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (criado_por = auth.uid() OR criado_por IS NULL));

-- Drop and recreate clientes update policy
DROP POLICY IF EXISTS "c_upd" ON clientes;
CREATE POLICY "c_upd" ON clientes FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ================================================================
-- FIX: Equipe — allow authenticated users to SELECT (already ok)
-- Allow INSERT/UPDATE only for admins (already ok)
-- Ensure no anon access issues
-- ================================================================

-- ================================================================
-- FIX: Servicos — allow all authenticated users to SELECT
-- (already ok, just ensure the policy works)
-- ================================================================

-- ================================================================
-- FIX: Users UPDATE policy — allow user to update own profile
-- ================================================================
DROP POLICY IF EXISTS "u_upd" ON users;
CREATE POLICY "u_upd" ON users FOR UPDATE
  USING (auth.uid() = id OR is_admin())
  WITH CHECK (auth.uid() = id OR is_admin());

-- ================================================================
-- FIX: Financeiro INSERT — link criado_por = auth.uid() or NULL
-- ================================================================
DROP POLICY IF EXISTS "f_ins" ON financeiro;
CREATE POLICY "f_ins" ON financeiro FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (criado_por = auth.uid() OR criado_por IS NULL));

-- ================================================================
-- Additional index for performance
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_equipe_ativo ON equipe(ativo);
CREATE INDEX IF NOT EXISTS idx_servicos_categoria ON servicos(categoria, ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_criado_por ON clientes(criado_por);

