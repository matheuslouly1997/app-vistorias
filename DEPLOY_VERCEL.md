# Deploy na Vercel — guia passo a passo

## Pre-requisitos

- Conta no GitHub (gratuita).
- Conta na Vercel (vercel.com), pode logar com o GitHub.
- Projeto Supabase ja configurado (voce ja tem).
- Git instalado localmente.

---

## Etapa 1 — Confirmar que o build passa localmente

Antes de subir para o GitHub, garanta que o build limpo passa:

```powershell
cd C:\Projetos\app-vistorias
npm install
npm run build
```

Espere mensagens tipo:
```
✓ Compiled successfully
✓ Generating static pages
```

Se aparecer erro de tipo, ja deixei `typescript.ignoreBuildErrors: true` no
`next.config.mjs`, entao o build segue mesmo com warnings de tipo do supabase-js.
Erros que travem o build precisam ser corrigidos.

---

## Etapa 2 — Inicializar Git e subir para GitHub

### 2.1. Iniciar git no projeto

No PowerShell, na pasta do projeto:

```powershell
cd C:\Projetos\app-vistorias
git init
git add .
git status
```

Verifique que **NAO** aparece `.env.local` nem `node_modules` na lista
(o `.gitignore` ja exclui ambos).

### 2.2. Primeiro commit

```powershell
git commit -m "deploy: estado inicial"
```

Se for a primeira vez usando git nessa maquina, ele pode pedir nome/email:

```powershell
git config --global user.email "matheuslouly@gmail.com"
git config --global user.name "Matheus Louly"
```

### 2.3. Criar repositorio no GitHub

1. Acesse https://github.com/new
2. **Repository name**: `app-vistorias` (ou outro nome).
3. **Visibility**: **Private** (recomendado — codigo nao precisa ser publico).
4. **NAO** marque "Initialize with README" (ja temos).
5. Clique **Create repository**.

### 2.4. Conectar local ao GitHub

O GitHub mostra os comandos. Cole no PowerShell (substitua `SEU_USUARIO`):

```powershell
git remote add origin https://github.com/SEU_USUARIO/app-vistorias.git
git branch -M main
git push -u origin main
```

Vai pedir login do GitHub. Use seu usuario + um **Personal Access Token**
(ou GitHub CLI). Se nao tiver: GitHub → Settings → Developer settings →
Personal access tokens → Tokens (classic) → Generate new token (classic),
marque `repo` e copie o token.

Depois do push, o codigo esta no GitHub.

---

## Etapa 3 — Importar na Vercel

1. Acesse https://vercel.com e logue (com GitHub e mais facil).
2. Clique em **Add New** → **Project**.
3. Encontre o repositorio `app-vistorias` na lista e clique **Import**.
   (Se nao aparecer, clique em **Adjust GitHub App Permissions** e libere o repo.)
4. **Framework Preset**: Next.js (auto-detectado).
5. **Root Directory**: deixe `./` (raiz).
6. **Build Command**: `npm run build` (auto).
7. **Output Directory**: `.next` (auto).
8. **Install Command**: `npm install` (auto).

### 3.1. Variaveis de ambiente

Antes de clicar Deploy, expanda **Environment Variables** e adicione:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iwrjjtptsqdxaidzerde.supabase.co` (o seu) | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_yhYE...` (sua key anon/publishable) | Production, Preview, Development |

**Importante:**
- A(chave administrativa do Supabase) **NAO** vai aqui. Ela nunca vai pro frontend.
- Os nomes tem que comecar com `NEXT_PUBLIC_` para o Next expor no browser.
- Combinadas com RLS no Supabase, essas keys publicas sao seguras de expor.

### 3.2. Deploy

Clique em **Deploy**. A Vercel:
1. Clona o repo
2. Roda `npm install`
3. Roda `npm run build`
4. Sobe a aplicacao

Demora ~2 minutos. Quando terminar, voce ganha uma URL tipo:
`https://app-vistorias.vercel.app`

---

## Etapa 4 — Configurar Supabase para aceitar o dominio da Vercel

Para login funcionar com cookies corretos no dominio online:

1. Painel do Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: coloque a URL da Vercel, ex.:
   `https://app-vistorias.vercel.app`
3. **Redirect URLs**: adicione tambem:
   - `https://app-vistorias.vercel.app/**`
   - `https://app-vistorias.vercel.app/auth/callback`
4. Salve.

> Se voce trocar a URL da Vercel (custom domain), atualize esses campos.

---

## Etapa 5 — Validar o app online

1. Abra a URL do deploy.
2. Voce deve cair em `/login`.
3. Entre com seu usuario admin (`matheuslouly@gmail.com` + senha).
4. Apos login, lista de obras aparece, escolhe **Art Haus** → entra no
   Dashboard com KPIs e graficos.
5. Mapa Operacional deve carregar as 256 unidades.
6. Cliques em unidade abrem o painel lateral; alteracoes persistem
   (via RLS, sao escritas no Supabase).

Se algo nao funcionar:
- Abra `https://app-vistorias.vercel.app/diagnostico`. Deve mostrar as duas
  bolinhas verdes (URL e key carregadas) e o teste de conexao com sucesso.

---

## Etapa 6 — Como adicionar mais usuarios

Para outras pessoas usarem o app online:

### 6.1. Criar usuario no Supabase

1. Painel Supabase → **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Email e senha forte. **Marque** "Auto Confirm User".
3. Copie o **UUID** do usuario criado.

### 6.2. Adicionar a tabela `perfis` + vincular a obras

No SQL Editor:

```sql
-- Cria o perfil global (define papel: administrador, escritorio, obra, visualizador)
insert into perfis (id, nome, email, papel, ativo)
values ('<UUID>', 'Nome Completo', 'email@exemplo.com', 'escritorio', true);

-- Vincula a uma obra (papel_obra: administrador, escritorio, obra, visualizador)
insert into perfis_obras (perfil_id, obra_id, papel_obra)
select '<UUID>', id, 'escritorio'
from obras where nome = 'Art Haus';
```

Pronto. A pessoa pode logar com email/senha na URL da Vercel.

### 6.3. Papeis disponiveis

| Papel | Pode ver | Pode editar | Pode criar obras |
|-------|----------|-------------|------------------|
| `administrador` (global) | tudo | tudo | sim |
| `escritorio` (na obra) | a obra | unidades, agendas, clientes, torres | nao |
| `obra` (na obra) | a obra | so unidades (status manual) | nao |
| `visualizador` (na obra) | a obra | nada | nao |

---

## Etapa 7 — Atualizar o app no futuro

Sempre que mexer no codigo local:

```powershell
git add .
git commit -m "descricao do que mudou"
git push
```

A Vercel detecta o push e refaz o deploy automaticamente. Demora ~1-2 min.

---

## Limitacoes do deploy online (esta versao)

1. **PDF nao funciona online (so Excel).** O Puppeteer com Chromium embutido
   nao roda em serverless da Vercel. O endpoint `/api/export/pdf` retorna
   503 amigavel em producao. Voce pode gerar PDF rodando o app localmente.
   Para habilitar PDF online: trocar `puppeteer` por `puppeteer-core` +
   `@sparticuz/chromium`. Posso fazer isso depois se precisar.

2. **Realtime no mapa precisa da tabela `unidades` com Replication habilitada.**
   No painel Supabase → Database → Replication → marque `unidades`.

3. **Plano Hobby da Vercel** tem timeout de 10s em funcoes serverless. Para
   exportacoes Excel pesadas (poucas obras, milhares de unidades), pode
   precisar mudar para Pro.

---

## Seguranca — checklist final

- [ ] `.env.local` NAO esta no GitHub (verifique no repo online)
- [ ]chave administrativa nunca foi commitada em lugar nenhum
- [ ] Variaveis na Vercel sao apenas `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] RLS esta habilitada em todas as tabelas no Supabase (foi habilitada no schema v2)
- [ ] Cada usuario tem entrada em `perfis` + `perfis_obras` antes de logar
- [ ] Site URL no Supabase aponta para a URL da Vercel
