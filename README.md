# JurisBPO — Guia de Implantação Completo

Sistema de gestão jurídica com autenticação real, banco de dados na nuvem e controle de acesso por perfil.

**Stack:** React 18 + Vite · Supabase (auth + banco + storage) · Vercel (hospedagem gratuita)

---

## Visão geral da arquitetura

```
[Navegador do usuário]
        │
        ▼
[Vercel — app React/Vite]  ←→  [Supabase]
                                  ├── Auth (login/convite/senha)
                                  ├── PostgreSQL (dados)
                                  └── Storage (documentos)
```

**Custo estimado para começar:** R$ 0/mês
- Supabase Free: até 500 MB de banco, 1 GB de storage, 50 000 usuários
- Vercel Free: hospedagem ilimitada para projetos pessoais/pequenos

---

## PASSO 1 — Criar conta no Supabase

1. Acesse **https://supabase.com** e clique em **Start your project**
2. Crie uma conta (pode usar Google ou GitHub)
3. Clique em **New project**
4. Preencha:
   - **Name:** jurisboard
   - **Database Password:** crie uma senha forte e guarde-a
   - **Region:** South America (São Paulo)
5. Aguarde ~2 minutos enquanto o projeto é criado

---

## PASSO 2 — Criar o banco de dados

1. No painel do Supabase, clique em **SQL Editor** (menu lateral)
2. Clique em **New query**
3. Copie TODO o conteúdo do arquivo `supabase/schema.sql`
4. Cole na caixa de texto e clique em **Run** (▶)
5. Você verá "Success" — o banco está pronto

---

## PASSO 3 — Criar o Storage para documentos

1. No menu lateral, clique em **Storage**
2. Clique em **New bucket**
3. Nome: **documentos**
4. Marque **Public bucket** (para que os links funcionem no app)
5. Clique em **Create bucket**
6. Clique no bucket criado → **Policies** → **New policy**
7. Escolha **For full customization** e adicione:
   ```sql
   -- Política de upload (INSERT)
   -- Policy name: allow_authenticated_upload
   -- Allowed operation: INSERT
   -- Target roles: authenticated
   -- Policy: true
   
   -- Política de leitura (SELECT)
   -- Policy name: allow_authenticated_select
   -- Allowed operation: SELECT
   -- Target roles: authenticated
   -- Policy: true
   ```

---

## PASSO 4 — Obter as credenciais do Supabase

1. No menu lateral, clique em **Settings** (ícone de engrenagem)
2. Clique em **API**
3. Copie:
   - **Project URL** (ex: https://abcdefg.supabase.co)
   - **anon public** key (começa com "eyJ...")

---

## PASSO 5 — Configurar o projeto localmente

### Pré-requisitos
- Node.js 18+ instalado (https://nodejs.org)
- Git instalado (https://git-scm.com)

### Instalação

```bash
# Entre na pasta do projeto
cd jurisboard

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
```

Abra o arquivo `.env` num editor de texto e preencha:
```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

### Testar localmente
```bash
npm run dev
```
Acesse **http://localhost:5173** no navegador.

---

## PASSO 6 — Criar o primeiro usuário (Gerente)

1. No Supabase, vá em **Authentication** → **Users**
2. Clique em **Invite user**
3. Informe o seu e-mail e clique em **Send invitation**
4. Verifique seu e-mail e clique no link para criar sua senha
5. Faça login no app → você já terá um perfil criado automaticamente
6. No Supabase → **Table Editor** → tabela **profiles** → edite seu registro:
   - Mude `role` de `advogado` para `gerente`
   - Mude `nome` para seu nome completo
   - Clique em **Save**
7. Faça logout e login novamente — você agora é Gerente

---

## PASSO 7 — Convidar outros membros da equipe

1. No Supabase → **Authentication** → **Users** → **Invite user**
2. Informe o e-mail do membro e envie o convite
3. O membro recebe um e-mail para criar sua senha
4. Após o primeiro login, vá em **Table Editor** → **profiles** → encontre o registro do novo usuário
5. Ajuste o campo `role`:
   - `gerente` → acesso total
   - `advogado` → cria/edita processos, contratos, tarefas, usa IA
   - `paralegal` → cria/edita processos, contratos, tarefas
   - `estagiario` → apenas visualiza e cria tarefas
   - `consultor` → visualiza e cria tarefas

**Ou:** dentro do próprio app, o Gerente pode editar o perfil de qualquer membro na seção Equipe.

---

## PASSO 8 — Publicar na internet (Vercel)

### Opção A — Via GitHub (recomendado)

1. Crie uma conta em **https://github.com** se ainda não tiver
2. Crie um repositório novo (pode ser privado)
3. Envie os arquivos:
   ```bash
   git init
   git add .
   git commit -m "JurisBPO v1"
   git remote add origin https://github.com/SEU_USUARIO/jurisboard.git
   git push -u origin main
   ```
4. Acesse **https://vercel.com** e faça login com GitHub
5. Clique em **Add New Project** → selecione o repositório `jurisboard`
6. Na seção **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` → sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → sua chave anon
7. Clique em **Deploy**
8. Em ~2 minutos, seu app estará em **https://jurisboard-XXXX.vercel.app**

### Opção B — Deploy direto (sem GitHub)

```bash
# Instala o CLI da Vercel
npm install -g vercel

# Na pasta do projeto
vercel

# Siga as instruções e informe as variáveis de ambiente quando solicitado
```

---

## Domínio personalizado (opcional)

Após o deploy na Vercel:
1. Vá em **Settings** → **Domains**
2. Adicione seu domínio (ex: jurisboard.suaempresa.com.br)
3. Siga as instruções de configuração de DNS

---

## Perfis de acesso — Tabela completa

| Funcionalidade              | Gerente | Advogado | Paralegal | Estagiário | Consultor |
|-----------------------------|:-------:|:--------:|:---------:|:----------:|:---------:|
| Ver processos               | ✅      | ✅       | ✅        | ✅         | ✅        |
| Criar/editar processos      | ✅      | ✅       | ✅        | ❌         | ❌        |
| Excluir processos           | ✅      | ❌       | ❌        | ❌         | ❌        |
| Ver contratos               | ✅      | ✅       | ✅        | ✅         | ✅        |
| Criar/editar contratos      | ✅      | ✅       | ✅        | ❌         | ❌        |
| Excluir contratos           | ✅      | ❌       | ❌        | ❌         | ❌        |
| Ver e criar tarefas         | ✅      | ✅       | ✅        | ✅         | ✅        |
| Editar tarefas de outros    | ✅      | ✅       | ❌        | ❌         | ❌        |
| Upload de documentos        | ✅      | ✅       | ✅        | ✅         | ✅        |
| Excluir documentos          | ✅      | ✅       | ✅        | ❌         | ❌        |
| Usar IA Jurídica            | ✅      | ✅       | ❌        | ❌         | ✅        |
| Gerar relatórios            | ✅      | ✅       | ✅        | ❌         | ❌        |
| Ver equipe                  | ✅      | ✅       | ✅        | ❌         | ❌        |
| Gerenciar equipe            | ✅      | ❌       | ❌        | ❌         | ❌        |

---

## Estrutura dos arquivos

```
jurisboard/
├── index.html                  # Entrada do app
├── vite.config.js              # Configuração do Vite
├── package.json                # Dependências
├── .env.example                # Modelo de variáveis de ambiente
├── .env                        # Suas credenciais (NÃO comite este arquivo)
├── supabase/
│   └── schema.sql              # Schema completo do banco
└── src/
    ├── main.jsx                # Ponto de entrada React
    ├── App.jsx                 # Roteamento e layout principal
    ├── hooks/
    │   └── useAuth.jsx         # Hook de autenticação
    ├── lib/
    │   └── supabase.js         # Cliente Supabase + permissões
    └── components/
        ├── Auth.jsx            # Tela de login
        ├── Dashboard.jsx       # Painel geral
        ├── Processos.jsx       # Gestão de processos
        ├── Contratos.jsx       # Gestão de contratos
        ├── Atividades.jsx      # Gestão de atividades
        ├── Calendario.jsx      # Calendário
        ├── Documentos.jsx      # Upload e gestão de documentos
        ├── IaJuridica.jsx      # IA: análise, comparação, relatório
        ├── Equipe.jsx          # Gestão de equipe
        └── MeuPerfil.jsx       # Perfil do usuário logado
```

---

## Segurança

- Todas as tabelas têm **Row Level Security (RLS)** ativado — nenhum dado é acessível sem autenticação
- As permissões são verificadas tanto no frontend (UI) quanto no backend (banco)
- As senhas são gerenciadas pelo Supabase Auth (bcrypt + tokens JWT)
- O arquivo `.env` **nunca deve ser versionado** — está no `.gitignore`

---

## Suporte e próximos passos

Com o app hospedado, você pode pedir melhorias diretamente no Claude:
- Notificações por e-mail de prazos
- Relatórios automáticos semanais
- Integração com o Diário Oficial
- App mobile (React Native)
- Assinatura digital de documentos

---

*Gerado pelo JurisBPO — Claude (Anthropic)*

## Acompanhamento processual via push por e-mail

Este pacote inclui integração incremental do módulo de acompanhamento processual por e-mail, sem substituir módulos existentes.

- Frontend: `src/components/AndamentosProcessuaisPush.jsx`, integrado à seção `Processos` e à aba `Andamentos` dentro de cada processo.
- Banco: `supabase/migrations/20260505_acompanhamento_push_email.sql`.
- Worker: `push-email-worker/`, monitorando `juridicocallbrbpo@gmail.com` por IMAP.

A migration nova apenas cria a tabela `andamentos_processuais_push` e suas policies. Ela não executa `DROP TABLE` e não altera tabelas existentes.
