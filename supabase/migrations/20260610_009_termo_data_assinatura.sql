-- Adiciona data_assinatura em termos_unidade para registrar a data real de
-- assinatura do termo, separada de anexado_em (quando o arquivo foi enviado).
-- Usado em auditorias sem alterar a timeline operacional da unidade.
ALTER TABLE termos_unidade
  ADD COLUMN IF NOT EXISTS data_assinatura DATE NULL;
