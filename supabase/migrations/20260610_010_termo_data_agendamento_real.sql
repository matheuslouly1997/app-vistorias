-- Coluna para corrigir a data de agendamento do termo sem alterar agenda real
ALTER TABLE termos_unidade
  ADD COLUMN IF NOT EXISTS data_agendamento_real DATE NULL;
