# JurisBPO - Nova seção FINANCEIRO

Este pacote contém uma implementação inicial para a seção **Financeiro**.

## Arquivos incluídos

- `supabase/migrations/001_financeiro_lancamentos.sql`
  - Cria `financeiro_lancamentos`.
  - Ativa RLS.
  - Cria policies por `escritorio_id`.
  - Cria índices e view opcional de resumo.

- `src/pages/Financeiro.tsx`
  - Tela principal da seção Financeiro.
  - Cards de resumo.
  - Filtros.
  - Tabela responsiva.
  - Modal de novo lançamento.

- `src/components/FinanceiroResumoDashboard.tsx`
  - Bloco para inserir no Painel Jurídico/Dashboard.

- `src/components/FinanceiroProcessoCard.tsx`
  - Bloco para inserir na tela de detalhes de processo.

## 1. Aplicar a migration no Supabase

Execute o SQL de `supabase/migrations/001_financeiro_lancamentos.sql` no SQL Editor do Supabase ou via Supabase CLI.

Antes de executar em produção, confirme que a tabela `profiles` usa:

```sql
profiles.id = auth.users.id
profiles.escritorio_id = uuid do escritório
```

Se seu schema usar outro nome, ajuste as policies.

## 2. Adicionar rota

Exemplo com React Router:

```tsx
import Financeiro from "@/pages/Financeiro";

<Route path="/financeiro" element={<Financeiro />} />
```

## 3. Adicionar item no menu lateral

Exemplo:

```tsx
import { Wallet } from "lucide-react";

{
  title: "Financeiro",
  href: "/financeiro",
  icon: Wallet,
}
```

## 4. Adicionar resumo no Dashboard

No componente do Painel Jurídico:

```tsx
import { FinanceiroResumoDashboard } from "@/components/FinanceiroResumoDashboard";

<FinanceiroResumoDashboard />
```

## 5. Adicionar bloco financeiro na tela de processo

Na tela de detalhes do processo:

```tsx
import { FinanceiroProcessoCard } from "@/components/FinanceiroProcessoCard";

<FinanceiroProcessoCard
  processoId={processo.id}
  clienteId={processo.cliente_id}
  escritorioId={processo.escritorio_id}
  onNovoLancamento={() => navigate(`/financeiro?processo_id=${processo.id}`)}
/>
```

## Observações importantes

1. O componente assume que existem tabelas `clientes`, `processos`, `contratos` e `profiles` com `escritorio_id`.
2. O frontend usa somente `supabase.auth.getUser()` e `VITE_SUPABASE_ANON_KEY`.
3. Não há uso de `service_role` no frontend.
4. A RLS é obrigatória e filtra por `escritorio_id`.
5. Ajuste nomes de campos caso seu schema atual use variações como `nome_cliente`, `numero`, `titulo_processo`, etc.

## Melhorias recomendadas para a próxima versão

- Edição de lançamento.
- Parcelamento.
- Recorrência mensal.
- Exportação Excel/PDF.
- Upload de comprovantes com Storage seguro por `escritorio_id`.
- Alertas de vencimento.
- Conciliação bancária.
