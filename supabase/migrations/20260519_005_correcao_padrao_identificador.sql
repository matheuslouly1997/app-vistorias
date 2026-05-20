-- =====================================================================
-- Migration: correcao do padrao de identificador de unidades
-- Data: 2026-05-19
--
-- PROBLEMA:  A-091A  (torre A | pav 09 | unidade 1A — numero sem padding)
-- CORRECAO:  A-0901A (torre A | pav 09 | unidade 01A — numero com 2 digitos)
--
-- REGRA:  identificador = TORRE || '-' || PAVIMENTO(2d) || NUMERO_UNIDADE(2d) || LETRA
-- Exemplos:
--   Torre A | Pav 09 | 1A  →  A-0901A
--   Torre A | Pav 09 | 4B  →  A-0904B
--   Torre B | Pav 15 | 2A  →  B-1502A
--   Torre B | Pav 01 | 1B  →  B-0101B
--
-- ARQUITETURA PRESERVADA (nomes reais do schema):
--   funcao principal : gerar_unidades_da_torre(p_torre_id uuid)
--   funcao trigger   : trg_gerar_unidades_da_torre()          — NAO ALTERADA
--   trigger insert   : tr_torres_after_insert                 — NAO ALTERADO
--   trigger update   : tr_torres_after_update                 — NAO ALTERADO
--
-- O QUE ESTA MIGRATION FAZ:
--   1. Cria funcao helper  calcular_identificador(text, int, text)
--   2. Atualiza unidades.identificador em todos os registros existentes
--   3. Recria gerar_unidades_da_torre usando calcular_identificador
--   4. Valida: inconsistentes = 0 apos migracao
--
-- SEGURANCA:
--   - So o campo 'identificador' e tocado nos dados existentes
--   - status, cliente_atual_id, agenda, historico_status, KPIs: intactos
--   - ON CONFLICT DO UPDATE garante que unidades existentes perdem apenas
--     o identificador errado — todos os outros campos ficam inalterados
--   - Idempotente: pode ser aplicada mais de uma vez sem efeito colateral
-- =====================================================================


-- =====================================================================
-- PASSO A — PREVIEW (execute apenas este bloco primeiro para confirmar)
--
-- Rode as queries abaixo separadamente no SQL Editor do Supabase.
-- Confirme o resultado antes de executar os passos B, C e D.
-- =====================================================================

-- A1. Contagem: total de unidades e quantas serao corrigidas
select
  count(*)                                          as total_unidades,
  count(*) filter (
    where u.identificador <>
          t.nome
          || '-'
          || lpad(u.pavimento::text, 2, '0')
          || lpad(regexp_replace(u.codigo_unidade, '[^0-9]', '', 'g'), 2, '0')
          || regexp_replace(u.codigo_unidade, '[0-9]', '', 'g')
  )                                                 as serao_corrigidas,
  count(*) filter (
    where u.identificador =
          t.nome
          || '-'
          || lpad(u.pavimento::text, 2, '0')
          || lpad(regexp_replace(u.codigo_unidade, '[^0-9]', '', 'g'), 2, '0')
          || regexp_replace(u.codigo_unidade, '[0-9]', '', 'g')
  )                                                 as ja_corretas
from unidades u
join torres   t on t.id = u.torre_id;

-- A2. Exemplos antes/depois — primeiras 20 unidades por torre e pavimento
select
  t.nome                                            as torre,
  lpad(u.pavimento::text, 2, '0')                   as pav,
  u.codigo_unidade,
  u.identificador                                   as antes,
  t.nome
    || '-'
    || lpad(u.pavimento::text, 2, '0')
    || lpad(regexp_replace(u.codigo_unidade, '[^0-9]', '', 'g'), 2, '0')
    || regexp_replace(u.codigo_unidade, '[0-9]', '', 'g')
                                                    as depois,
  u.status
from unidades u
join torres   t on t.id = u.torre_id
order by t.nome, u.pavimento, u.codigo_unidade
limit 20;


-- =====================================================================
-- PASSO B — FUNCAO HELPER
--
-- calcular_identificador(torre_nome, pavimento, codigo_unidade)
-- Imutavel, reutilizavel por gerar_unidades_da_torre e pela validacao.
-- =====================================================================

create or replace function calcular_identificador(
  p_torre_nome     text,
  p_pavimento      integer,
  p_codigo_unidade text      -- ex: '1A', '4B', '12C'
)
returns text
language sql
immutable
parallel safe
as $$
  -- Separa o numero do codigo, aplica lpad(2), reune com a letra.
  -- '1A'  → numero='1'  → lpad='01' → letra='A'  → resultado='01A'
  -- '12C' → numero='12' → lpad='12' → letra='C'  → resultado='12C'
  select
    p_torre_nome
    || '-'
    || lpad(p_pavimento::text, 2, '0')
    || lpad(
         regexp_replace(p_codigo_unidade, '[^0-9]', '', 'g'),
         2, '0'
       )
    || regexp_replace(p_codigo_unidade, '[0-9]', '', 'g')
$$;


-- =====================================================================
-- PASSO C — CORRIGIR DADOS EXISTENTES
--
-- Atualiza unidades.identificador para todas as linhas.
-- So o campo 'identificador' e modificado; todos os demais campos
-- (status, cliente_atual_id, observacoes, etc.) permanecem intactos.
-- =====================================================================

update unidades u
set    identificador = calcular_identificador(t.nome, u.pavimento, u.codigo_unidade)
from   torres t
where  u.torre_id = t.id;


-- =====================================================================
-- PASSO D — RECRIAR gerar_unidades_da_torre(p_torre_id uuid)
--
-- Esta e a unica funcao alterada. Os triggers tr_torres_after_insert e
-- tr_torres_after_update chamam trg_gerar_unidades_da_torre(), que por
-- sua vez chama gerar_unidades_da_torre(new.id). Apenas a logica interna
-- desta funcao muda — a assinatura, os triggers e o wrapper do trigger
-- permanecem identicos ao schema atual.
--
-- Comportamento por cenario:
--   INSERT de nova torre  → insere todas as unidades com status 'em_obra'
--   UPDATE de torre       → atualiza identificador das unidades existentes
--                           sem tocar em status, cliente, agenda ou historico;
--                           insere unidades novas (novos codigos/pavimentos)
--                           com status 'em_obra'
--
-- A clausula ON CONFLICT garante que unidades ja existentes nao sao
-- recriadas — apenas o identificador e corrigido.
-- =====================================================================

drop function if exists gerar_unidades_da_torre(uuid);

create or replace function gerar_unidades_da_torre(p_torre_id uuid)
returns void
language plpgsql
as $$
declare
  v_torre   record;
  v_pav     integer;
  v_codigo  text;
begin
  -- Carrega dados da torre uma unica vez
  select id, obra_id, nome, qtd_pavimentos, layout_codigos
  into   v_torre
  from   torres
  where  id = p_torre_id;

  if not found then
    raise exception 'Torre nao encontrada: %', p_torre_id;
  end if;

  -- Percorre todos os pavimentos e codigos de layout
  for v_pav in 1..v_torre.qtd_pavimentos loop
    foreach v_codigo in array v_torre.layout_codigos loop

      insert into unidades (
        obra_id,
        torre_id,
        pavimento,
        codigo_unidade,
        identificador,
        status
      )
      values (
        v_torre.obra_id,
        v_torre.id,
        v_pav,
        v_codigo,
        calcular_identificador(v_torre.nome, v_pav, v_codigo),
        'em_obra'
      )
      -- Unidade ja existe: apenas atualiza o identificador.
      -- status, cliente_atual_id, observacoes e demais campos: intactos.
      on conflict (torre_id, pavimento, codigo_unidade)
        do update set identificador = excluded.identificador;

    end loop;
  end loop;
end;
$$;


-- =====================================================================
-- PASSO E — VALIDACAO POS-MIGRACAO
--
-- Conta unidades cujo identificador ainda diverge da formula correta.
-- Resultado esperado: 0. Se for > 0, a migracao lancha um erro explicito.
-- =====================================================================

do $$
declare
  v_inconsistentes integer;
begin
  select count(*)
  into   v_inconsistentes
  from   unidades u
  join   torres   t on t.id = u.torre_id
  where  u.identificador <>
         calcular_identificador(t.nome, u.pavimento, u.codigo_unidade);

  if v_inconsistentes > 0 then
    raise exception
      'FALHA POS-MIGRACAO: % unidade(s) com identificador incorreto. Reverta e investigue.',
      v_inconsistentes;
  else
    raise notice 'OK — % identificadores corrigidos. Nenhuma inconsistencia.',
      (select count(*) from unidades);
  end if;
end $$;
