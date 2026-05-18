# 📅 CRM Agendamentos

Sistema completo de CRM para salões, barbearias, clínicas e prestadores de serviço. Construído 100% com **HTML5 + CSS3 + JavaScript (ES Modules nativos)** — sem frameworks — e **Supabase (PostgreSQL + Auth + RLS)** como backend.

> **Versão atual:** v4.1 · **Branch:** `main` · **Hospedagem:** GitHub Pages

---

## 📋 Índice

1. [Funcionalidades](#-funcionalidades)
2. [Regras de Negócio](#-regras-de-negócio)
3. [Roles e Permissões](#-roles-e-permissões)
4. [Tecnologias](#-tecnologias)
5. [Estrutura do Projeto](#-estrutura-do-projeto)
6. [Configuração e Deploy](#-configuração-e-deploy)
7. [Banco de Dados](#-banco-de-dados)
8. [Módulo a Módulo](#-módulo-a-módulo)
9. [Changelog](#-changelog)
10. [Sugestões Futuras](#-sugestões-futuras)
11. [Licença](#-licença)

---

## ✨ Funcionalidades

### 📊 Dashboard
- KPIs em tempo real: receita do dia, agendamentos do dia, novos clientes, ticket médio
- Gráfico anual de faturamento (barras)
- Distribuição de status do mês (donut)
- Próximos agendamentos do dia
- Top 5 clientes por valor gasto
- **Card "📍 Local & Contato"** — visível para todos os roles (clientes inclusive), com endereço, telefone, WhatsApp, Instagram, e-mail, horário de funcionamento e link Google Maps

### 📅 Agendamentos
- Lista paginada com filtros por status, profissional, data e busca livre
- Calendário visual mensal com heatmap de ocupação
- Timeline diária por profissional com slots coloridos
- Modal de criação completo:
  - Seleção de cliente (meu perfil / lista / texto livre para terceiros)
  - Múltiplos serviços em um mesmo agendamento
  - Múltiplos produtos opcionais
  - Seleção de profissional, horário e forma de pagamento
  - Validação de conflito de horário em tempo real
- **Fluxo de status com regras de negócio** (ver seção abaixo)
- Auto-refresh a cada 30 segundos
- **Banner de agendamentos vencidos** (admin/atendente): detecta agendamentos com horário passado ainda pendentes e permite marcação em lote como "Faltou"
- Geração automática de lançamento financeiro ao concluir um agendamento

### 👥 Clientes
- Cards v2 com avatar colorido determinístico (hash do nome → gradiente único)
- Badge de atividade: **Ativo** (≤30 dias), **Recente** (≤90 dias), **Inativo** (>90 dias)
- Badge **⭐ VIP** exclusivamente por tag `'vip'` (case-insensitive) — sem critérios automáticos
- Tags coloridas customizáveis
- Barra de estatísticas: visitas, gasto total, última visita
- Modal de perfil completo com histórico de agendamentos e **seção de Observações** formatada (`white-space: pre-wrap`)
- Busca em tempo real por nome, telefone ou e-mail

### 🧑‍💼 Equipe
- Cards de profissional com foto (via `img/`), cor personalizada na agenda e estatísticas
- Sistema de likes por usuário
- Modal de criação/edição completo

### 🏷️ Serviços & Produtos
- Catálogo com ícone emoji, cor, categoria, preço, duração e controle de estoque
- Ativação/desativação rápida sem excluir o registro

### 💰 Financeiro
- Controle de receitas e despesas com categorias
- **Seletor de período** (5 opções): Diária / Semanal / 1 Mês (por dia) / Mensal (por mês) / Anual
- Gráfico de barras dinâmico conforme período selecionado
- Gráfico donut de distribuição receita × despesa
- Totais: receita, despesa, lucro e pendente
- Filtros por tipo, categoria e mês
- Exportação CSV

### 💬 Chat
- Chat interno entre atendentes/admin e cada cliente
- Lista de conversas com badge de não lidos
- Atualização em tempo real via Supabase Realtime
- Histórico de mensagens paginado

### ⚙️ Configurações (admin.html)
- **Admin**: acesso total de leitura e escrita
- **Atendente**: acesso em **modo visualização** (read-only) — vê tudo, não edita nada
- **Cliente**: bloqueado, redirecionado ao dashboard
- Abas: Usuários · Sistema · Horários · Agendamentos · Relatórios
- Gestão de usuários: alterar role, excluir conta
- Configurações do estabelecimento: nome, telefone, endereço, Maps
- Horários de funcionamento por dia da semana
- Limpeza de agendamentos antigos por status e data
- Exportação CSV de Clientes, Agendamentos e Financeiro
- Relatório gerencial mensal: agendamentos, receitas, ticket médio, serviço mais popular

### 👤 Perfil
- Edição de nome, telefone, e-mail, CPF, endereço, Instagram, bio, foto
- Alteração de senha
- Sincronização automática nome/telefone → tabela `clientes` via `user_id`
- Atualização imediata do nome na sidebar após salvar

### 🔐 Autenticação
- Login, cadastro e recuperação de senha
- Timeout de sessão: 60 min de inatividade → aviso de 2 min → logout automático
- `requireAuth()` em todas as páginas protegidas
- Criação automática do registro de cliente ao primeiro login

---

## 📐 Regras de Negócio

### Fluxo de Status de Agendamentos

```
PENDENTE ──→ CONFIRMADO ──→ CONCLUÍDO*   ← status final
         ↘              ↘ FALTOU*       ← status final
          CANCELADO ←───  CANCELADO     ← status final
```

| De → Para | Regra |
|---|---|
| `pendente` → `confirmado` | Sempre permitido |
| `pendente` → `cancelado` | Sempre permitido |
| `confirmado` → `pendente` | Sempre permitido (desfazer confirmação) |
| `confirmado` → `concluído` | **Só após o horário do agendamento ter passado** |
| `confirmado` → `faltou` | **Só após o horário do agendamento ter passado** |
| `confirmado` → `cancelado` | Sempre permitido |
| `concluído` / `cancelado` / `faltou` | **Status final — não pode ser alterado** |

- Ao tentar marcar como Concluído/Faltou antes do horário, o sistema exibe um aviso com a data/hora exata do agendamento
- No select de status, as opções indisponíveis aparecem desabilitadas com texto explicativo
- A regra é verificada tanto no front-end (UX) quanto no handler do botão Salvar (segurança extra)

### Badge VIP de Clientes
- Determinado **exclusivamente** pela tag `'vip'` (case-insensitive) no array `tags` do cliente
- Critérios automáticos (gasto ≥ R$500 ou visitas ≥ 10) foram removidos para evitar badge persistente indesejado
- Para conceder VIP: adicionar a tag `vip` nas tags do cliente
- Para remover VIP: remover a tag `vip`

### Marcação Automática de Faltas
- Função `checkAndMarkFaltas()` em `supabase/database.js`
- Busca agendamentos com `data_hora` no passado e status `pendente` ou `confirmado`
- Marca todos como `faltou` em batch (`.in('id', ids)`)
- Atualiza as estatísticas de todos os clientes afetados
- Acionada pelo botão "Marcar como Faltou" no banner de vencidos (admin/atendente)

---

## 🔑 Roles e Permissões

| Funcionalidade | Cliente | Atendente | Admin |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ |
| Card Local & Contato | ✅ | ✅ | ✅ |
| Agendamentos (ver próprios) | ✅ | ✅ | ✅ |
| Agendamentos (ver todos) | ❌ | ✅ | ✅ |
| Criar agendamento | ✅ | ✅ | ✅ |
| Confirmar agendamento | ❌ | ✅ | ✅ |
| Concluir agendamento | ❌ | ✅* | ✅* |
| Marcar faltou | ❌ | ✅* | ✅* |
| Cancelar agendamento | ❌ | ✅ | ✅ |
| Banner vencidos + batch falta | ❌ | ✅ | ✅ |
| Clientes (CRUD) | ❌ | ✅ | ✅ |
| Serviços (CRUD) | ❌ | ✅ | ✅ |
| Financeiro | ❌ | ✅ | ✅ |
| Chat | ✅ | ✅ | ✅ |
| Equipe (ver) | ✅ | ✅ | ✅ |
| Equipe (CRUD) | ❌ | ✅ | ✅ |
| Configurações (ver) | ❌ | ✅ 👁️ | ✅ |
| Configurações (editar) | ❌ | ❌ | ✅ |
| Gerenciar usuários | ❌ | ❌ | ✅ |
| Alterar roles | ❌ | ❌ | ✅ |
| Exportar CSV | ❌ | ❌ | ✅ |
| Limpeza de dados | ❌ | ❌ | ✅ |

> **\*** Apenas após o horário do agendamento ter passado
> **👁️** Atendente vê Configurações em modo leitura — banner amarelo indica modo visualização

### Identificação de Admin
```js
// supabase/supabase-config.js
export const ADMIN_UID = 'SEU-USER-UUID'; // fallback hardcoded

// session-manager.js
export function isAdmin(user, profile) {
  return profile?.role === 'admin' || user?.id === ADMIN_UID;
}
```

---

## 🛠 Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| Frontend | HTML5 + CSS3 + Vanilla JS (ES Modules) | — |
| Auth / DB | Supabase (PostgreSQL + RLS + Realtime) | @2 |
| Gráficos | Chart.js | 4.4.0 |
| Ícones | Font Awesome | 6.5 |
| Fontes | Google Fonts (Inter) | — |
| Hospedagem | GitHub Pages | — |

**Sem build step** — os arquivos são servidos diretamente. Sem React, Vue, Angular ou bundler.

---

## 📁 Estrutura do Projeto

```
crm-agendamentos.io/
│
├── index.html               # Login, cadastro, recuperação de senha
├── dashboard.html           # Dashboard + KPIs + card Local & Contato
├── agendamentos.html        # Gestão de agendamentos (lista + calendário + timeline)
├── clientes.html            # Gestão de clientes (cards v2 + modal perfil)
├── servicos.html            # Catálogo de serviços e produtos
├── equipe.html              # Gestão da equipe de profissionais
├── financeiro.html          # Controle financeiro + gráficos multi-período
├── admin.html               # Configurações (admin total / atendente read-only)
├── perfil.html              # Perfil do usuário logado
├── change-password.html     # Redefinição de senha
│
├── css/
│   └── style.css            # Estilos globais + tema dark + componentes cc-v2
│
├── js/
│   └── sidebar.js           # Sidebar component v4.1 (roles, badges, toggle)
│
├── supabase/
│   ├── supabase-config.js   # SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_UID
│   ├── client.js            # createClient() + getUserProfile() com maybeSingle()
│   ├── database.js          # Todas as funções de acesso ao banco (~1000 linhas)
│   ├── session-manager.js   # requireAuth, renderUserInSidebar, timeout 60min
│   └── setup.sql            # Schema completo: tabelas, RLS, triggers, dados seed
│
├── assets/                  # Assets estáticos
└── img/                     # Fotos de equipe (referenciadas nos cards)
```

---

## 🚀 Configuração e Deploy

### 1. Criar projeto no Supabase

Acesse [supabase.com](https://supabase.com), crie um projeto gratuito e anote:
- **Project URL** — ex: `https://xxxxxx.supabase.co`
- **Anon Key** — Settings → API → `anon public`
- **Seu User UID** — Authentication → Users (após criar sua conta)

### 2. Criar o banco de dados

No **SQL Editor** do Supabase, execute todo o conteúdo de:
```
supabase/setup.sql
```
Isso cria automaticamente:
- Tabelas: `usuarios`, `clientes`, `equipe`, `servicos`, `agendamentos`, `agendamento_servicos`, `agendamento_produtos`, `lancamentos_financeiros`, `config_sistema`, `horarios`, `chat_mensagens`
- RLS policies para cada tabela
- Triggers para atualização automática de estatísticas
- Dados seed: horários padrão (seg–sáb 09h–18h)

### 3. Configurar credenciais

Edite `supabase/supabase-config.js`:
```js
export const SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'SUA-ANON-KEY';
export const ADMIN_UID         = 'SEU-USER-UUID'; // UID do usuário admin principal
```

### 4. Promover o primeiro admin

Após criar sua conta pelo `index.html`, execute no SQL Editor do Supabase:
```sql
UPDATE usuarios SET role = 'admin' WHERE email = 'seu@email.com';
```

Ou use o `ADMIN_UID` hardcoded em `supabase-config.js` — ele funciona como fallback mesmo sem o role no banco.

### 5. Editar dados do estabelecimento

Em `dashboard.html`, localize a função `renderEstabelecimento()` e edite o objeto `info`:
```js
const info = {
  nome:      'Nome do Seu Studio',
  endereco:  'Rua Real, 456 — Bairro',
  cidade:    'Cidade, UF',
  telefone:  '(XX) XXXXX-XXXX',
  whatsapp:  '55XXXXXXXXXXX',   // sem espaços, com DDI
  email:     'contato@seustudio.com.br',
  instagram: '@seustudio',
  horario:   'Seg–Sex: 09h–19h  |  Sáb: 09h–14h',
  maps:      'https://maps.google.com/?q=Seu+Endereço',
};
```

Esses dados também podem ser gerenciados em **Configurações → Sistema** (admin).

### 6. Hospedar no GitHub Pages

1. Faça push do projeto para um repositório GitHub
2. Vá em **Settings → Pages**
3. Selecione branch `main`, pasta `/` (root)
4. Acesse via `https://seuusuario.github.io/nome-do-repo/`

> **Atenção:** Configure a URL do seu GitHub Pages nas configurações de **CORS/Auth** do Supabase:
> Supabase → Authentication → URL Configuration → Site URL + Redirect URLs

---

## 🗄 Banco de Dados

### Principais Tabelas

```sql
usuarios           -- perfis de usuários (sincronizado com auth.users via trigger)
  id, email, nome, telefone, role, ativo, avatar_url, ...

clientes           -- clientes do estabelecimento
  id, nome, telefone, email, cpf, endereco, tags[], observacoes,
  user_id (FK → usuarios), visitas, gasto_total, ultima_visita

equipe             -- profissionais
  id, nome, email, telefone, especialidade, cor_agenda, foto, ativo

servicos           -- serviços e produtos
  id, nome, categoria, preco, duracao_min, icone, cor, estoque, ativo

agendamentos       -- agendamentos
  id, cliente_id, criado_por, data_hora, duracao_min, valor_total,
  forma_pagamento, status, observacoes, para_outro, nome_outro

agendamento_servicos  -- serviços de cada agendamento (N:N)
  id, agendamento_id, servico_id, equipe_id, duracao_min, preco

agendamento_produtos  -- produtos extras de cada agendamento
  id, agendamento_id, servico_id, quantidade, preco_unitario

lancamentos_financeiros  -- receitas e despesas
  id, tipo, descricao, valor, categoria, data, agendamento_id

config_sistema     -- configurações chave-valor
  chave, valor     (nome_negocio, telefone, endereco, maps_url, ...)

horarios           -- horários de funcionamento
  dia_semana (0=dom..6=sáb), aberto, hora_abertura, hora_fechamento

chat_mensagens     -- mensagens do chat interno
  id, cliente_id, user_id, mensagem, de_admin, lido, created_at
```

### RLS — Row Level Security

Cada tabela tem políticas específicas por role:
- **Clientes**: veem apenas seus próprios dados; staff vê todos
- **Agendamentos**: clientes veem os criados por eles (`criado_por = auth.uid()`); staff vê todos
- **Financeiro**: apenas staff (admin + atendente)
- **Config/Horários**: leitura pública; escrita apenas admin

---

## 📄 Módulo a Módulo

### `supabase/database.js` — Funções principais

| Categoria | Funções |
|---|---|
| **Formatação** | `formatCurrency`, `formatDate`, `formatDateTime`, `formatTime`, `formatPhone`, `formatCPF`, `applyPhoneMask`, `applyCPFMask` |
| **Auth** | `signUp`, `signIn`, `signOut`, `resetPassword`, `onAuthStateChange`, `ensureUserAndClient` |
| **Usuários** | `getUser`, `getAllUsers`, `updateUserProfile`, `setUserRole`, `deleteUserAndData` |
| **Config** | `getConfigSistema`, `setConfigSistema`, `getHorarios`, `updateHorario` |
| **Slots** | `getSlotsDisponiveis`, `getSlotsLivres` |
| **Clientes** | `getAllClientes`, `getCliente`, `searchClientes`, `createCliente`, `updateCliente`, `deleteCliente`, `atualizarEstatisticasCliente`, `getClienteByUserId` |
| **Equipe** | `getAllEquipe`, `createProfissional`, `updateProfissional`, `deleteProfissional`, `getLikesPorProfissional`, `toggleLike` |
| **Serviços** | `getAllServicos`, `getServicos`, `createServico`, `updateServico`, `deleteServico` |
| **Agendamentos** | `getAllAgendamentos`, `getAgendamento`, `getAgendamentosDoDia`, `getAgendamentosDoMes`, `getHeatmapDoMes`, `createAgendamento`, `updateAgendamento`, `deleteAgendamento` |
| **Faltas** | `checkAndMarkFaltas` — marca vencidos como "faltou" em batch + atualiza stats |
| **Financeiro** | `getLancamentos`, `createLancamento`, `deleteLancamento`, `getResumoFinanceiro`, `getResumoFinanceiroMensal`, `getResumoFinanceiroDiario`, `getResumoFinanceiroSemanal`, `getResumoFinanceiroMensalDias`, `getResumoFinanceiroAnual` |
| **Dashboard** | `getDashboardStats` |
| **Chat** | `getChatMessages`, `getChatClientes`, `sendChatMessage`, `markMessagesAsRead`, `getUnreadChatCount`, `subscribeChat`, `subscribeAgendamentos` |

### `js/sidebar.js` v4.1

- `getSidebarHTML(activePage)` — gera HTML da sidebar com links ativos
- `initSidebarToggle()` — controla abertura/fechamento mobile
- `showAdminItems()` — revela Gestão + Sistema para admin
- `showStaffItems()` — revela Gestão + Sistema para atendente (Configurações em read-only)
- `updatePendingBadge(count)` — atualiza badge de pendentes no link Agendamentos

### `supabase/session-manager.js` v4.0

- `requireAuth(adminOnly?)` — verifica autenticação, redireciona para login se não autenticado
- `renderUserInSidebar(profile)` — atualiza `#sidebarNome`, `#sidebarRole`, `#sidebarAvatar`
- `isAdmin(user, profile)` — `profile.role === 'admin' || user.id === ADMIN_UID`
- `isStaff(user, profile)` — admin + atendente
- Timeout automático: 60 min de inatividade → aviso de 2 min → `signOut()`

---

## 📝 Changelog

### v4.1 — Round 4 (commit `f303b8d`)
**Regras de negócio e controle de acesso:**
- `agendamentos.html`: Fluxo de status com regras rígidas — `concluído`/`faltou` só disponíveis após o horário do agendamento passar
- `agendamentos.html`: Atendente pode agora confirmar, concluir e marcar falta (antes só admin)
- `agendamentos.html`: Status finais (`concluído`, `cancelado`, `faltou`) exibem cadeado — sem opção de alterar
- `agendamentos.html`: Aviso amarelo inline com data/hora exata quando horário ainda não chegou
- `admin.html`: Atendente pode acessar a página em modo visualização (read-only)
- `admin.html`: Banner amarelo "Modo visualização" para atendentes
- `admin.html`: Todos os botões de edição desabilitados visualmente; handlers bloqueados com toast
- `admin.html`: Botão Gerenciar usuário substituído por ícone de cadeado para atendentes
- `js/sidebar.js`: Link "Configurações" movido de `adminOnly` → `staffOnly`; atendentes agora veem o item na sidebar

### v4.0 — Round 3 (commit `b669c40`)
**Novas funcionalidades:**
- `dashboard.html`: Card "📍 Local & Contato" visível para todos os roles
- `clientes.html`: Badge VIP baseado exclusivamente na tag `'vip'`
- `clientes.html`: Seção Observações no modal verPerfil com label e `white-space: pre-wrap`
- `supabase/database.js`: Função `checkAndMarkFaltas()` — batch update de agendamentos vencidos
- `agendamentos.html`: Banner vermelho de agendamentos vencidos com botões Marcar/Ignorar
- `agendamentos.html`: `checkVencidos()` — read-only query executada no load para admin/atendente

### v3.0 — Round 2 (commit `e65de13`)
**Correções de bugs:**
- `supabase/database.js`: `getResumoFinanceiroMensal()` — adicionado campo `label` (Jan..Dez) nos buckets
- `supabase/database.js`: `getResumoFinanceiroDiario()` — usa `created_at` para hora real (antes hardcoded em 00h)
- `financeiro.html`: `chart-wrap` com `height: 240px` explícito (Chart.js exige container com altura)
- `financeiro.html`: `renderCharts()` condicional para respeitar o período ativo selecionado
- `perfil.html`: Atualização direta de `#sidebarNome` + `renderUserInSidebar()` após salvar
- `js/sidebar.js`: "Administração" → "Configurações", ícone `fa-shield-alt` → `fa-cog`

### v2.0 — Round 1 (commit `43770cf`)
**Novas funcionalidades:**
- `financeiro.html`: Seletor de 5 períodos no gráfico de Evolução (Diária / Semanal / 1 Mês / Mensal / Anual)
- `financeiro.html`: Refatoração em `renderPie()`, `renderBarChart()`, `loadBarPeriod()`
- `financeiro.html`: 4 novas funções de DB para cada período
- `clientes.html`: Card v2 completo com avatar gradiente, badges de atividade, contatos, stats
- `css/style.css`: Bloco completo de estilos `.cc-v2` e sub-componentes

### v1.0 — Versão inicial
- Sistema base: login, dashboard, agendamentos, clientes, equipe, serviços, financeiro, admin, perfil, chat
- Supabase Auth + RLS + realtime
- Roles: cliente / atendente / admin

---

## 💡 Sugestões de Melhorias Futuras

1. **Notificação prévia** — Push/e-mail automático 1h antes do horário para cliente e atendente
2. **Reagendamento rápido** — Botão "Remarcar" que pré-preenche o modal com os dados do agendamento atual
3. **Histórico de status** — Tabela `agendamento_logs` registrando quem alterou o status e quando (auditoria)
4. **Pagamento parcial / sinal** — Campo `valor_pago` + `saldo_devedor` para controle de entrada e restante
5. **Confirmação por WhatsApp** — Botão que abre `wa.me/` com mensagem de confirmação pré-montada
6. **Faturamento por profissional** — Relatório de quanto cada atendente gerou no período
7. **Bloqueio de agenda** — Atendente pode marcar horário como "indisponível" sem criar agendamento real
8. **Foto de perfil / avatar upload** — Upload via Supabase Storage para clientes e equipe
9. **Recibo em PDF** — Exportação individual de agendamento concluído com dados e valor
10. **PWA / App mobile** — `manifest.json` + service worker para instalação no celular do atendente

---

## 🔒 Segurança

- **Row Level Security (RLS)** ativa em todas as tabelas do Supabase
- **JWT tokens** gerenciados automaticamente pelo Supabase Auth
- **Roles** verificados no frontend e aplicados nas políticas RLS do banco
- **Timeout de sessão** automático: 60 min inatividade → aviso → logout
- **Admin fallback** via `ADMIN_UID` hardcoded para acesso de emergência
- Inputs de texto sanitizados antes de inserção no banco
- Nenhuma credencial sensível exposta (apenas `anon key` pública do Supabase)

---

## 📄 Licença

MIT — Desenvolvido por [KayhamCristoffer](https://github.com/KayhamCristoffer)
