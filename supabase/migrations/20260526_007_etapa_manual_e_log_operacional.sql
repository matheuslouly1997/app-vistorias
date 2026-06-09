-- =====================================================================
-- Migration: alteracao manual de etapa + log operacional rastreavel
-- Data: 2026-05-26
--
-- OBJETIVO:
--   1) Permitir alterar etapa da unidade manualmente para QUALQUER status
--      (operadora pode corrigir erros sem ficar presa a state machine).
--   2) Permitir reverter para QUALQUER evento da timeline (nao so o ultimo).
--   3) Garantir que reset operacional NAO desvincula cliente.
--   4) Registrar origem da alteracao (acao, manual, reset, desfazer, sistema)
--      e motivo em todas as mudancas, para rastreabilidade completa.
--
-- COMPATIBILIDADE:
--   - Mantem o trigger atual de historico_status (inserido automaticamente
--     quando unidades.status muda). As RPCs apenas COMPLEMENTAM a linha
--     mais recente desse historico com motivo/origem/alterado_por.
--   - As actions antigas (aprovar, reprovar, etc.) continuam funcionando
--     sem mudanca; ganham apenas a possibilidade de passar 'motivo'.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COLUNA 'origem' em historico_status
-- ---------------------------------------------------------------------
alter table public.historico_status
  add column if not exists origem text not null default 'sistema';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.historico_status'::regclass
      and conname  = 'historico_status_origem_check'
  ) then
    alter table public.historico_status
      add constraint historico_status_origem_check
      check (origem in ('sistema', 'acao', 'manual', 'reset', 'desfazer', 'reverter'));
  end if;
end $$;

comment on column public.historico_status.origem is
  'Origem da alteracao: sistema (trigger), acao (botoes do fluxo), manual (alterar etapa), reset, desfazer, reverter';

-- ---------------------------------------------------------------------
-- 2. Helper: anota o ultimo evento de historico com motivo/origem/usuario
--    Usado por todas as RPCs operacionais abaixo.
-- ---------------------------------------------------------------------
create or replace function anotar_ultimo_historico(
  p_unidade_id uuid,
  p_motivo text,
  p_origem text,
  p_usuario uuid
)
returns void
language sql
as $$
  update historico_status
  set    motivo       = coalesce(p_motivo, motivo),
         origem       = p_origem,
         alterado_por = coalesce(p_usuario, alterado_por)
  where  id = (
    select id from historico_status
    where  unidade_id = p_unidade_id
    order  by alterado_em desc, id desc
    limit  1
  );
$$;

-- ---------------------------------------------------------------------
-- 3. RPC: alterar_status_manual
--    Forca uma transicao para QUALQUER status valido, sem validar
--    state machine. Cancela agendas abertas se sair de status agendado
--    para um nao-agendado. NAO mexe em cliente_atual_id.
-- ---------------------------------------------------------------------
create or replace function alterar_status_manual(
  p_unidade_id uuid,
  p_novo_status text,
  p_motivo text default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_status_atual text;
  v_uid uuid := auth.uid();
begin
  select status into v_status_atual
  from   unidades where id = p_unidade_id for update;

  if v_status_atual is null then
    raise exception 'Unidade nao encontrada: %', p_unidade_id;
  end if;
  if v_status_atual = p_novo_status then
    return;  -- nada a fazer
  end if;

  -- Se sair de status com agenda ativa para um status fora do fluxo
  -- de vistoria, cancela agendas em aberto.
  if v_status_atual in ('agendado', 'revistoria')
     and p_novo_status not in ('agendado', 'revistoria',
                               'aprovada_1a', 'aprovada_2a_mais', 'reprovada') then
    update agenda
       set status_agenda = 'cancelada',
           observacoes   = coalesce(observacoes, '') ||
             case when observacoes is null or observacoes = '' then '' else ' | ' end ||
             '[cancelada por alteracao manual de etapa]'
     where unidade_id = p_unidade_id
       and status_agenda = 'agendada';
  end if;

  update unidades set status = p_novo_status where id = p_unidade_id;

  perform anotar_ultimo_historico(p_unidade_id, p_motivo, 'manual', v_uid);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RPC: reverter_para_evento
--    Reverte a unidade para o STATUS_ANTERIOR de um evento especifico
--    da timeline (nao apenas o ultimo). Util quando o usuario quer
--    "voltar" para um ponto especifico.
-- ---------------------------------------------------------------------
create or replace function reverter_para_evento(
  p_unidade_id uuid,
  p_historico_id bigint,
  p_motivo text default null
)
returns text  -- retorna o status alvo
language plpgsql
security invoker
as $$
declare
  v_alvo text;
  v_uid  uuid := auth.uid();
  v_unid uuid;
begin
  select unidade_id, status_anterior
    into v_unid, v_alvo
  from   historico_status
  where  id = p_historico_id;

  if v_unid is null then
    raise exception 'Evento de historico nao encontrado: %', p_historico_id;
  end if;
  if v_unid <> p_unidade_id then
    raise exception 'Evento nao pertence a esta unidade.';
  end if;
  if v_alvo is null then
    raise exception 'Esse evento e o status inicial e nao pode ser revertido.';
  end if;

  update unidades set status = v_alvo where id = p_unidade_id;

  perform anotar_ultimo_historico(p_unidade_id, p_motivo, 'reverter', v_uid);

  return v_alvo;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC: resetar_operacional
--    Reset CORRETO: cancela agendas, zera status para em_obra.
--    NAO toca em cliente_atual_id (cliente continua vinculado).
-- ---------------------------------------------------------------------
create or replace function resetar_operacional(
  p_unidade_id uuid,
  p_motivo text default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  select status into v_status from unidades where id = p_unidade_id for update;
  if v_status is null then
    raise exception 'Unidade nao encontrada.';
  end if;

  update agenda
     set status_agenda = 'cancelada',
         observacoes   = coalesce(observacoes, '') ||
           case when observacoes is null or observacoes = '' then '' else ' | ' end ||
           '[cancelada por reset operacional]'
   where unidade_id = p_unidade_id
     and status_agenda = 'agendada';

  if v_status <> 'em_obra' then
    update unidades set status = 'em_obra' where id = p_unidade_id;
    perform anotar_ultimo_historico(
      p_unidade_id,
      coalesce(p_motivo, 'Reset operacional'),
      'reset',
      v_uid
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RPC: anotar_motivo_acao
--    Permite que as actions atuais (aprovar, reprovar, etc.) gravem
--    motivo + origem='acao' + alterado_por sem precisar refatorar
--    cada uma. Chamada logo apos UPDATE em unidades.status.
-- ---------------------------------------------------------------------
create or replace function anotar_motivo_acao(
  p_unidade_id uuid,
  p_motivo text default null
)
returns void
language plpgsql
security invoker
as $$
begin
  perform anotar_ultimo_historico(p_unidade_id, p_motivo, 'acao', auth.uid());
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Garantir que historico_status esta na publicacao Realtime
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'historico_status'
  ) then
    alter publication supabase_realtime add table historico_status;
  end if;
end $$;
