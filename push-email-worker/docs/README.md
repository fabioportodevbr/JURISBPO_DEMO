# JurisBPO - Worker de acompanhamento processual via push por e-mail

Este worker monitora a caixa `juridicocallbrbpo@gmail.com`, lê e-mails não lidos dos tribunais, extrai número CNJ, tribunal, data e tipo de movimentação, e grava tudo na tabela `andamentos_processuais_push` do Supabase.

## Como funciona

1. O Gmail recebe avisos/intimações/notificações dos tribunais.
2. O worker acessa o Gmail por IMAP com senha de app.
3. O parser identifica o número do processo e o tipo do andamento.
4. O worker procura o processo no JurisBPO pelo campo `processos.numero`.
5. Se encontrar, grava o andamento associado ao processo e cria notificação interna para o responsável do processo.
6. Se não encontrar, grava como pendente para vinculação posterior dentro da aba do processo.
7. Opcionalmente, envia o payload para `ALERT_WEBHOOK_URL` para WhatsApp, n8n, Make, Zapier etc.

## Instalação

```bash
cd push-email-worker
npm install
cp .env.example .env
```

Preencha `.env` com:

```env
IMAP_USER=juridicocallbrbpo@gmail.com
IMAP_PASSWORD=SENHA_DE_APP_DO_GMAIL
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
DEFAULT_ESCRITORIO_ID=UUID_DO_ESCRITORIO_PADRAO
POLL_INTERVAL_MINUTES=5
ALERT_WEBHOOK_URL=
```

## Banco

Execute no Supabase:

```sql
supabase/migrations/20260505_acompanhamento_push_email.sql
```

A migration é incremental e não apaga tabelas existentes.

## Execução

Rodar uma vez:

```bash
npm run once
```

Rodar continuamente:

```bash
npm run dev
```

Para produção, rode como serviço em servidor/VM/Render/Fly/Railway/Docker. Não coloque a `SERVICE_ROLE_KEY` no frontend.
