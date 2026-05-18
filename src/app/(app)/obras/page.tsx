import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NovaObraForm from "./nova-obra-form";

export const dynamic = "force-dynamic";

export default async function ObrasPage() {
  const supabase = createClient();

  // 1) Quem esta logado? (middleware ja redirecionou caso nao haja sessao)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2) Perfil GLOBAL do usuario (RLS deve liberar o proprio registro via id = auth.uid())
  const { data: perfil, error: errPerfil } = await supabase
    .from("perfis")
    .select("nome, email, papel, ativo")
    .eq("id", user.id)
    .maybeSingle();

  // 3) Vinculos do usuario em perfis_obras
  const { data: vinculos, error: errVinculos } = await supabase
    .from("perfis_obras")
    .select("obra_id, papel_obra")
    .eq("perfil_id", user.id);

  // 4) Lista de obras — RLS decide o que aparece. Sem filtro local.
  const { data: obras, error: errObras } = await supabase
    .from("obras")
    .select("*")
    .order("nome");

  const ehAdminGlobal = perfil?.papel === "administrador" && perfil?.ativo === true;
  const lista = obras ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Obras</h1>
        <p className="text-sm text-gray-500">
          Selecione uma obra para abrir o mapa operacional
          {ehAdminGlobal ? " ou cadastre uma nova." : "."}
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lista */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-2">
            Lista ({lista.length})
          </h2>
          <div className="space-y-2">
            {lista.map((o) => (
              <Link
                key={o.id}
                href={`/obras/${o.id}/dashboard`}
                className="block bg-white border rounded-xl p-4 hover:border-gray-400 hover:shadow-md transition group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium group-hover:text-blue-700 transition">{o.nome}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{o.endereco ?? "—"}</div>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{o.status}</span>
                </div>
              </Link>
            ))}

            {lista.length === 0 && (
              <DiagnosticoVazio
                user={{ id: user.id, email: user.email ?? "(sem email)" }}
                perfil={perfil}
                vinculos={vinculos ?? []}
                erros={{
                  perfis: errPerfil?.message,
                  vinculos: errVinculos?.message,
                  obras: errObras?.message
                }}
              />
            )}
          </div>
        </section>

        {/* Nova obra: somente administrador global */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-2">Nova obra</h2>
          {ehAdminGlobal ? (
            <NovaObraForm />
          ) : (
            <div className="bg-white border rounded-lg p-4 text-sm text-gray-600 space-y-2">
              <p>Apenas <b>administradores globais</b> podem criar obras.</p>
              {!perfil && (
                <p className="text-xs text-amber-700">
                  Seu usuario ainda nao tem perfil cadastrado em <code>perfis</code>.
                  Veja o diagnostico ao lado.
                </p>
              )}
              {perfil && !ehAdminGlobal && (
                <p className="text-xs text-gray-500">
                  Seu papel atual: <code>{perfil.papel}</code>
                  {perfil.ativo ? "" : " (INATIVO)"}.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ============================================================
 * Diagnostico — aparece quando a lista de obras vem vazia
 * ============================================================ */
type DiagProps = {
  user: { id: string; email: string };
  perfil: { nome: string; email: string; papel: string; ativo: boolean } | null;
  vinculos: { obra_id: string; papel_obra: string | null }[];
  erros: { perfis?: string; vinculos?: string; obras?: string };
};

function DiagnosticoVazio({ user, perfil, vinculos, erros }: DiagProps) {
  const perfilOk = !!perfil;
  const ehAdmin = perfil?.papel === "administrador" && perfil?.ativo === true;
  const temVinculo = vinculos.length > 0;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm space-y-3">
      <div className="font-medium text-amber-900">
        Nenhuma obra visivel para voce.
      </div>
      <p className="text-xs text-amber-800">
        A query rodou com seu usuario e RLS. Abaixo o que o app conseguiu enxergar:
      </p>

      <div className="bg-white border rounded p-3 text-xs space-y-1 font-mono">
        <Linha label="Email autenticado"        value={user.email} />
        <Linha label="User ID (auth.uid)"       value={user.id} />
        <Linha label="Perfil em perfis"         value={perfilOk ? "ENCONTRADO" : "NAO encontrado"} ok={perfilOk} />
        {perfilOk && (
          <>
            <Linha label="Nome no perfil"       value={perfil!.nome} />
            <Linha label="Papel global"         value={perfil!.papel}  ok={ehAdmin} />
            <Linha label="Ativo"                value={perfil!.ativo ? "true" : "false"} ok={perfil!.ativo} />
          </>
        )}
        <Linha
          label="Vinculos perfis_obras"
          value={temVinculo ? `${vinculos.length} vinculo(s)` : "nenhum"}
          ok={temVinculo}
        />
        {vinculos.map((v) => (
          <div key={v.obra_id} className="pl-4 text-gray-600">
            &middot; obra_id=<span className="text-gray-900">{v.obra_id}</span> papel={v.papel_obra ?? "—"}
          </div>
        ))}
        {erros.perfis    && <Linha label="Erro perfis"    value={erros.perfis}    ok={false} />}
        {erros.vinculos  && <Linha label="Erro vinculos"  value={erros.vinculos}  ok={false} />}
        {erros.obras     && <Linha label="Erro obras"     value={erros.obras}     ok={false} />}
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-amber-900 font-medium">
          Como destravar (clique para abrir)
        </summary>
        <div className="mt-2 space-y-3 text-gray-700">
          {!perfilOk && (
            <div>
              <p className="font-medium">Perfil nao encontrado.</p>
              <p>
                Provavelmente o INSERT em <code>perfis</code> foi feito com um UUID diferente
                do seu <code>auth.uid</code>. Compare com o ID acima e corrija no SQL Editor:
              </p>
              <pre className="bg-white border rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-all">
{`-- 1) Confirme o seu auth.uid no banco
select auth.uid();

-- 2) Veja se existe perfil com OUTRO id mesmo email
select * from perfis where email = '${user.email}';

-- 3a) Se nao existe: criar com o id certo
insert into perfis (id, nome, email, papel, ativo)
values ('${user.id}', 'Seu Nome', '${user.email}', 'administrador', true);

-- 3b) Se existe com id errado: apagar e recriar
delete from perfis where email = '${user.email}';
-- depois rode o INSERT acima`}
              </pre>
            </div>
          )}

          {perfilOk && !ehAdmin && !temVinculo && (
            <div>
              <p className="font-medium">Perfil existe, mas voce nao e admin global e nao tem vinculo.</p>
              <p>RLS so deixa voce ver obras vinculadas em <code>perfis_obras</code>. Vincule no SQL Editor:</p>
              <pre className="bg-white border rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-all">
{`insert into perfis_obras (perfil_id, obra_id, papel_obra)
select '${user.id}', id, 'administrador'
from obras where nome = 'Art Haus';`}
              </pre>
            </div>
          )}

          {perfilOk && !perfil!.ativo && (
            <div>
              <p className="font-medium">Perfil esta marcado como inativo.</p>
              <pre className="bg-white border rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-all">
{`update perfis set ativo = true where id = '${user.id}';`}
              </pre>
            </div>
          )}

          {perfilOk && ehAdmin && (
            <div>
              <p className="font-medium">Perfil ok e admin global, mas mesmo assim sem obras.</p>
              <p>Verifique se a tabela <code>obras</code> realmente tem dados:</p>
              <pre className="bg-white border rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap break-all">
{`select id, nome, status from obras;`}
              </pre>
              <p>Se estiver vazia, rode o seed v2 do Art Haus.</p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function Linha({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const cor = ok === undefined ? "text-gray-900" : ok ? "text-emerald-700" : "text-red-700";
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}:</span>
      <span className={cor + " break-all text-right"}>{value}</span>
    </div>
  );
}
