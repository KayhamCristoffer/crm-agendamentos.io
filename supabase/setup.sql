-- ================================================================
-- CRM AGENDAMENTOS - SETUP SQL v1
-- Sistema completo de CRM com Supabase (PostgreSQL)
-- Execute no: Supabase > SQL Editor > New Query > Run
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- DROP (ordem importa pelas FKs)
-- ================================================================
DROP TABLE IF EXISTS chat_messages     CASCADE;
DROP TABLE IF EXISTS financeiro        CASCADE;
DROP TABLE IF EXISTS agendamentos      CASCADE;
DROP TABLE IF EXISTS servicos          CASCADE;
DROP TABLE IF EXISTS equipe            CASCADE;
DROP TABLE IF EXISTS clientes          CASCADE;
DROP TABLE IF EXISTS users             CASCADE;

DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER  IF EXISTS users_updated_at     ON users;
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
    ativo        BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
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
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome         TEXT NOT NULL,
    cargo        TEXT,
    especialidade TEXT,
    telefone     TEXT,
    email        TEXT,
    avatar_url   TEXT,
    cor_agenda   TEXT DEFAULT '#6366f1',
    ativo        BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
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
    duracao_min   INT DEFAULT 60,
    cor           TEXT DEFAULT '#6366f1',
    icone         TEXT DEFAULT '✂️',
    ativo         BOOLEAN DEFAULT TRUE,
    estoque       INT DEFAULT -1,  -- -1 = ilimitado
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- AGENDAMENTOS
-- ================================================================
CREATE TABLE agendamentos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id UUID REFERENCES equipe(id) ON DELETE SET NULL,
    servico_id      UUID REFERENCES servicos(id) ON DELETE SET NULL,
    criado_por      UUID REFERENCES users(id) ON DELETE SET NULL,
    data_hora       TIMESTAMPTZ NOT NULL,
    duracao_min     INT DEFAULT 60,
    status          TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','concluido','cancelado','faltou')),
    valor           NUMERIC(10,2) DEFAULT 0,
    desconto        NUMERIC(10,2) DEFAULT 0,
    forma_pagamento TEXT DEFAULT 'dinheiro' CHECK (forma_pagamento IN ('dinheiro','pix','cartao_debito','cartao_credito','outros')),
    observacoes     TEXT,
    notas_internas  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- FINANCEIRO (lançamentos extras)
-- ================================================================
CREATE TABLE financeiro (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo         TEXT DEFAULT 'receita' CHECK (tipo IN ('receita','despesa')),
    descricao    TEXT NOT NULL,
    valor        NUMERIC(10,2) DEFAULT 0,
    categoria    TEXT,
    data         DATE DEFAULT CURRENT_DATE,
    agendamento_id UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
    criado_por   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- CHAT MESSAGES
-- ================================================================
CREATE TABLE chat_messages (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id   UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    de_cliente   BOOLEAN DEFAULT FALSE,
    mensagem     TEXT NOT NULL,
    lida         BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- FUNÇÕES
-- ================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.users (id, email, nome, role)
    VALUES (NEW.id, NEW.email, split_part(NEW.email,'@',1), 'user')
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
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe          ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages   ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "u_sel" ON users FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "u_ins" ON users FOR INSERT  WITH CHECK (auth.uid() = id);
CREATE POLICY "u_upd" ON users FOR UPDATE  USING (auth.uid() = id OR is_admin());
CREATE POLICY "u_del" ON users FOR DELETE  USING (is_admin());

-- CLIENTES
CREATE POLICY "c_sel" ON clientes FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "c_ins" ON clientes FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "c_upd" ON clientes FOR UPDATE  USING (auth.uid() IS NOT NULL);
CREATE POLICY "c_del" ON clientes FOR DELETE  USING (is_admin());

-- EQUIPE
CREATE POLICY "e_sel" ON equipe FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "e_ins" ON equipe FOR INSERT  WITH CHECK (is_admin());
CREATE POLICY "e_upd" ON equipe FOR UPDATE  USING (is_admin());
CREATE POLICY "e_del" ON equipe FOR DELETE  USING (is_admin());

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
CREATE INDEX idx_agendamentos_prof    ON agendamentos(profissional_id);
CREATE INDEX idx_financeiro_data      ON financeiro(data);
CREATE INDEX idx_financeiro_tipo      ON financeiro(tipo);
CREATE INDEX idx_chat_cliente         ON chat_messages(cliente_id);
CREATE INDEX idx_chat_lida            ON chat_messages(lida);

-- ================================================================
-- DADOS INICIAIS
-- ================================================================

-- Serviços de exemplo
INSERT INTO servicos (nome, descricao, categoria, preco, duracao_min, cor, icone, ativo)
VALUES
  ('Corte Masculino',    'Corte completo com acabamento',       'servico', 45.00,  30,  '#6366f1', '✂️', true),
  ('Corte Feminino',     'Corte + escova',                       'servico', 90.00,  60,  '#ec4899', '✂️', true),
  ('Coloração',          'Coloração completa com tintura',       'servico', 180.00, 120, '#f59e0b', '🎨', true),
  ('Manicure',           'Cutícula + esmaltação',                'servico', 35.00,  45,  '#f43f5e', '💅', true),
  ('Pedicure',           'Cutícula + esmaltação nos pés',        'servico', 40.00,  45,  '#ef4444', '💅', true),
  ('Hidratação',         'Hidratação capilar intensiva',         'servico', 80.00,  60,  '#10b981', '💆', true),
  ('Escova Progressiva', 'Alisamento com progressiva',           'servico', 250.00, 180, '#8b5cf6', '💇', true),
  ('Limpeza de Pele',    'Limpeza facial completa',              'servico', 120.00, 90,  '#06b6d4', '🧖', true)
ON CONFLICT DO NOTHING;

-- Equipe de exemplo
INSERT INTO equipe (nome, cargo, especialidade, cor_agenda, ativo)
VALUES
  ('Ana Silva',    'Cabeleireira',   'Cortes e coloração',  '#6366f1', true),
  ('Carlos Lima',  'Barbeiro',       'Cortes masculinos',   '#10b981', true),
  ('Fernanda Paz', 'Esteticista',    'Pele e unhas',        '#ec4899', true),
  ('João Melo',    'Cabeleireiro',   'Escova e tratamentos','#f59e0b', true)
ON CONFLICT DO NOTHING;
