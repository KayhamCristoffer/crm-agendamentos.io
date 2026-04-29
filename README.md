# 📅 CRM Agendamentos

Sistema completo de CRM para agendamentos, construído com **HTML5 + CSS3 + JavaScript (ES Modules)** e **Supabase (PostgreSQL)** como backend.

## ✨ Funcionalidades

### 👥 Clientes
- Cadastro completo com nome, telefone, e-mail, CPF, endereço, tags, observações
- Visualização em cards ou tabela
- Perfil detalhado com histórico de agendamentos
- Estatísticas automáticas: total de visitas, gasto total, última visita

### 📅 Agendamentos
- Lista com filtros por status, profissional, data
- Calendário visual mensal
- Modal de criação/edição com validação de conflito de horário
- Status: Pendente, Confirmado, Concluído, Cancelado, Faltou
- Geração automática de lançamento financeiro ao concluir

### 🧑‍💼 Equipe
- Gestão de profissionais com cor personalizada na agenda
- Estatísticas por profissional (agendamentos e receita)

### 🏷️ Serviços & Produtos
- Catálogo com ícone emoji, cor, preço, duração e estoque
- Ativação/desativação rápida

### 💰 Financeiro
- Controle de receitas e despesas
- Gráfico de evolução mensal (linha) e distribuição (donut)
- Filtros por tipo e categoria
- Exportação CSV

### 📊 Dashboard
- KPIs em tempo real
- Próximos agendamentos
- Top clientes
- Gráfico anual de faturamento
- Distribuição de status do mês

### 👑 Administração (somente admin)
- Gerenciamento de usuários e permissões
- Limpeza de agendamentos antigos
- Exportação de dados (Clientes, Agendamentos, Financeiro)
- Relatórios gerenciais
- Informações do sistema

### 🔐 Autenticação
- Login / Cadastro / Recuperação de senha
- Timeout de sessão (60 min) com aviso
- Perfil editável
- Troca de senha

---

## 🛠 Tecnologias

| Camada       | Tecnologia                |
|-------------|--------------------------|
| Frontend    | HTML5, CSS3, Vanilla JS   |
| Auth/DB     | Supabase (PostgreSQL)     |
| Gráficos    | Chart.js 4                |
| Ícones      | Font Awesome 6.5          |
| Fontes      | Google Fonts (Inter)      |
| Hospedagem  | GitHub Pages              |

---

## 🚀 Configuração

### 1. Criar projeto no Supabase

Acesse [supabase.com](https://supabase.com), crie um projeto e copie:
- **Project URL** (ex: `https://xxxxxx.supabase.co`)
- **Anon Key** (Settings → API → anon public)
- **Seu User UID** (Authentication → Users)

### 2. Criar o banco de dados

No **SQL Editor** do Supabase, execute o conteúdo do arquivo:
```
supabase/setup.sql
```
Isso cria todas as tabelas, triggers, RLS policies e dados iniciais.

### 3. Configurar credenciais

Edite o arquivo `supabase/supabase-config.js`:
```js
export const SUPABASE_URL     = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'SUA-ANON-KEY';
export const ADMIN_UID         = 'SEU-USER-UUID';
```

### 4. Dar role admin ao primeiro usuário

Após criar sua conta no sistema, execute no SQL Editor:
```sql
UPDATE users SET role = 'admin' WHERE email = 'seu@email.com';
```

### 5. Hospedar no GitHub Pages

- Vá em **Settings → Pages**
- Selecione branch `main`, pasta `/` (root)
- Acesse via `https://seuusuario.github.io/nome-do-repo/`

---

## 📁 Estrutura do Projeto

```
crm-agendamentos.io/
├── index.html              # Página de login
├── dashboard.html          # Dashboard principal
├── agendamentos.html       # Gestão de agendamentos
├── clientes.html           # Gestão de clientes
├── servicos.html           # Catálogo de serviços
├── equipe.html             # Gestão da equipe
├── financeiro.html         # Controle financeiro
├── admin.html              # Painel administrativo
├── perfil.html             # Perfil do usuário
├── change-password.html    # Redefinição de senha
├── css/
│   └── style.css           # Estilos globais
├── js/
│   └── sidebar.js          # Componente sidebar
└── supabase/
    ├── supabase-config.js  # Credenciais do Supabase
    ├── client.js           # Cliente Supabase
    ├── database.js         # Todas as funções de banco
    ├── session-manager.js  # Gestão de sessão
    └── setup.sql           # Schema completo do banco
```

---

## 🔒 Segurança

- **Row Level Security (RLS)** em todas as tabelas
- **JWT tokens** gerenciados pelo Supabase Auth
- **Roles**: `user`, `atendente`, `admin`
- Timeout automático de sessão por inatividade
- Apenas admins podem gerenciar equipe, serviços e outros usuários

---

## 📄 Licença

MIT — Desenvolvido por [KayhamCristoffer](https://github.com/KayhamCristoffer)
