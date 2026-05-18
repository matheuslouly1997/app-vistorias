-- =====================================================================
-- Migration: otimizacao de performance + Supabase Realtime
-- Data: 2026-05-18
--   1) Indices nas 4 areas criticas: unidades, agenda, clientes, torres
--   2) Habilita Realtime nas tabelas alvo
-- =====================================================================

-- -----------------------------------------------------------------------
-- 1. INDICES — unidades
--    A maioria das queries filtra por obra_id. Compostos cobrem filtros
--    frequentes (status, torre_id, cliente_atual_id).
-- -----------------------------------------------------------------------
create index if not exists idx_unidades_obra_id
  on unidades(obra_id);

create index if not exists idx_unidades_obra_status
  on unidades(obra_id, status);

create index if not exists idx_unidades_torre_id
  on unidades(torre_id);

-- Partial index: so indexa unidades que tem cliente vinculado
create index if not exists idx_unidades_cliente_atual
  on unidades(cliente_atual_id)
  where cliente_atual_id is not null;

-- -----------------------------------------------------------------------
-- 2. INDICES — agenda
-- -----------------------------------------------------------------------
create index if not exists idx_agenda_obra_id
  on agenda(obra_id);

-- Cobre queries de agenda por periodo (order/filter em data_agendada)
create index if not exists idx_agenda_obra_data
  on agenda(obra_id, data_agendada);

-- Cobre queries de agenda por status (agendadas em aberto)
create index if not exists idx_agenda_obra_status
  on agenda(obra_id, status_agenda);

-- Cobre lookup de agenda por unidade (painel da unidade no mapa)
create index if not exists idx_agenda_unidade_id
  on agenda(unidade_id);

-- Partial index: historico por cliente
create index if not exists idx_agenda_cliente_id
  on agenda(cliente_id)
  where cliente_id is not null;

-- -----------------------------------------------------------------------
-- 3. INDICES — clientes
-- -----------------------------------------------------------------------
create index if not exists idx_clientes_obra_id
  on clientes(obra_id);

-- Cobre queries ordenadas por nome dentro de uma obra
create index if not exists idx_clientes_obra_nome
  on clientes(obra_id, nome);

-- -----------------------------------------------------------------------
-- 4. INDICES — torres
-- -----------------------------------------------------------------------
create index if not exists idx_torres_obra_id
  on torres(obra_id);

-- -----------------------------------------------------------------------
-- 5. REALTIME — habilitar publicacao nas tabelas alvo
--    Usa bloco DO para nao falhar se a tabela ja estiver na publicacao.
-- -----------------------------------------------------------------------
do $$
begin
  -- unidades
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'unidades'
  ) then
    alter publication supabase_realtime add table unidades;
  end if;

  -- agenda
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'agenda'
  ) then
    alter publication supabase_realtime add table agenda;
  end if;

  -- clientes
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'clientes'
  ) then
    alter publication supabase_realtime add table clientes;
  end if;

  -- torres (necessario para o mapa caso torres sejam alteradas)
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'torres'
  ) then
    alter publication supabase_realtime add table torres;
  end if;
end $$;

-- -----------------------------------------------------------------------
-- 6. NOTA SOBRE RLS
--    As politicas de RLS devem usar as colunas indexadas acima para
--    garantir que o planner use os indices. Verifique que todas as
--    politicas em unidades/agenda/clientes filtram por obra_id usando
--    subquery em perfis_obras (ja indexada por perfil_id + obra_id).
--    Exemplo de politica eficiente:
--
--    create policy "leitura_unidades" on unidades
--      for select using (
--        obra_id in (
--          select obra_id from perfis_obras
--          where perfil_id = auth.uid()
--        )
--        or exists (select 1 from perfis where id = auth.uid() and papel = 'administrador')
--      );
-- -----------------------------------------------------------------------
