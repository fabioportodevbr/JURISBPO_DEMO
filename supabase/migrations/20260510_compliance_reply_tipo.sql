-- Adiciona tipo resposta_diligencia à tabela compliance_mensagens
ALTER TABLE compliance_mensagens
  DROP CONSTRAINT IF EXISTS compliance_mensagens_tipo_check;

ALTER TABLE compliance_mensagens
  ADD CONSTRAINT compliance_mensagens_tipo_check
  CHECK (tipo IN ('recebida','auto_resposta','officer_reply','diligencia','interna','resposta_diligencia'));
