# IA básica do JurisBPO

Esta versão usa uma Supabase Edge Function chamada `ai-assistant`.

## Secrets necessários

No Supabase, configure:

- `OPENAI_API_KEY` com sua chave da OpenAI
- opcional: `OPENAI_MODEL`, por exemplo `gpt-4.1-mini`

## Deploy pelo Supabase CLI

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase secrets set OPENAI_API_KEY=sua_chave_aqui
supabase functions deploy ai-assistant
```

Depois reinicie o app local:

```bash
npm run dev -- --host 0.0.0.0
```
