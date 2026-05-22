# Auditoria tecnica de seguranca e LGPD - JurisBPO

Data: 2026-05-22  
Escopo: revisao tecnica do repositorio local `jurisbpo-main`, configuracoes inferiveis do codigo e checagens read-only ja realizadas no ambiente Supabase de producao durante a sessao.

## Resumo executivo

O JurisBPO armazena dados operacionais e documentos juridicos principalmente no Supabase:

- dados estruturados em tabelas Postgres;
- documentos e anexos em Supabase Storage;
- autenticacao e controle de acesso apoiados em Supabase Auth, RLS e politicas de Storage;
- servicos server-side em rotas Next.js, worker Railway e funcoes Supabase para fluxos que exigem segredos ou integracoes externas.

Ha controles tecnicos relevantes ja presentes:

- RLS habilitado nas tabelas centrais do schema principal;
- isolamento por `escritorio_id` em tabelas nucleares;
- buckets principais de documentos e anexos de compliance configurados como privados no schema;
- uso de URLs assinadas para leitura de documentos privados em fluxos centrais;
- segredos recentes removidos do versionamento e CI adicionada para bloquear novos `.env` reais rastreados.

A conclusao, entretanto, nao deve ser "esta aderente a LGPD" sem ressalvas. A LGPD exige medidas tecnicas e administrativas proporcionais ao risco, e o sistema trata dados de alto impacto pratico: processos, documentos juridicos, comunicacoes internas, dados financeiros e denuncias de compliance. A revisao encontrou riscos que precisam de correcao ou verificacao urgente.

## Principais achados

| Severidade | Achado | Impacto |
| --- | --- | --- |
| Alta | Rotas Google Calendar usam `SUPABASE_SERVICE_ROLE_KEY` sem autenticacao/autorizacao observavel | Leitura e gravacao de configuracao/token por `escritorio_id` controlado por request/state |
| Alta | Callback OAuth Google aceita `state` apenas em Base64, sem assinatura ou vinculacao verificavel a sessao | Integridade fraca do escritorio/usuario associado ao token Google |
| Alta | Bucket `chat-arquivos` foi observado como publico em producao e o frontend gera `getPublicUrl` | Anexos do chat podem ficar acessiveis por URL publica |
| Media/Alta | `compliance_denuncias` e consultada com `select('*')` no frontend, apesar de comentarios do schema proibirem exposicao de remetente | Possivel exposicao de `remetente_email` e `remetente_nome` a usuarios de compliance |
| Media | Parte das tabelas usadas pelo app nao tem criacao/RLS completa comprovavel no conjunto atual de schema/migrations | O repositorio nao basta para provar isolamento de producao em todos os modulos |
| Media | Anexos de mensagens usam bucket privado `documentos`, mas o codigo grava `getPublicUrl` | Fluxo inconsistente: risco de link inutil hoje e risco de exposicao se o bucket mudar para publico |

## Onde os dados ficam

### Dados estruturados

As tabelas centrais do schema local incluem:

- `profiles` e `usuarios_escritorios`: identidade interna, papeis e vinculos de escritorio;
- `processos`, `processo_apensamentos`, `contratos`, `atividades`, `documentos`;
- `financeiro_processos` e `financeiro_lancamentos` usados pelo modulo financeiro;
- `partes_crm`, `oficios`, `oficios_anexos`, `acervo_modelos` usados pelo acervo e CRM;
- `compliance_denuncias`, `compliance_mensagens`, `compliance_anexos` e `compliance_conflito_interesse_analises`;
- `mensagens`, `mensagens_anexos`, `chat_salas`, `chat_mensagens`, `notificacoes`;
- `andamentos_processuais_push` e `publicacoes_lider` para publicacoes processuais.

Checagem read-only de producao ja realizada durante a sessao confirmou uso relevante de dados em producao, entre eles:

- `processos`: 2350 linhas;
- `contratos`: 159 linhas;
- `documentos`: 957 linhas;
- `financeiro_processos`: 114 linhas;
- `oficios`: 154 linhas e `oficios_anexos`: 283 linhas;
- `compliance_denuncias`: 9 linhas;
- `compliance_conflito_interesse_analises`: 497 linhas.

Esses numeros sao inventario tecnico de volume, nao leitura de conteudo pessoal.

### Arquivos

O schema cria buckets privados para:

- `documentos`;
- `modelos`;
- `compliance-anexos`.

O fluxo principal de documentos usa o bucket `documentos`, caminho com prefixo de escritorio, metadados na tabela `documentos` e URLs assinadas para visualizacao. Isso aparece em `src/components/DocumentoVinculados.jsx` e em outros consumidores de documentos privados.

Buckets observados em producao durante a sessao:

| Bucket | Observacao |
| --- | --- |
| `documentos` | privado |
| `modelos` | privado |
| `compliance-anexos` | privado |
| `mensagens` | privado |
| `avatars` | publico |
| `chat-arquivos` | publico |

`avatars` publico pode ser aceitavel se reservado a fotos/perfis nao sensiveis. `chat-arquivos` merece tratamento mais restritivo porque anexos de chat podem conter informacao juridica, pessoal ou confidencial.

## Controles positivos confirmados

### Isolamento por escritorio

O schema principal define funcoes como:

- `usuario_tem_escritorio`;
- `usuario_eh_gerente`;
- `usuario_pode_escrever`;
- auxiliares de Storage que validam o primeiro segmento do caminho como UUID de escritorio.

As tabelas nucleares do schema principal habilitam RLS e usam politicas baseadas nesses helpers. Isso reduz o risco de um usuario autenticado consultar linhas de outro escritorio pela API de dados.

### Documentos privados

Os documentos vinculados a processos, contratos e atividades sao gravados com metadados de bucket/caminho e sao abertos por `createSignedUrl` nos fluxos centrais. O schema tambem restringe Storage por bucket e prefixo de escritorio.

### Compliance restrito a gerente

As migrations de compliance configuram RLS para denuncias e mensagens com acesso por gerente ativo do escritorio. Isso e um bom limite de acesso funcional, embora nao resolva sozinho o problema da selecao ampla de colunas sensiveis no frontend.

### Segredos

Durante a sessao:

- o `.env` do worker deixou de ser rastreado no Git;
- `.gitignore` passou a bloquear `.env` e `.env.*`, preservando apenas exemplos;
- foi criada verificacao CI para impedir que `.env` real volte a ser versionado;
- chaves Supabase foram rotacionadas e o app continuou operando apos desabilitacao das chaves legacy JWT.

## Achados detalhados

### 1. Rotas Google Calendar com privilegio administrativo sem barreira observavel

Evidencias:

- `pages/api/google/calendar.ts` cria cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY`;
- a rota recebe `escritorio_id` em query string;
- a rota consulta `google_calendar_config` por esse `escritorio_id` e pode atualizar `access_token`;
- nao foi observada validacao de sessao Supabase, token Bearer ou checagem de membro do escritorio antes do uso do cliente admin.

Risco:

- uma rota server-side com `service_role` contorna RLS;
- se exposta sem autorizacao, qualquer request que acerte um `escritorio_id` valido pode acionar leitura de eventos do Google Calendar daquele escritorio;
- a rota tambem opera sobre refresh/access token em backend privilegiado.

Recomendacao:

1. exigir sessao autenticada na rota;
2. validar no servidor que `auth.uid()` pertence ao `escritorio_id` solicitado;
3. preferir derivar `escritorio_id` do vinculo do usuario autenticado quando possivel;
4. limitar retorno a campos de evento estritamente necessarios;
5. registrar testes de autorizacao para request sem sessao e para escritorio diverso.

### 2. `state` OAuth Google sem integridade verificavel

Evidencias:

- `src/pages/ConfiguracaoCalendario.jsx` monta `state` com `btoa(JSON.stringify({ escritorio_id, usuario_id }))`;
- `pages/api/auth/google/callback.ts` apenas decodifica esse Base64 e usa os valores no `upsert` com cliente `service_role`;
- nao foi observada assinatura HMAC, nonce armazenado no servidor, validacao de sessao ou amarracao criptografica do `state`.

Risco:

- Base64 nao e assinatura;
- o backend confia em metadados de destino fornecidos pelo fluxo cliente;
- o token Google pode ser associado ao escritorio/usuario errado se o callback aceitar estado adulterado.

Recomendacao:

1. substituir o `state` por valor assinado e com expiracao, ou por nonce salvo server-side;
2. validar o estado no callback antes de persistir tokens;
3. conferir que o usuario que iniciou a conexao e gerente do escritorio alvo;
4. invalidar states reutilizados.

### 3. Anexos de chat em bucket publico

Evidencias:

- bucket `chat-arquivos` foi observado como publico em producao;
- `src/components/Forum.jsx` grava anexos nele e persiste `getPublicUrl`.

Risco:

- anexos podem conter documentos internos, dados pessoais, estrategias ou evidencias;
- bucket publico torna o controle de acesso dependente da obscuridade da URL, o que nao e apropriado para esse tipo de conteudo.

Recomendacao:

1. migrar anexos do chat para bucket privado;
2. usar politicas de Storage por escritorio/sala/participante;
3. trocar URLs publicas por URL assinada ou download autenticado;
4. inventariar objetos ja publicados no bucket e decidir migracao, revogacao ou expurgo.

### 4. Denuncias de compliance com selecao ampla no frontend

Evidencias:

- a migration de compliance documenta que `remetente_email` e `remetente_nome` nunca devem ser expostos ao frontend;
- `src/components/Compliance.jsx` tem consultas e retornos de update em `compliance_denuncias` com `select('*')`.

Risco:

- mesmo que a tela nao renderize os campos, a resposta da API pode inclui-los no navegador;
- dados de denunciante exigem minimizacao e confidencialidade reforcada.

Recomendacao:

1. substituir `select('*')` por lista explicita de colunas permitidas;
2. considerar view ou RPC especifica para a UI que nunca retorne campos de identificacao do remetente;
3. manter `remetente_email` acessivel apenas a worker/fluxo servidor estritamente necessario;
4. revisar logs e ferramentas de observabilidade para evitar captura acidental desses campos.

### 5. Cobertura de RLS nao comprovada para todos os modulos usados

Evidencias:

- o schema principal prova RLS para tabelas centrais;
- as migrations provam RLS para algumas tabelas adicionais, como compliance, mensagens e partes do modulo de oficios;
- varias tabelas acessadas pelo frontend aparecem no app e nos grants da Data API, mas sua criacao e politicas completas nao estao evidentes no conjunto atual do repositorio, por exemplo `financeiro_processos`, `partes_crm`, `oficios`, `oficios_anexos`, `oficios_auditoria`, `oficios_destinatarios`, `acervo_modelos`, `chat_salas`, `chat_mensagens`, `notificacoes`, `google_calendar_config`.

Risco:

- nao e possivel atestar pelo repositorio que todas as tabelas de producao estao com RLS ligado e politicas corretas;
- grants de Data API tornam essa verificacao ainda mais importante.

Recomendacao:

1. exportar inventario de RLS/policies de producao para todas as tabelas `public`;
2. versionar migrations faltantes;
3. bloquear merge/deploy de novas tabelas sensiveis sem migration de RLS e teste de isolamento.

### 6. Mensagens com URL publica gerada para bucket privado

Evidencias:

- `src/components/Forum.jsx` grava anexos de mensagens no bucket `documentos`;
- o mesmo fluxo chama `getPublicUrl` para bucket que o schema define como privado.

Risco:

- hoje o link pode falhar porque bucket privado nao serve URL publica;
- se alguem tornar o bucket publico para "corrigir" o sintoma, documentos juridicos podem ser expostos.

Recomendacao:

1. manter `documentos` privado;
2. trocar esse fluxo por URL assinada/download autenticado;
3. alinhar bucket e politicas de anexos de mensagens a um modelo unico.

## Avaliacao LGPD

### O que a revisao permite afirmar

Ha uma base tecnica melhor que um armazenamento aberto ou sem segmentacao:

- tabelas centrais usam RLS;
- documentos principais usam buckets privados;
- existe segmentacao por escritorio;
- houve endurecimento recente de gestao de segredos.

Esses pontos caminham na direcao do dever de seguranca e prevencao.

### O que a revisao nao permite afirmar sozinha

Nao foi verificado nesta auditoria:

- base legal, finalidade, avisos de privacidade e papeis controlador/operador por fluxo;
- contratos/DPA com provedores e transferencias internacionais;
- localizacao/regiao efetiva dos dados e politica de backup;
- politica de retencao e descarte por classe documental;
- atendimento a direitos de titulares;
- processo de incidente, canal de encarregado e governanca;
- MFA, controle administrativo de contas Supabase/Vercel/Railway/GitHub e logs de acesso;
- RLS/policies reais de todas as tabelas de producao.

Por isso, o status correto e:

> O sistema possui controles tecnicos relevantes, mas ainda nao deve ser declarado aderente a LGPD sem remediar os achados de alta prioridade e completar a verificacao administrativa e de producao.

## Plano recomendado

### Imediato

1. Corrigir autorizacao das rotas Google Calendar.
2. Assinar/validar `state` OAuth ou substituir por nonce server-side.
3. Tornar anexos de chat privados e remover uso de URL publica para conteudo interno.
4. Remover `select('*')` de `compliance_denuncias` na UI.

### Curto prazo

1. Exportar inventario de RLS/policies de producao e comparar com repositorio.
2. Corrigir anexos de mensagens para download privado.
3. Criar testes de isolamento por escritorio para rotas API e tabelas sensiveis.
4. Definir classificacao e retencao para documentos, mensagens, compliance e financeiro.

### Governanca

1. Formalizar mapa de tratamento LGPD por modulo.
2. Confirmar DPA/termos dos fornecedores e fluxo de transferencia internacional.
3. Definir resposta a incidente e criterio de comunicacao.
4. Exigir MFA e revisao periodica de acessos administrativos.

## Evidencias locais principais

- `supabase/schema.sql`
- `supabase/migrations/20260510_compliance_module.sql`
- `supabase/migrations/20260521_compliance_access.sql`
- `src/components/DocumentoVinculados.jsx`
- `src/components/Compliance.jsx`
- `src/components/Forum.jsx`
- `src/pages/ConfiguracaoCalendario.jsx`
- `pages/api/google/calendar.ts`
- `pages/api/auth/google/callback.ts`

## Referencias oficiais consideradas

- LGPD, especialmente dever de medidas de seguranca tecnicas e administrativas.
- ANPD, Guia Orientativo sobre Seguranca da Informacao para Agentes de Tratamento de Pequeno Porte.
- Supabase Docs, Storage Access Control, public/private buckets, signed URLs e API keys.

