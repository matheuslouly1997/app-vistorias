-- =====================================================================
-- Migration: restaura GRANTs da role service_role no schema public
-- Data: 2026-05-28
--
-- Sintoma: operacoes admin do app (createAdminClient -> service_role)
-- falhavam com "permission denied for table <x>" (Postgres 42501) em
-- TODAS as tabelas. Ex.: criar usuario -> "Auth criado mas perfil falhou".
--
-- Causa: a role service_role estava sem privilegios no schema public
-- (grants ausentes/revogados). O app normal funcionava por usar a role
-- authenticated via RLS; apenas a service_role estava sem acesso.
--
-- Correcao: concede acesso total a service_role e garante que objetos
-- futuros tambem fiquem acessiveis (default privileges).
-- service_role ja possui BYPASSRLS no Supabase, entao isso basta.
-- =====================================================================

grant usage on schema public to service_role;

grant all privileges on all tables    in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

alter default privileges in schema public
  grant all on tables    to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;
