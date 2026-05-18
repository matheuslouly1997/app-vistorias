# App Vistorias — Fase 1

Frontend Next.js do app operacional de vistorias.

## Pre-requisitos

- Node.js 18.18+ (recomendo 20.x LTS)
- npm
- Projeto Supabase com o schema v2 ja aplicado (ver `outputs/SQL_V2_SCHEMA.md`)
- Usuario admin criado no Supabase (Authentication + INSERT em `perfis` + `perfis_obras`)

## Setup local

```bash
cd app-vistorias
cp .env.local.example .env.local
# Edite .env.local com suas credenciais
npm install
npm run dev
```

Abra http://localhost:3000.

## Variaveis de ambiente

Em `.env.local` (uma variavel por linha):

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxx
```

Aceita os dois formatos:
- `sb_publishable_...` (padrao novo, 2025+)
- `eyJhbGci...` (JWT anon legado)

A `service_role` (`sb_secret_...` ou JWT de service) NUNCA vai aqui.

**Apos editar `.env.local`, reinicie `npm run dev`.** Next.js le envs no startup.

### Diagnostico (se der "Failed to fetch")

Abra `http://localhost:3000/diagnostico`. Mostra:
- presenca das envs (so prefixo+sufixo das keys, nunca a key completa)
- formato detectado (sb_publishable / jwt-legado / sb_secret / desconhecido)
- botao "Rodar teste" que chama o endpoint publico do seu projeto e reporta o erro real

## Habilitar Realtime no Supabase

Para o Mapa Operacional atualizar ao vivo quando outro usuario mudar um status:

1. Painel do Supabase → **Database → Replication** (ou **Realtime**).
2. Encontre a tabela `unidades`.
3. Marque "**Enable replication**" (ou similar — UI varia entre versoes).

Sem isso, o mapa funciona normalmente mas precisa de refresh manual para refletir mudancas externas.

## Estrutura

```
src/
  app/
    login/                       login (email + senha)
    auth/callback/               handler magic link (opcional)
    logout/                      POST -> sign out
    (app)/                       grupo autenticado (middleware redireciona)
      layout.tsx                 header com nome + sair
      obras/
        page.tsx                 lista de obras + nova obra
        nova-obra-form.tsx
        actions.ts
        [obraId]/
          layout.tsx             tabs (Mapa, Torres, Clientes, Agenda, Aprovacao)
          mapa/                  MAPA OPERACIONAL (server + client + realtime + painel)
          torres/                CRUD torres com editor de layout_codigos
          clientes/              CRUD clientes
          agenda/                criar/concluir/cancelar agendas
          aprovacao/             KPIs (oficial historico + visao do mapa)
  lib/
    supabase/client.ts           cliente browser
    supabase/server.ts           cliente server (cookies)
    supabase/middleware.ts       helper de sessao no middleware
    types/database.ts            tipos do schema v2
    constants/status.ts          labels, cores, transicoes
middleware.ts                    redireciona nao autenticados pra /login
```

## Fluxo de status (resumo)

Bloco de obra (manual, sem agenda):
- `em_obra ↔ em_correcao → finalizada_obra`

Bloco de cliente (via Agenda):
- `finalizada_obra → agendado` (cria vistoria_1a)
- `agendado → aprovada_1a` (concluir aprovada)
- `agendado → reprovada` (concluir reprovada)
- `reprovada → revistoria` (cria revistoria)
- `revistoria → aprovada_2a_mais` (concluir aprovada)
- `revistoria → reprovada` (concluir reprovada novamente — loop)
- `aprovada_1a | aprovada_2a_mais → entregue` (botao no painel da unidade)

## Comandos uteis

```bash
npm run dev        # dev server com hot reload
npm run typecheck  # tsc --noEmit
npm run build      # build de producao
npm start          # roda build em producao
npm run lint       # eslint
```

## Deploy

A maneira mais simples e Vercel:

1. Suba o repositorio para o GitHub.
2. Em vercel.com → New Project → importa o repo.
3. Em Environment Variables, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy.

## Proximos passos sugeridos (apos Fase 1)

- Dashboard consolidado da empresa (todas as obras)
- Permissoes por papel mais granulares no UI
- Exportacao Excel/PDF
- Notificacoes por email quando vistoria for agendada
- PWA mobile
