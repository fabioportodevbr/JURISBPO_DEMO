# Ambiente de Demonstração — JurisBPO

Guia para subir uma instância paralela do sistema com dados fictícios,
destinada a apresentações e mockups. **Não altera o projeto de produção.**

---

## Visão geral

```
Repositório único (jurisbpo)
        │
        ├── Vercel "jurisbpo"         → Supabase PRODUÇÃO  (dados reais)
        │
        └── Vercel "jurisbpo-demo"    → Supabase DEMO      (dados fictícios)
```

Os dois deploys rodam o mesmo código do branch `main`.
A separação é feita inteiramente por variáveis de ambiente.

---

## Pré-requisitos

- Conta no [Supabase](https://supabase.com) (plano Free é suficiente)
- Conta no [Vercel](https://vercel.com) com o repositório já conectado
- Acesso ao Supabase SQL Editor

---

## Passo 1 — Criar o projeto Supabase demo

1. Em [app.supabase.com](https://app.supabase.com), clique em **New project**
2. Nomeie como `jurisbpo-demo` (ou similar)
3. Escolha a região mais próxima (ex.: South America — São Paulo)
4. Anote a **Project URL** e as chaves **anon** e **service_role**
   (Settings → API)

---

## Passo 2 — Aplicar as migrations

No terminal, com a [Supabase CLI](https://supabase.com/docs/guides/cli) instalada:

```bash
# Autentica e linka ao projeto demo
supabase login
supabase link --project-ref SEU_PROJECT_REF_DEMO

# Aplica todas as migrations
supabase db push
```

> **Alternativa sem CLI:** copie o conteúdo de cada arquivo em
> `supabase/migrations/` em ordem cronológica e execute no SQL Editor
> do projeto demo.

---

## Passo 3 — Aplicar o seed de demonstração

1. Abra o **SQL Editor** do projeto demo no Supabase
2. Cole o conteúdo do arquivo `supabase/seed_demo.sql`
3. Clique em **Run**

O script:
- Cria o escritório **"BPO Jurídico Demo"**
- Cria 3 usuários diretamente em `auth.users` com senha `Demo@2026!`
- Insere clientes, processos, atividades, contratos, lançamentos e
  andamentos push fictícios

> O seed é **idempotente** — pode ser re-executado para restaurar os
> dados ao estado inicial.

### Usuários criados

| E-mail | Senha | Papel |
|--------|-------|-------|
| gerente@jurisbpo-demo.com | `Demo@2026!` | Gerente |
| advogado@jurisbpo-demo.com | `Demo@2026!` | Advogado |
| estagiario@jurisbpo-demo.com | `Demo@2026!` | Assistente |

---

## Passo 4 — Criar o deploy demo no Vercel

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o **mesmo repositório** `jurisbpo` (já conectado)
3. Na tela de configuração, clique em **Environment Variables**
4. Copie o arquivo `.env.demo.example` deste repositório e preencha
   com as credenciais do projeto Supabase demo
5. Clique em **Deploy**

O Vercel criará um projeto separado (ex.: `jurisbpo-demo.vercel.app`)
apontando para o banco demo, sem interferir no deploy de produção.

> **Dica:** no painel do Vercel, renomeie o projeto para `jurisbpo-demo`
> para facilitar a distinção.

---

## Passo 5 — (Opcional) Domínio personalizado

Para apresentações profissionais, configure um subdomínio:

```
demo.jurisbpo.com.br  →  jurisbpo-demo.vercel.app
```

Vercel → Settings → Domains → Add domain.

---

## Restaurar os dados da demo

Se alguém alterar os dados durante uma apresentação, basta re-executar
o `seed_demo.sql` no SQL Editor do Supabase demo. O script limpa e
recria tudo em segundos.

---

## Worker de e-mail (push processual)

O worker de e-mail **não precisa rodar** no ambiente demo. Os andamentos
processuais já estão pré-inseridos pelo seed com status variados
(`associado` e `pendente`) para demonstrar o módulo Push e Clippings.

Se quiser demonstrar o fluxo de ingestão ao vivo, crie uma caixa de
e-mail de teste e configure as variáveis `IMAP_*` no `.env.demo.example`.

---

## O que a demo cobre

| Módulo | Dados disponíveis |
|--------|-------------------|
| Painel Jurídico | KPIs calculados a partir dos dados inseridos |
| Processos | 8 processos (ativos, encerrado, recurso, execução) |
| Atividades | 10 tarefas/prazos/audiências com status variados |
| Financeiro | 5 lançamentos (pago, pendente, atrasado, acordo) |
| Contratos | 3 contratos com clientes distintos |
| Push e Clippings | 4 andamentos (2 associados, 2 pendentes) |
| Usuários | 3 perfis com papéis diferentes para demonstrar RLS |

---

## Arquivo de referência

```
supabase/seed_demo.sql      ← dados fictícios, re-executável
.env.demo.example           ← template de variáveis para o Vercel demo
docs/DEMO_SETUP.md          ← este guia
```
