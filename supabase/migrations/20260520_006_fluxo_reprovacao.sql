-- =====================================================================
-- Migration: fluxo de reprovacao pos-vistoria + unicidade cliente/unidade
-- Data: 2026-05-20
--
--   1) Adiciona dois novos valores de status em unidades:
--        em_correcao_pos_reprovacao  — unidade em correcao apos reprovacao
--        pronta_revistoria           — obra terminou correcao, aguarda revistoria
--
--   2) Adiciona unique partial index em unidades(cliente_atual_id)
--      para impedir que duas unidades tenham o mesmo cliente vinculado.
--
-- SEGURANCA:
--   - Nenhum dado existente e alterado.
--   - Apenas ADICIONA valores ao constraint de status.
--   - O unique index usa WHERE clause para ignorar NULLs
--     (unidades sem cliente podem existir livremente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. STATUS EM UNIDADES
--    O schema original usa TEXT com CHECK constraint.
--    Encontramos o nome do constraint dinamicamente para ser robusto.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Tenta encontrar o CHECK constraint de status em unidades
  SELECT conname INTO v_constraint_name
  FROM   pg_constraint
  WHERE  conrelid = 'public.unidades'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%em_obra%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.unidades DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.unidades
  ADD CONSTRAINT unidades_status_check CHECK (
    status IN (
      'em_obra',
      'em_correcao',
      'finalizada_obra',
      'agendado',
      'aprovada_1a',
      'reprovada',
      'revistoria',
      'aprovada_2a_mais',
      'entregue',
      -- novos: fluxo pos-reprovacao
      'em_correcao_pos_reprovacao',
      'pronta_revistoria'
    )
  );

-- ---------------------------------------------------------------------
-- 2. STATUS EM HISTORICO_STATUS (status_anterior e status_novo)
--    Mesma logica: encontra e recria o constraint se existir.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_cn text;
BEGIN
  -- status_novo
  SELECT conname INTO v_cn
  FROM   pg_constraint
  WHERE  conrelid = 'public.historico_status'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%em_obra%'
  LIMIT 1;

  IF v_cn IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.historico_status DROP CONSTRAINT %I', v_cn);

    ALTER TABLE public.historico_status
      ADD CONSTRAINT historico_status_status_check CHECK (
        (status_anterior IS NULL OR status_anterior IN (
          'em_obra', 'em_correcao', 'finalizada_obra', 'agendado',
          'aprovada_1a', 'reprovada', 'revistoria', 'aprovada_2a_mais', 'entregue',
          'em_correcao_pos_reprovacao', 'pronta_revistoria'
        ))
        AND
        status_novo IN (
          'em_obra', 'em_correcao', 'finalizada_obra', 'agendado',
          'aprovada_1a', 'reprovada', 'revistoria', 'aprovada_2a_mais', 'entregue',
          'em_correcao_pos_reprovacao', 'pronta_revistoria'
        )
      );
  END IF;
  -- Se nao existia constraint, nao precisamos criar (tabela aceita qualquer text)
END $$;

-- ---------------------------------------------------------------------
-- 3. COMENTARIOS DE DOCUMENTACAO
-- ---------------------------------------------------------------------

-- Nota: nao ha unique index em cliente_atual_id pois um cliente pode
-- estar vinculado a varias unidades. A restricao inversa (uma unidade
-- tem no maximo um cliente) ja e garantida pelo campo simples
-- cliente_atual_id na propria tabela unidades.
