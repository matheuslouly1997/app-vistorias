-- =====================================================================
-- Migration: gestao de usuarios via app
-- Data: 2026-05-16
--   1) Expande papeis globais e por obra com os papeis operacionais novos
--   2) Adiciona coluna ultimo_login em perfis
--   3) Mantem compatibilidade com papeis antigos (escritorio/obra/visualizador)
-- =====================================================================

-- 1) Papel global (perfis.papel)
alter table perfis drop constraint if exists perfis_papel_check;
alter table perfis add constraint perfis_papel_check check (
  papel in (
    'administrador',
    'gestor',
    'atendimento',
    'engenharia',
    'vistoria',
    'leitura',
    -- compat com schema v2 antigo
    'escritorio',
    'obra',
    'visualizador'
  )
);

-- 2) Papel por obra (perfis_obras.papel_obra)
alter table perfis_obras drop constraint if exists perfis_obras_papel_obra_check;
alter table perfis_obras add constraint perfis_obras_papel_obra_check check (
  papel_obra in (
    'administrador_obra',
    'engenharia',
    'vistoria',
    'atendimento',
    'leitura',
    -- compat
    'administrador',
    'escritorio',
    'obra',
    'visualizador'
  )
);

-- 3) ultimo_login (atualizado pelo app ou via trigger no auth.users — fica nullable)
alter table perfis add column if not exists ultimo_login timestamptz;

-- 4) Garantir que helpers RLS continuam funcionando.
--    is_admin_global() ja existe e checa papel='administrador' — sem mudancas.
--    Adiciono helper opcional para checar papel especifico na obra.
create or replace function tem_qualquer_papel_obra(p_obra_id uuid, p_papeis text[])
returns boolean
language sql stable
as $$
  select exists (
    select 1 from perfis_obras
    where perfil_id = auth.uid()
      and obra_id   = p_obra_id
      and papel_obra = any(p_papeis)
  );
$$;
