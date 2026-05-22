-- =============================================================================
-- JurisBPO — Seed de Demonstração
-- =============================================================================
-- Cria um ambiente completo com dados fictícios para uso em demos e mockups.
-- NÃO execute este script no banco de produção.
--
-- Pré-requisito: todas as migrations aplicadas (supabase db push).
-- Como executar: cole no Supabase SQL Editor do projeto demo e execute.
--
-- Usuários criados:
--   gerente@jurisbpo-demo.com   /  Demo@2026!   (papel: gerente)
--   advogado@jurisbpo-demo.com  /  Demo@2026!   (papel: advogado)
--   estagiario@jurisbpo-demo.com / Demo@2026!   (papel: assistente)
-- =============================================================================

-- Limpa dados anteriores do seed (idempotente)
DO $$ BEGIN
  DELETE FROM public.andamentos_processuais_push
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.financeiro_lancamentos
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.atividades
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.contratos
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.processos
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.clientes
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.usuarios_escritorios
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.profiles
    WHERE id IN (
      'a0000000-0000-0000-0000-000000000010',
      'a0000000-0000-0000-0000-000000000011',
      'a0000000-0000-0000-0000-000000000012'
    );
  DELETE FROM auth.identities
    WHERE user_id IN (
      'a0000000-0000-0000-0000-000000000010',
      'a0000000-0000-0000-0000-000000000011',
      'a0000000-0000-0000-0000-000000000012'
    );
  DELETE FROM auth.users
    WHERE id IN (
      'a0000000-0000-0000-0000-000000000010',
      'a0000000-0000-0000-0000-000000000011',
      'a0000000-0000-0000-0000-000000000012'
    );
  DELETE FROM public.escritorios
    WHERE id = 'a0000000-0000-0000-0000-000000000001';
END $$;


-- =============================================================================
-- 1. ESCRITÓRIO DEMO
-- =============================================================================
INSERT INTO public.escritorios (id, nome, slug, plano, ativo)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'BPO Jurídico Demo',
  'bpo-juridico-demo',
  'pro',
  true
);


-- =============================================================================
-- 2. USUÁRIOS (auth.users + identities + profiles + vínculo ao escritório)
-- =============================================================================
DO $$
DECLARE
  v_hash TEXT := crypt('Demo@2026!', gen_salt('bf', 10));
  v_meta JSONB := '{"provider":"email","providers":["email"]}'::jsonb;
BEGIN

  -- Gerente
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    'a0000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'gerente@jurisbpo-demo.com',
    v_hash, now(), v_meta, '{}', now(), now()
  );
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (
    'a0000000-0000-0000-0000-000000000010',
    'a0000000-0000-0000-0000-000000000010',
    '{"sub":"a0000000-0000-0000-0000-000000000010","email":"gerente@jurisbpo-demo.com"}'::jsonb,
    'email', now(), now()
  );

  -- Advogado
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    'a0000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'advogado@jurisbpo-demo.com',
    v_hash, now(), v_meta, '{}', now(), now()
  );
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (
    'a0000000-0000-0000-0000-000000000011',
    'a0000000-0000-0000-0000-000000000011',
    '{"sub":"a0000000-0000-0000-0000-000000000011","email":"advogado@jurisbpo-demo.com"}'::jsonb,
    'email', now(), now()
  );

  -- Estagiário
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    'a0000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'estagiario@jurisbpo-demo.com',
    v_hash, now(), v_meta, '{}', now(), now()
  );
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (
    'a0000000-0000-0000-0000-000000000012',
    'a0000000-0000-0000-0000-000000000012',
    '{"sub":"a0000000-0000-0000-0000-000000000012","email":"estagiario@jurisbpo-demo.com"}'::jsonb,
    'email', now(), now()
  );
END $$;

INSERT INTO public.profiles (id, email, nome, cargo, oab, cor, ativo)
VALUES
  ('a0000000-0000-0000-0000-000000000010', 'gerente@jurisbpo-demo.com',
   'Ana Paula Ferreira', 'Coordenadora Jurídica', 'OAB/SP 345.678', '#c9a227', true),
  ('a0000000-0000-0000-0000-000000000011', 'advogado@jurisbpo-demo.com',
   'Carlos Eduardo Souza', 'Advogado Trabalhista', 'OAB/SP 412.990', '#3b82f6', true),
  ('a0000000-0000-0000-0000-000000000012', 'estagiario@jurisbpo-demo.com',
   'Mariana Costa', 'Estagiária', NULL, '#10b981', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios_escritorios (usuario_id, escritorio_id, papel, ativo)
VALUES
  ('a0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'gerente',    true),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'advogado',   true),
  ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'assistente', true);


-- =============================================================================
-- 3. CLIENTES
-- =============================================================================
INSERT INTO public.clientes (id, escritorio_id, nome, tipo, documento, email, telefone, ativo, created_by)
VALUES
  ('a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000001',
   'Tecnologia Futura S.A.', 'pessoa_juridica', '12.345.678/0001-90',
   'juridico@tecnologiafutura.com.br', '(11) 3456-7890', true,
   'a0000000-0000-0000-0000-000000000010'),

  ('a0000000-0000-0000-0000-000000000021',
   'a0000000-0000-0000-0000-000000000001',
   'Construções Horizonte Ltda.', 'pessoa_juridica', '98.765.432/0001-10',
   'adm@horizonteconstrucoes.com.br', '(11) 2345-6789', true,
   'a0000000-0000-0000-0000-000000000010'),

  ('a0000000-0000-0000-0000-000000000022',
   'a0000000-0000-0000-0000-000000000001',
   'Roberto Alves Mendonça', 'pessoa_fisica', '543.210.987-65',
   'roberto.mendonca@email.com', '(21) 99876-5432', true,
   'a0000000-0000-0000-0000-000000000011');


-- =============================================================================
-- 4. PROCESSOS
-- =============================================================================
INSERT INTO public.processos (
  id, escritorio_id, cliente_id, numero, titulo,
  partes_contrarias, tribunal, orgao,
  data_ajuizamento, valor_acao, status, fase,
  responsavel_id, created_by
)
VALUES
  -- Trabalhista ativo — reclamante vs. Tecnologia Futura
  ('a0000000-0000-0000-0000-000000000100',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   '0001234-56.2024.5.02.0038',
   'Alves vs. Tecnologia Futura S.A.',
   '[{"nome":"Diego Alves Pereira","tipo":"pessoa_fisica"}]',
   'TRT2', '38ª Vara do Trabalho de São Paulo',
   '2024-03-15', 45000.00, 'ativo', 'conhecimento',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Trabalhista ativo — execução
  ('a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   '0009821-14.2022.5.02.0301',
   'Santos vs. Tecnologia Futura S.A. — Execução',
   '[{"nome":"Fernanda Santos Lima","tipo":"pessoa_fisica"}]',
   'TRT2', '1ª Vara do Trabalho de Santo André',
   '2022-08-01', 78500.00, 'ativo', 'execucao_sentenca',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Cível cobrança — Construções Horizonte
  ('a0000000-0000-0000-0000-000000000102',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021',
   '1023456-78.2023.8.26.0100',
   'Horizonte vs. Fornecedora ABC — Ação de Cobrança',
   '[{"nome":"Fornecedora ABC Materiais Ltda.","tipo":"pessoa_juridica"}]',
   'TJSP', '5ª Vara Cível do Foro Regional de Pinheiros',
   '2023-05-20', 132000.00, 'ativo', 'conhecimento',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Recurso ordinário — Construções Horizonte
  ('a0000000-0000-0000-0000-000000000103',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021',
   '0003344-21.2021.5.15.0001',
   'Costa vs. Construções Horizonte Ltda. — RO',
   '[{"nome":"Paulo Costa Ribeiro","tipo":"pessoa_fisica"},{"nome":"Horizonte Serviços Gerais ME","tipo":"pessoa_juridica"}]',
   'TRT15', '1ª Vara do Trabalho de Campinas',
   '2021-11-10', 62000.00, 'ativo', 'recurso',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000010'),

  -- Processo encerrado / arquivado definitivamente
  ('a0000000-0000-0000-0000-000000000104',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   '0007788-33.2020.5.02.0010',
   'Rodrigues vs. Tecnologia Futura — Encerrado',
   '[{"nome":"Silvia Rodrigues","tipo":"pessoa_fisica"}]',
   'TRT2', '10ª Vara do Trabalho de São Paulo',
   '2020-04-02', 28000.00, 'encerrado', 'arquivo_definitivo',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Pessoa física — indenização
  ('a0000000-0000-0000-0000-000000000105',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000022',
   '0056789-12.2024.8.19.0001',
   'Roberto Mendonça vs. Seguradora Sul — Indenização',
   '[{"nome":"Seguradora Sul S.A.","tipo":"pessoa_juridica"}]',
   'TJRJ', '2ª Vara Cível do Rio de Janeiro',
   '2024-01-08', 95000.00, 'ativo', 'conhecimento',
   'a0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000010'),

  -- Arquivo temporário
  ('a0000000-0000-0000-0000-000000000106',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021',
   '0001122-55.2019.5.02.0070',
   'Ferreira vs. Horizonte — Acordo Homologado',
   '[{"nome":"Gustavo Ferreira","tipo":"pessoa_fisica"}]',
   'TRT2', '70ª Vara do Trabalho de São Paulo',
   '2019-07-15', 15000.00, 'arquivo_temporario', 'conhecimento',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Execução provisória
  ('a0000000-0000-0000-0000-000000000107',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   '0004455-67.2023.5.02.0040',
   'Lima vs. Tecnologia Futura — Execução Provisória',
   '[{"nome":"Camila Lima Andrade","tipo":"pessoa_fisica"}]',
   'TRT2', '40ª Vara do Trabalho de São Paulo',
   '2023-02-28', 41000.00, 'ativo', 'execucao_provisoria',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011');


-- =============================================================================
-- 5. CONTRATOS
-- =============================================================================
INSERT INTO public.contratos (
  id, escritorio_id, cliente_id, titulo, parte, tipo,
  status, data_inicio, data_fim, responsavel_id, created_by
)
VALUES
  ('a0000000-0000-0000-0000-000000000200',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'Contrato de Prestação de Serviços Jurídicos — Tecnologia Futura',
   'Tecnologia Futura S.A.', 'Prestação de Serviços',
   'ativo', '2024-01-01', '2024-12-31',
   'a0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000010'),

  ('a0000000-0000-0000-0000-000000000201',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021',
   'Contrato de Assessoria Trabalhista — Construções Horizonte',
   'Construções Horizonte Ltda.', 'Assessoria',
   'ativo', '2023-06-01', '2025-05-31',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000010'),

  ('a0000000-0000-0000-0000-000000000202',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000022',
   'Contrato — Ação de Indenização (Roberto Mendonça)',
   'Roberto Alves Mendonça', 'Ad exitum',
   'ativo', '2024-01-08', NULL,
   'a0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000010');


-- =============================================================================
-- 6. ATIVIDADES
-- =============================================================================
INSERT INTO public.atividades (
  id, escritorio_id, tipo, titulo, descricao,
  status, prioridade, processo_id, responsavel_id, prazo, criado_por
)
VALUES
  -- Prazo processual urgente (amanhã)
  ('a0000000-0000-0000-0000-000000000300',
   'a0000000-0000-0000-0000-000000000001',
   'prazo_processual', 'Contestação — Alves vs. Tecnologia Futura',
   'Prazo para apresentação de contestação. Processo 0001234-56.2024.5.02.0038',
   'a_fazer', 'urgente',
   'a0000000-0000-0000-0000-000000000100',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '1 day',
   'a0000000-0000-0000-0000-000000000010'),

  -- Audiência próxima semana
  ('a0000000-0000-0000-0000-000000000301',
   'a0000000-0000-0000-0000-000000000001',
   'audiencia', 'Audiência de Instrução — Costa vs. Horizonte',
   '1ª Vara do Trabalho de Campinas. Confirmar presença das testemunhas.',
   'a_fazer', 'alta',
   'a0000000-0000-0000-0000-000000000103',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '7 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Tarefa em andamento
  ('a0000000-0000-0000-0000-000000000302',
   'a0000000-0000-0000-0000-000000000001',
   'tarefa', 'Elaborar minuta de acordo — Santos vs. Tecnologia Futura',
   'Proposta de acordo: R$ 55.000,00 em 3x. Aguardando aprovação do cliente.',
   'em_andamento', 'alta',
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '5 days',
   'a0000000-0000-0000-0000-000000000011'),

  -- Prazo processual — próximos 10 dias
  ('a0000000-0000-0000-0000-000000000303',
   'a0000000-0000-0000-0000-000000000001',
   'prazo_processual', 'Memorial de Alegações Finais — Horizonte vs. Fornecedora ABC',
   'Prazo final para apresentação das alegações finais. Reunir documentos fiscais.',
   'a_fazer', 'alta',
   'a0000000-0000-0000-0000-000000000102',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '10 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Reunião com cliente
  ('a0000000-0000-0000-0000-000000000304',
   'a0000000-0000-0000-0000-000000000001',
   'reuniao', 'Reunião de alinhamento — Tecnologia Futura',
   'Apresentar balanço trimestral dos processos. Confirmar estratégia para 2 execuções pendentes.',
   'a_fazer', 'media',
   NULL,
   'a0000000-0000-0000-0000-000000000010',
   CURRENT_DATE + INTERVAL '3 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Tarefa concluída
  ('a0000000-0000-0000-0000-000000000305',
   'a0000000-0000-0000-0000-000000000001',
   'tarefa', 'Protocolar recursos trabalhistas — lote de maio',
   'Protocolo realizado via PJe. 3 recursos protocolados com sucesso.',
   'concluida', 'alta',
   NULL,
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE - INTERVAL '2 days',
   'a0000000-0000-0000-0000-000000000011'),

  -- Prazo de recurso
  ('a0000000-0000-0000-0000-000000000306',
   'a0000000-0000-0000-0000-000000000001',
   'prazo_processual', 'Prazo para interposição de embargos — Lima vs. Tecnologia Futura',
   'Verificar viabilidade dos embargos de declaração. Decisão recebida em 15/05.',
   'a_fazer', 'urgente',
   'a0000000-0000-0000-0000-000000000107',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '2 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Tarefa de baixa prioridade
  ('a0000000-0000-0000-0000-000000000307',
   'a0000000-0000-0000-0000-000000000001',
   'tarefa', 'Organizar documentos físicos — Processo Rodrigues',
   'Digitalizar e arquivar expedientes do processo encerrado.',
   'a_fazer', 'baixa',
   'a0000000-0000-0000-0000-000000000104',
   'a0000000-0000-0000-0000-000000000012',
   CURRENT_DATE + INTERVAL '30 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Audiência passada (concluída)
  ('a0000000-0000-0000-0000-000000000308',
   'a0000000-0000-0000-0000-000000000001',
   'audiencia', 'Audiência Inicial — Mendonça vs. Seguradora Sul',
   'Audiência realizada. Conciliação frustrada. Prosseguimento com instrução.',
   'concluida', 'alta',
   'a0000000-0000-0000-0000-000000000105',
   'a0000000-0000-0000-0000-000000000010',
   CURRENT_DATE - INTERVAL '15 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Prazo próximo mês
  ('a0000000-0000-0000-0000-000000000309',
   'a0000000-0000-0000-0000-000000000001',
   'prazo_processual', 'Impugnação ao laudo pericial — Mendonça vs. Seguradora Sul',
   'Prazo de 15 dias após publicação do laudo. Aguardar intimação.',
   'a_fazer', 'media',
   'a0000000-0000-0000-0000-000000000105',
   'a0000000-0000-0000-0000-000000000010',
   CURRENT_DATE + INTERVAL '20 days',
   'a0000000-0000-0000-0000-000000000010');


-- =============================================================================
-- 7. FINANCEIRO
-- =============================================================================
INSERT INTO public.financeiro_lancamentos (
  id, escritorio_id, cliente_id, processo_id, contrato_id,
  tipo, descricao, valor_bruto, data_vencimento, data_pagamento,
  forma_pagamento, status, criado_por
)
VALUES
  -- Honorário pago
  ('a0000000-0000-0000-0000-000000000400',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020', NULL,
   'a0000000-0000-0000-0000-000000000200',
   'honorario', 'Honorários mensais — maio/2026 — Tecnologia Futura',
   8500.00, '2026-05-10', '2026-05-09', 'pix', 'pago',
   'a0000000-0000-0000-0000-000000000010'),

  -- Honorário pendente
  ('a0000000-0000-0000-0000-000000000401',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021', NULL,
   'a0000000-0000-0000-0000-000000000201',
   'honorario', 'Honorários mensais — maio/2026 — Construções Horizonte',
   6200.00, '2026-05-15', NULL, NULL, 'pendente',
   'a0000000-0000-0000-0000-000000000010'),

  -- Despesa (custas processuais)
  ('a0000000-0000-0000-0000-000000000402',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000101',
   NULL,
   'custas', 'Custas de execução — depósito judicial (Santos vs. Tecnologia Futura)',
   3200.00, '2026-05-20', NULL, NULL, 'pendente',
   'a0000000-0000-0000-0000-000000000011'),

  -- Acordo recebido
  ('a0000000-0000-0000-0000-000000000403',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000104',
   NULL,
   'acordo', 'Acordo homologado — Rodrigues vs. Tecnologia Futura',
   28000.00, '2025-11-30', '2025-11-28', 'transferencia', 'pago',
   'a0000000-0000-0000-0000-000000000011'),

  -- Honorário atrasado
  ('a0000000-0000-0000-0000-000000000404',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000022',
   NULL,
   'a0000000-0000-0000-0000-000000000202',
   'honorario', 'Honorários — Roberto Mendonça (parcela 2/3)',
   4000.00, '2026-04-30', NULL, NULL, 'atrasado',
   'a0000000-0000-0000-0000-000000000010');


-- =============================================================================
-- 8. ANDAMENTOS PROCESSUAIS PUSH (demo do módulo de monitoramento)
-- =============================================================================
INSERT INTO public.andamentos_processuais_push (
  id, escritorio_id, cliente_id, processo_id,
  numero_processo, tribunal, movimento, data_movimento,
  fonte, remetente, assunto_email, corpo_resumo,
  raw_text_hash, status_associacao, criado_em
)
VALUES
  -- Associado — vinculado ao processo TRT2
  ('a0000000-0000-0000-0000-000000000500',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000100',
   '0001234-56.2024.5.02.0038', 'TRT2',
   'Intimação eletrônica',
   '2026-05-19',
   'email', 'liderdiarios@liderdiarios.com.br',
   'Fwd: Public 2. UFs 2. (38.12345678)',
   'PROCESSO: 0001234-56.2024.5.02.0038 — INTIMACAO. Fica V. Sa. intimado para tomar ciencia do despacho proferido nos autos. Prazo de 5 dias para manifestacao.',
   'demo_hash_001', 'associado', now() - INTERVAL '1 day'),

  -- Associado — execução
  ('a0000000-0000-0000-0000-000000000501',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000101',
   '0009821-14.2022.5.02.0301', 'TRT2',
   'Publicação no Diário de Justiça',
   '2026-05-20',
   'email', 'liderdiarios@liderdiarios.com.br',
   'Fwd: Public 4. UFs 4. (42.90856571)',
   'PROCESSO: 0009821-14.2022.5.02.0301 — Penhora online realizada via BACENJUD. Saldo bloqueado: R$ 12.450,00. Manifestacao em 5 dias.',
   'demo_hash_002', 'associado', now() - INTERVAL '2 hours'),

  -- Pendente — processo de terceiro capturado por coincidência de nome
  ('a0000000-0000-0000-0000-000000000502',
   'a0000000-0000-0000-0000-000000000001',
   NULL, NULL,
   '0001033-02.2025.5.11.0007', 'TRT11',
   'Intimação eletrônica',
   '2026-05-19',
   'email', 'liderdiarios@liderdiarios.com.br',
   'Fwd: Public 4. UFs 4. (42.90856571)',
   'PROCESSO: 0001033-02.2025.5.11.0007 — POLO PASSIVO: FLEX CALL TECNOLOGIA LTDA - ME. Intimacao para apresentar nova minuta de acordo. Processo nao localizado na base do escritorio.',
   'demo_hash_003', 'pendente', now() - INTERVAL '2 hours'),

  -- Pendente — novo processo ainda não cadastrado
  ('a0000000-0000-0000-0000-000000000503',
   'a0000000-0000-0000-0000-000000000001',
   NULL, NULL,
   '0002278-91.2026.5.02.0055', 'TRT2',
   'Publicação no Diário de Justiça',
   '2026-05-21',
   'email', 'liderdiarios@liderdiarios.com.br',
   'Fwd: Public 1. UFs 1. (55.20262278)',
   'PROCESSO: 0002278-91.2026.5.02.0055 — Nova acao distribuida. RECLAMADO: TECNOLOGIA FUTURA S.A. Acao trabalhista rito sumario. Reclamante: Jose Oliveira Neto.',
   'demo_hash_004', 'pendente', now() - INTERVAL '30 minutes');


-- =============================================================================
-- Conclusão
-- =============================================================================
DO $$ BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Seed demo aplicado com sucesso.';
  RAISE NOTICE '';
  RAISE NOTICE 'Acesse com:';
  RAISE NOTICE '  gerente@jurisbpo-demo.com   /  Demo@2026!';
  RAISE NOTICE '  advogado@jurisbpo-demo.com  /  Demo@2026!';
  RAISE NOTICE '  estagiario@jurisbpo-demo.com / Demo@2026!';
  RAISE NOTICE '==============================================';
END $$;
