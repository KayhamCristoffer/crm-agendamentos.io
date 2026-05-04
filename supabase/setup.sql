-- ================================================================
-- CRM AGENDAMENTOS — SETUP SQL v3
-- DROP GERAL + RECRIAÇÃO COMPLETA com stored procedures
-- Execute no: Supabase > SQL Editor > New Query > Run
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. DROP COMPLETO (ordem respeita FKs)
-- ================================================================
DROP TABLE IF EXISTS agendamento_produtos    CASCADE;
DROP TABLE IF EXISTS agendamento_servicos    CASCADE;
DROP TABLE IF EXISTS chat_messages           CASCADE;
DROP TABLE IF EXISTS financeiro              CASCADE;
DROP TABLE IF EXISTS agendamentos            CASCADE;
DROP TABLE IF EXISTS servicos                CASCADE;
DROP TABLE IF EXISTS equipe_likes            CASCADE;
DROP TABLE IF EXISTS equipe                  CASCADE;
DROP TABLE IF EXISTS clientes                CASCADE;
DROP TABLE IF EXISTS horarios_funcionamento  CASCADE;
DROP TABLE IF EXISTS config_sistema          CASCADE;
DROP TABLE IF EXISTS users                   CASCADE;

DROP TRIGGER  IF EXISTS on_auth_user_created    ON auth.users;
DROP TRIGGER  IF EXISTS users_updated_at        ON users;
DROP TRIGGER  IF EXISTS clientes_updated_at     ON clientes;
DROP TRIGGER  IF EXISTS agendamentos_updated_at ON agendamentos;

DROP FUNCTION IF EXISTS is_admin()                  CASCADE;
DROP FUNCTION IF EXISTS handle_new_user()           CASCADE;
DROP FUNCTION IF EXISTS ensure_user_and_client(UUID,TEXT,TEXT,TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_agendamento_completo(JSONB) CASCADE;
DROP FUNCTION IF EXISTS get_slots_disponiveis(DATE,UUID,INT) CASCADE;
DROP FUNCTION IF EXISTS update_cliente_stats(UUID)  CASCADE;
DROP FUNCTION IF EXISTS update_updated_at()         CASCADE;
DROP FUNCTION IF EXISTS finalizar_agendamento(UUID,TEXT,NUMERIC,TEXT) CASCADE;

-- ================================================================
-- 2. TABELAS
-- ================================================================

-- USERS
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

-- CONFIG SISTEMA
CREATE TABLE config_sistema (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chave      TEXT UNIQUE NOT NULL,
    valor      TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HORARIOS DE FUNCIONAMENTO
CREATE TABLE horarios_funcionamento (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    dia_semana      INT     NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    aberto          BOOLEAN DEFAULT TRUE,
    hora_abertura   TIME    DEFAULT '09:00',
    hora_fechamento TIME    DEFAULT '18:00',
    UNIQUE(dia_semana)
);

-- CLIENTES  (user pode ser cliente — ligado por email)
CREATE TABLE clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,  -- vínculo ao user se existir
    nome            TEXT NOT NULL,
    email           TEXT,
    telefone        TEXT,
    cpf             TEXT,
    data_nascimento DATE,
    endereco        TEXT,
    cidade          TEXT,
    observacoes     TEXT,
    tags            TEXT[],
    total_visitas   INT          DEFAULT 0,
    total_gasto     NUMERIC(10,2) DEFAULT 0,
    ultima_visita   TIMESTAMPTZ,
    ativo           BOOLEAN      DEFAULT TRUE,
    criado_por      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- EQUIPE
CREATE TABLE equipe (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome          TEXT NOT NULL,
    cargo         TEXT,
    especialidade TEXT,
    telefone      TEXT,
    email         TEXT,
    avatar_url    TEXT,
    cor_agenda    TEXT    DEFAULT '#6366f1',
    salario       NUMERIC(10,2) DEFAULT 0,
    ativo         BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- EQUIPE LIKES
CREATE TABLE equipe_likes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profissional_id UUID NOT NULL REFERENCES equipe(id)  ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profissional_id, user_id)
);

-- SERVICOS / PRODUTOS
CREATE TABLE servicos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome        TEXT NOT NULL,
    descricao   TEXT,
    categoria   TEXT    DEFAULT 'servico' CHECK (categoria IN ('servico','produto')),
    preco       NUMERIC(10,2) DEFAULT 0,
    duracao_min INT     DEFAULT 60,
    cor         TEXT    DEFAULT '#6366f1',
    icone       TEXT    DEFAULT '✂️',
    ativo       BOOLEAN DEFAULT TRUE,
    estoque     INT     DEFAULT -1,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- AGENDAMENTOS
CREATE TABLE agendamentos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    criado_por      UUID REFERENCES users(id) ON DELETE SET NULL,
    data_hora       TIMESTAMPTZ NOT NULL,
    duracao_min     INT          DEFAULT 60,
    status          TEXT         DEFAULT 'pendente'
                    CHECK (status IN ('pendente','confirmado','concluido','cancelado','faltou')),
    valor_total     NUMERIC(10,2) DEFAULT 0,
    desconto        NUMERIC(10,2) DEFAULT 0,
    forma_pagamento TEXT DEFAULT 'dinheiro'
                    CHECK (forma_pagamento IN ('dinheiro','pix','cartao_debito','cartao_credito','outros')),
    observacoes     TEXT,
    notas_internas  TEXT,
    para_outro      BOOLEAN DEFAULT FALSE,
    nome_outro      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AGENDAMENTO_SERVICOS
CREATE TABLE agendamento_servicos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agendamento_id  UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
    servico_id      UUID REFERENCES servicos(id) ON DELETE SET NULL,
    profissional_id UUID REFERENCES equipe(id)   ON DELETE SET NULL,
    preco           NUMERIC(10,2) DEFAULT 0,
    duracao_min     INT           DEFAULT 60,
    hora_inicio     TIMESTAMPTZ,
    hora_fim        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AGENDAMENTO_PRODUTOS
CREATE TABLE agendamento_produtos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agendamento_id  UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
    servico_id      UUID REFERENCES servicos(id) ON DELETE SET NULL,
    quantidade      INT           DEFAULT 1,
    preco_unitario  NUMERIC(10,2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- FINANCEIRO
CREATE TABLE financeiro (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo           TEXT DEFAULT 'receita' CHECK (tipo IN ('receita','despesa')),
    descricao      TEXT NOT NULL,
    valor          NUMERIC(10,2) DEFAULT 0,
    categoria      TEXT,
    data           DATE DEFAULT CURRENT_DATE,
    agendamento_id UUID REFERENCES agendamentos(id) ON DELETE SET NULL,
    criado_por     UUID REFERENCES users(id)        ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- CHAT MESSAGES
CREATE TABLE chat_messages (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    de_admin   BOOLEAN DEFAULT FALSE,   -- TRUE = enviado pelo admin/sistema
    mensagem   TEXT NOT NULL,
    lida       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. FUNÇÕES / STORED PROCEDURES
-- ================================================================

-- ── is_admin(): verifica se o usuário é admin ─────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ) OR auth.uid() = '37a7c0ff-f22b-43fd-be0b-4164a0ad26e7'::uuid;
$$;

-- ── update_updated_at(): trigger genérico de timestamp ────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ── handle_new_user(): cria perfil user após signup ───────────
-- Também cria automaticamente um registro de cliente vinculado
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_nome TEXT;
    v_role TEXT;
    v_cliente_id UUID;
BEGIN
    v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1));
    v_role := CASE
        WHEN NEW.id = '37a7c0ff-f22b-43fd-be0b-4164a0ad26e7'::uuid THEN 'admin'
        ELSE 'user'
    END;

    -- Cria / atualiza perfil de usuário
    INSERT INTO public.users (id, email, nome, role)
    VALUES (NEW.id, NEW.email, v_nome, v_role)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nome  = COALESCE(EXCLUDED.nome, users.nome);

    -- Cria / atualiza registro de cliente vinculado ao user
    INSERT INTO public.clientes (user_id, nome, email, criado_por, ativo)
    VALUES (NEW.id, v_nome, NEW.email, NEW.id, TRUE)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

-- ── ensure_user_and_client(): garante user + cliente no login ─
-- Chamado pelo frontend em cada autenticação
CREATE OR REPLACE FUNCTION ensure_user_and_client(
    p_user_id   UUID,
    p_email     TEXT,
    p_nome      TEXT DEFAULT NULL,
    p_telefone  TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_nome       TEXT;
    v_role       TEXT;
    v_user       users%ROWTYPE;
    v_cliente_id UUID;
BEGIN
    v_nome := COALESCE(p_nome, split_part(p_email,'@',1));

    -- UPSERT users
    INSERT INTO public.users (id, email, nome, telefone, role)
    VALUES (
        p_user_id, p_email, v_nome, p_telefone,
        CASE WHEN p_user_id = '37a7c0ff-f22b-43fd-be0b-4164a0ad26e7'::uuid THEN 'admin' ELSE 'user' END
    )
    ON CONFLICT (id) DO UPDATE SET
        email     = EXCLUDED.email,
        telefone  = COALESCE(EXCLUDED.telefone, users.telefone),
        nome      = COALESCE(EXCLUDED.nome, users.nome),
        updated_at = NOW()
    RETURNING * INTO v_user;

    -- Se user não foi retornado (ON CONFLICT), busca o existente
    IF v_user.id IS NULL THEN
        SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
    END IF;

    -- UPSERT clientes: vincula por user_id ou email
    SELECT id INTO v_cliente_id FROM public.clientes
    WHERE user_id = p_user_id OR (email = p_email AND email IS NOT NULL)
    LIMIT 1;

    IF v_cliente_id IS NULL THEN
        INSERT INTO public.clientes (user_id, nome, email, telefone, criado_por, ativo)
        VALUES (p_user_id, v_nome, p_email, p_telefone, p_user_id, TRUE)
        RETURNING id INTO v_cliente_id;
    ELSE
        -- Garante vínculo user_id
        UPDATE public.clientes SET
            user_id    = COALESCE(user_id, p_user_id),
            telefone   = COALESCE(telefone, p_telefone),
            updated_at = NOW()
        WHERE id = v_cliente_id;
    END IF;

    RETURN json_build_object(
        'user',       row_to_json(v_user),
        'cliente_id', v_cliente_id
    );
END;
$$;

-- ── update_cliente_stats(): recalcula visitas/gasto do cliente ─
CREATE OR REPLACE FUNCTION update_cliente_stats(p_cliente_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_visitas  INT;
    v_gasto    NUMERIC;
    v_ultima   TIMESTAMPTZ;
BEGIN
    SELECT
        COUNT(*)        FILTER (WHERE status = 'concluido'),
        COALESCE(SUM(valor_total) FILTER (WHERE status = 'concluido'), 0),
        MAX(data_hora)  FILTER (WHERE status = 'concluido')
    INTO v_visitas, v_gasto, v_ultima
    FROM agendamentos WHERE cliente_id = p_cliente_id;

    UPDATE clientes SET
        total_visitas = COALESCE(v_visitas, 0),
        total_gasto   = COALESCE(v_gasto,   0),
        ultima_visita = v_ultima,
        updated_at    = NOW()
    WHERE id = p_cliente_id;
END;
$$;

-- ── finalizar_agendamento(): conclui agendamento + lança no financeiro ─
CREATE OR REPLACE FUNCTION finalizar_agendamento(
    p_ag_id         UUID,
    p_status        TEXT    DEFAULT 'concluido',
    p_desconto      NUMERIC DEFAULT 0,
    p_forma_pag     TEXT    DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_ag        agendamentos%ROWTYPE;
    v_fin_id    UUID;
BEGIN
    UPDATE agendamentos SET
        status          = p_status,
        desconto        = COALESCE(p_desconto, desconto),
        forma_pagamento = COALESCE(p_forma_pag, forma_pagamento),
        updated_at      = NOW()
    WHERE id = p_ag_id
    RETURNING * INTO v_ag;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agendamento % não encontrado', p_ag_id;
    END IF;

    -- Recalcula stats do cliente
    PERFORM update_cliente_stats(v_ag.cliente_id);

    -- Lança no financeiro se concluído
    IF p_status = 'concluido' THEN
        INSERT INTO financeiro (tipo, descricao, valor, categoria, data, agendamento_id, criado_por)
        VALUES (
            'receita',
            'Agendamento concluído',
            GREATEST(v_ag.valor_total - COALESCE(p_desconto, 0), 0),
            'servico',
            CURRENT_DATE,
            p_ag_id,
            auth.uid()
        )
        RETURNING id INTO v_fin_id;
    END IF;

    RETURN json_build_object(
        'agendamento_id', v_ag.id,
        'status',         v_ag.status,
        'financeiro_id',  v_fin_id
    );
END;
$$;

-- ── get_slots_disponiveis(): retorna slots livres/ocupados ─────
CREATE OR REPLACE FUNCTION get_slots_disponiveis(
    p_date          DATE,
    p_prof_id       UUID    DEFAULT NULL,
    p_duracao_min   INT     DEFAULT 60
)
RETURNS TABLE (
    hora       TEXT,
    iso        TIMESTAMPTZ,
    livre      BOOLEAN,
    prof_ids   UUID[]
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_dow       INT;
    v_horario   horarios_funcionamento%ROWTYPE;
    v_inicio    TIMESTAMPTZ;
    v_fim       TIMESTAMPTZ;
    v_cur       TIMESTAMPTZ;
    v_slot_fim  TIMESTAMPTZ;
BEGIN
    v_dow := EXTRACT(DOW FROM p_date::TIMESTAMPTZ);

    SELECT * INTO v_horario
    FROM horarios_funcionamento WHERE dia_semana = v_dow;

    IF NOT FOUND OR NOT v_horario.aberto THEN
        RETURN;
    END IF;

    v_inicio := (p_date::TEXT || ' ' || v_horario.hora_abertura::TEXT)::TIMESTAMPTZ;
    v_fim    := (p_date::TEXT || ' ' || v_horario.hora_fechamento::TEXT)::TIMESTAMPTZ;
    v_cur    := v_inicio;

    WHILE v_cur + (p_duracao_min || ' minutes')::INTERVAL <= v_fim LOOP
        v_slot_fim := v_cur + (p_duracao_min || ' minutes')::INTERVAL;

        SELECT
            v_cur::TEXT::VARCHAR(5),
            v_cur,
            NOT EXISTS (
                SELECT 1 FROM agendamento_servicos ags
                JOIN agendamentos ag ON ag.id = ags.agendamento_id
                WHERE ag.status IN ('pendente','confirmado')
                  AND (p_prof_id IS NULL OR ags.profissional_id = p_prof_id)
                  AND ags.hora_inicio < v_slot_fim
                  AND ags.hora_fim    > v_cur
            ),
            ARRAY(
                SELECT DISTINCT ags.profissional_id
                FROM agendamento_servicos ags
                JOIN agendamentos ag ON ag.id = ags.agendamento_id
                WHERE ag.status IN ('pendente','confirmado')
                  AND (p_prof_id IS NULL OR ags.profissional_id = p_prof_id)
                  AND ags.hora_inicio < v_slot_fim
                  AND ags.hora_fim    > v_cur
                  AND ags.profissional_id IS NOT NULL
            )
        INTO hora, iso, livre, prof_ids;

        RETURN NEXT;
        v_cur := v_cur + INTERVAL '30 minutes';
    END LOOP;
END;
$$;

-- ── check_schedule_conflict(): helper para createAgendamento ──
CREATE OR REPLACE FUNCTION check_schedule_conflict(
    p_prof_id    UUID,
    p_hora_ini   TIMESTAMPTZ,
    p_hora_fim   TIMESTAMPTZ
)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_nome TEXT;
BEGIN
    SELECT e.nome INTO v_nome
    FROM agendamento_servicos ags
    JOIN agendamentos ag ON ag.id = ags.agendamento_id
    JOIN equipe e        ON e.id  = ags.profissional_id
    WHERE ags.profissional_id = p_prof_id
      AND ag.status IN ('pendente','confirmado')
      AND ags.hora_inicio < p_hora_fim
      AND ags.hora_fim    > p_hora_ini
    LIMIT 1;

    RETURN v_nome;  -- NULL = sem conflito
END;
$$;

-- ================================================================
-- 4. TRIGGERS
-- ================================================================
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clientes_updated_at
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agendamentos_updated_at
    BEFORE UPDATE ON agendamentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- 5. ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_sistema         ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_funcionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_likes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamento_servicos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamento_produtos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages          ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "u_sel" ON users FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "u_ins" ON users FOR INSERT  WITH CHECK (auth.uid() = id OR is_admin());
CREATE POLICY "u_upd" ON users FOR UPDATE
    USING (auth.uid() = id OR is_admin())
    WITH CHECK (auth.uid() = id OR is_admin());
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

-- CLIENTES: qualquer autenticado lê/insere/atualiza; só admin deleta
CREATE POLICY "c_sel" ON clientes FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "c_ins" ON clientes FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "c_upd" ON clientes FOR UPDATE  USING (auth.uid() IS NOT NULL);
CREATE POLICY "c_del" ON clientes FOR DELETE  USING (is_admin());

-- EQUIPE
CREATE POLICY "e_sel" ON equipe FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "e_ins" ON equipe FOR INSERT  WITH CHECK (is_admin());
CREATE POLICY "e_upd" ON equipe FOR UPDATE  USING (is_admin());
CREATE POLICY "e_del" ON equipe FOR DELETE  USING (is_admin());

-- EQUIPE LIKES
CREATE POLICY "el_sel" ON equipe_likes FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "el_ins" ON equipe_likes FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "el_del" ON equipe_likes FOR DELETE  USING (auth.uid() = user_id OR is_admin());

-- SERVICOS
CREATE POLICY "s_sel" ON servicos FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "s_ins" ON servicos FOR INSERT  WITH CHECK (is_admin());
CREATE POLICY "s_upd" ON servicos FOR UPDATE  USING (is_admin());
CREATE POLICY "s_del" ON servicos FOR DELETE  USING (is_admin());

-- AGENDAMENTOS: todos authenticated podem criar/ler/editar; só admin deleta
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

-- CHAT: qualquer autenticado lê/envia; admin pode apagar
CREATE POLICY "ch_sel" ON chat_messages FOR SELECT  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ch_ins" ON chat_messages FOR INSERT  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ch_upd" ON chat_messages FOR UPDATE  USING (auth.uid() IS NOT NULL);
CREATE POLICY "ch_del" ON chat_messages FOR DELETE  USING (is_admin());

-- ================================================================
-- 6. ÍNDICES
-- ================================================================
CREATE INDEX idx_users_role            ON users(role);
CREATE INDEX idx_users_email           ON users(email);
CREATE INDEX idx_clientes_nome         ON clientes(nome);
CREATE INDEX idx_clientes_email        ON clientes(email);
CREATE INDEX idx_clientes_user_id      ON clientes(user_id);
CREATE INDEX idx_clientes_criado_por   ON clientes(criado_por);
CREATE INDEX idx_equipe_ativo          ON equipe(ativo);
CREATE INDEX idx_servicos_categoria    ON servicos(categoria, ativo);
CREATE INDEX idx_ag_data               ON agendamentos(data_hora);
CREATE INDEX idx_ag_status             ON agendamentos(status);
CREATE INDEX idx_ag_cliente            ON agendamentos(cliente_id);
CREATE INDEX idx_ag_criado_por         ON agendamentos(criado_por);
CREATE INDEX idx_ag_svc_ag             ON agendamento_servicos(agendamento_id);
CREATE INDEX idx_ag_svc_prof           ON agendamento_servicos(profissional_id);
CREATE INDEX idx_ag_svc_horas          ON agendamento_servicos(hora_inicio, hora_fim);
CREATE INDEX idx_ag_prod_ag            ON agendamento_produtos(agendamento_id);
CREATE INDEX idx_fin_data              ON financeiro(data);
CREATE INDEX idx_fin_tipo              ON financeiro(tipo);
CREATE INDEX idx_chat_cliente          ON chat_messages(cliente_id);
CREATE INDEX idx_chat_created          ON chat_messages(created_at DESC);
CREATE INDEX idx_likes_prof            ON equipe_likes(profissional_id);
CREATE INDEX idx_likes_user            ON equipe_likes(user_id);

-- ================================================================
-- 7. DADOS INICIAIS
-- ================================================================

-- Horários
INSERT INTO horarios_funcionamento (dia_semana, aberto, hora_abertura, hora_fechamento) VALUES
  (0, FALSE, '09:00', '18:00'),
  (1, TRUE,  '09:00', '19:00'),
  (2, TRUE,  '09:00', '19:00'),
  (3, TRUE,  '09:00', '19:00'),
  (4, TRUE,  '09:00', '19:00'),
  (5, TRUE,  '09:00', '19:00'),
  (6, TRUE,  '09:00', '17:00')
ON CONFLICT (dia_semana) DO NOTHING;

-- Config
INSERT INTO config_sistema (chave, valor) VALUES
  ('nome_negocio', 'CRM Agendamentos'),
  ('telefone',     '(11) 99454-6931'),
  ('endereco',     'Av das Nações, São André, 454'),
  ('maps_url',     'https://maps.google.com/?q=Av+das+Nações,+São+André,+454'),
  ('chat_enabled', 'true')
ON CONFLICT (chave) DO NOTHING;

-- Serviços
INSERT INTO servicos (nome, descricao, categoria, preco, duracao_min, cor, icone, ativo) VALUES
  ('Corte Masculino',    'Corte completo com acabamento',   'servico', 45.00,  30,  '#6366f1', '✂️', true),
  ('Corte Feminino',     'Corte + escova',                  'servico', 90.00,  60,  '#ec4899', '✂️', true),
  ('Coloração',          'Coloração completa com tintura',  'servico', 180.00, 120, '#f59e0b', '🎨', true),
  ('Manicure',           'Cutícula + esmaltação',           'servico', 35.00,  45,  '#f43f5e', '💅', true),
  ('Pedicure',           'Cutícula + esmaltação nos pés',   'servico', 40.00,  45,  '#ef4444', '💅', true),
  ('Hidratação',         'Hidratação capilar intensiva',    'servico', 80.00,  60,  '#10b981', '💆', true),
  ('Escova Progressiva', 'Alisamento com progressiva',      'servico', 250.00, 180, '#8b5cf6', '💇', true),
  ('Limpeza de Pele',    'Limpeza facial completa',         'servico', 120.00, 90,  '#06b6d4', '🧖', true),
  ('Shampoo',            'Shampoo profissional 300ml',      'produto', 28.90,  0,   '#6366f1', '🧴', true),
  ('Condicionador',      'Condicionador hidratante 300ml',  'produto', 32.90,  0,   '#8b5cf6', '🧴', true),
  ('Esmalte Top',        'Esmalte de longa duração',        'produto', 15.00,  0,   '#ec4899', '💅', true)
ON CONFLICT DO NOTHING;

-- Equipe
INSERT INTO equipe (nome, cargo, especialidade, cor_agenda, salario, ativo) VALUES
  ('Taisa Joelma',     'Cabeleireira',  'Cortes, coloração e hidratação', '#6366f1', 2800.00, true),
  ('Kayham Cristoffer','Barbeiro',       'Cortes masculinos e barba',      '#10b981', 2500.00, true),
  ('Camila Ferrari',   'Manicure',       'Manicure, pedicure e nail art',  '#ec4899', 2200.00, true),
  ('Marcos Tiago',     'Esteticista',    'Limpeza de pele e tratamentos',  '#f59e0b', 2600.00, true),
  ('Felipe Emiliano',  'Cabeleireiro',   'Escova progressiva e cortes',    '#8b5cf6', 2400.00, true)
ON CONFLICT DO NOTHING;

-- ================================================================
-- PRONTO — execute este script no SQL Editor do Supabase
-- ================================================================
SELECT 'Setup v3 aplicado com sucesso!' AS resultado;
