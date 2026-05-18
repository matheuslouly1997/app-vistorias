"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import {
  criarUsuario, editarUsuario, definirAtivoUsuario, resetarSenhaUsuario,
  adicionarVinculoObra, atualizarPapelObra, removerVinculoObra, excluirUsuario
} from "./actions";

export const PAPEIS_GLOBAIS = [
  "administrador", "gestor", "atendimento", "engenharia", "vistoria", "leitura"
] as const;
export const PAPEIS_OBRA = [
  "administrador_obra", "engenharia", "vistoria", "atendimento", "leitura"
] as const;

type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  created_at: string;
  ultimo_login: string | null;
};
type Vinculo = { perfil_id: string; obra_id: string; papel_obra: string | null };
type Obra = { id: string; nome: string };

export default function UsuariosUI({
  meuUserId, usuarios, vinculos, obras
}: {
  meuUserId: string;
  usuarios: Usuario[];
  vinculos: Vinculo[];
  obras: Obra[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [busca, setBusca] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<Usuario | null>(null);

  const obraMap = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);
  const vinculosPorUser = useMemo(() => {
    const m = new Map<string, Vinculo[]>();
    for (const v of vinculos) {
      if (!m.has(v.perfil_id)) m.set(v.perfil_id, []);
      m.get(v.perfil_id)!.push(v);
    }
    return m;
  }, [vinculos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.papel.toLowerCase().includes(q)
    );
  }, [usuarios, busca]);

  function aplicarCriar(input: any) {
    start(async () => {
      const r = await criarUsuario(input);
      if (r?.erro) return toast.erro(r.erro);
      toast.sucesso("Usuario criado");
      setNovoAberto(false);
      router.refresh();
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Admin</div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-xs text-gray-500">Gerencie quem pode acessar o sistema e o que pode fazer em cada obra.</p>
        </div>
        <button onClick={() => setNovoAberto(true)} className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">
          + Novo usuario
        </button>
      </header>

      <div className="bg-white border rounded-xl p-3 shadow-sm">
        <input
          type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nome, email ou papel..."
          className="w-full text-sm border rounded-md px-3 py-1.5"
        />
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">Nome / Email</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Papel global</th>
              <th className="text-left px-3 py-2">Obras</th>
              <th className="text-left px-3 py-2">Ultimo login</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((u) => {
              const vins = vinculosPorUser.get(u.id) ?? [];
              return (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{u.nome}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    {u.ativo ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Ativo</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">Desativado</span>
                    )}
                  </td>
                  <td className="px-3 py-2"><code className="text-xs">{u.papel}</code></td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {vins.length === 0 ? <span className="text-gray-400">—</span> : `${vins.length} obra(s)`}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString("pt-BR") : "nunca"}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => setSelecionado(u)} className="text-xs px-2 py-1 rounded border hover:bg-gray-100">
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="text-sm text-gray-500 text-center py-8">Nenhum usuario.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {novoAberto && (
        <NovoUsuarioModal
          obras={obras}
          pending={pending}
          onClose={() => setNovoAberto(false)}
          onSubmit={aplicarCriar}
        />
      )}

      {selecionado && (
        <EditarUsuarioPainel
          usuario={selecionado}
          vinculos={vinculosPorUser.get(selecionado.id) ?? []}
          obras={obras}
          obraMap={obraMap}
          pending={pending}
          eu={selecionado.id === meuUserId}
          onClose={() => setSelecionado(null)}
          onRefresh={() => router.refresh()}
          notify={(t, m) => t === "ok" ? toast.sucesso(m) : toast.erro(m)}
        />
      )}
    </div>
  );
}

/* ============================================================
 * Modal Novo Usuario
 * ============================================================ */
function NovoUsuarioModal({
  obras, pending, onClose, onSubmit
}: {
  obras: Obra[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: any) => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState(gerarSenha());
  const [papel, setPapel] = useState<string>("atendimento");
  const [vinculos, setVinculos] = useState<{ obra_id: string; papel_obra: string }[]>([]);

  function addVinculo() {
    if (obras.length === 0) return;
    const usadas = new Set(vinculos.map((v) => v.obra_id));
    const livre = obras.find((o) => !usadas.has(o.id));
    if (!livre) return;
    setVinculos([...vinculos, { obra_id: livre.id, papel_obra: "atendimento" }]);
  }
  function rmVinculo(i: number) { setVinculos(vinculos.filter((_, j) => j !== i)); }
  function setVinculo(i: number, patch: Partial<{ obra_id: string; papel_obra: string }>) {
    setVinculos(vinculos.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => !pending && onClose()} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ nome, email, senha, papel, vinculos });
        }}
        className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Novo usuario</div>
          <button type="button" disabled={pending} onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">&times;</button>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Nome *">
            <input required value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          </Field>
          <Field label="Email *">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          </Field>
        </div>

        <Field label="Senha temporaria *">
          <div className="flex gap-1">
            <input required value={senha} onChange={(e) => setSenha(e.target.value)} className="flex-1 border rounded px-3 py-2 text-sm font-mono" />
            <button type="button" onClick={() => setSenha(gerarSenha())} className="text-xs px-2 py-1.5 rounded border">Gerar</button>
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Compartilhe esta senha com o usuario. Ele pode resetar depois.</div>
        </Field>

        <Field label="Papel global *">
          <select value={papel} onChange={(e) => setPapel(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white">
            {PAPEIS_GLOBAIS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="text-[10px] text-gray-500 mt-0.5">
            <code>administrador</code> tem acesso total (incl. esta tela). Demais papeis precisam de vinculos em obras.
          </div>
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-600">Vinculos em obras</label>
            <button type="button" onClick={addVinculo} disabled={vinculos.length >= obras.length} className="text-xs px-2 py-1 rounded border disabled:opacity-50">
              + Adicionar
            </button>
          </div>
          {vinculos.length === 0 && (
            <div className="text-xs text-gray-500 border rounded p-3 bg-gray-50">Sem vinculos. Adicione obras para o usuario poder acessa-las.</div>
          )}
          <div className="space-y-1.5">
            {vinculos.map((v, i) => (
              <div key={i} className="flex items-center gap-1">
                <select value={v.obra_id} onChange={(e) => setVinculo(i, { obra_id: e.target.value })}
                  className="flex-1 border rounded px-2 py-1.5 text-sm bg-white">
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
                <select value={v.papel_obra} onChange={(e) => setVinculo(i, { papel_obra: e.target.value })}
                  className="border rounded px-2 py-1.5 text-sm bg-white">
                  {PAPEIS_OBRA.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button type="button" onClick={() => rmVinculo(i)} className="text-xs px-2 py-1.5 rounded border text-red-700">&times;</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" disabled={pending} onClick={onClose} className="text-sm px-3 py-2 rounded border">Cancelar</button>
          <button type="submit" disabled={pending} className="text-sm px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
            {pending ? "Criando..." : "Criar usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
 * Painel Editar Usuario
 * ============================================================ */
function EditarUsuarioPainel({
  usuario, vinculos, obras, obraMap, pending, eu, onClose, onRefresh, notify
}: {
  usuario: Usuario;
  vinculos: Vinculo[];
  obras: Obra[];
  obraMap: Map<string, Obra>;
  pending: boolean;
  eu: boolean;
  onClose: () => void;
  onRefresh: () => void;
  notify: (t: "ok" | "erro", m: string) => void;
}) {
  const [nome, setNome] = useState(usuario.nome);
  const [papel, setPapel] = useState(usuario.papel);
  const [novaSenha, setNovaSenha] = useState("");
  const [novaObra, setNovaObra] = useState<string>(obras.find((o) => !vinculos.some((v) => v.obra_id === o.id))?.id ?? "");
  const [novoPapelObra, setNovoPapelObra] = useState<string>("atendimento");
  const [confirmExcluir, setConfirmExcluir] = useState(false);

  async function run<T extends { ok?: true; erro?: string }>(p: Promise<T>, okMsg: string) {
    const r = await p;
    if (r?.erro) notify("erro", r.erro);
    else { notify("ok", okMsg); onRefresh(); }
    return r;
  }

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative ml-auto w-full sm:max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
        <div className="px-5 py-4 border-b sticky top-0 bg-white z-10 flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-500">Usuario</div>
            <div className="text-lg font-semibold">{usuario.nome}</div>
            <div className="text-xs text-gray-500">{usuario.email}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <section>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Dados gerais</div>
            <div className="space-y-2">
              <Field label="Nome">
                <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
              </Field>
              <Field label="Papel global">
                <select value={papel} onChange={(e) => setPapel(e.target.value)} disabled={eu} className="w-full border rounded px-3 py-2 text-sm bg-white">
                  {PAPEIS_GLOBAIS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                {eu && <div className="text-[10px] text-amber-700 mt-1">Voce nao pode alterar o proprio papel.</div>}
              </Field>
              <div className="flex gap-2">
                <button
                  disabled={pending}
                  onClick={() => run(editarUsuario({ id: usuario.id, nome, papel: eu ? undefined : papel }), "Dados atualizados")}
                  className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white disabled:opacity-50"
                >
                  Salvar dados
                </button>
                <button
                  disabled={pending || eu}
                  onClick={() => run(definirAtivoUsuario(usuario.id, !usuario.ativo), usuario.ativo ? "Usuario desativado" : "Usuario ativado")}
                  className={`text-sm px-3 py-1.5 rounded border ${eu ? "opacity-50" : ""}`}
                >
                  {usuario.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Resetar senha</div>
            <div className="flex gap-2">
              <input value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Nova senha temporaria"
                className="flex-1 border rounded px-3 py-2 text-sm font-mono" />
              <button onClick={() => setNovaSenha(gerarSenha())} className="text-xs px-2 py-1 rounded border">Gerar</button>
              <button
                disabled={pending || !novaSenha}
                onClick={() => run(resetarSenhaUsuario(usuario.id, novaSenha), "Senha resetada").then(() => setNovaSenha(""))}
                className="text-sm px-3 py-1.5 rounded bg-amber-600 text-white disabled:opacity-50"
              >
                Resetar
              </button>
            </div>
          </section>

          <section>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Obras vinculadas ({vinculos.length})</div>
            {vinculos.length === 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 border rounded p-3">Sem vinculos.</div>
            ) : (
              <ul className="space-y-1">
                {vinculos.map((v) => (
                  <li key={v.obra_id} className="flex items-center gap-2 bg-gray-50 border rounded px-3 py-2">
                    <span className="flex-1 font-medium text-sm">{obraMap.get(v.obra_id)?.nome ?? v.obra_id}</span>
                    <select
                      defaultValue={v.papel_obra ?? "atendimento"}
                      onChange={(e) => run(atualizarPapelObra(usuario.id, v.obra_id, e.target.value), "Papel atualizado")}
                      className="text-xs border rounded px-2 py-1 bg-white"
                    >
                      {PAPEIS_OBRA.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button
                      disabled={pending}
                      onClick={() => run(removerVinculoObra(usuario.id, v.obra_id), "Vinculo removido")}
                      className="text-xs px-2 py-1 rounded border text-red-700"
                      title="Remove o vinculo desta obra"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 flex items-center gap-1">
              <select value={novaObra} onChange={(e) => setNovaObra(e.target.value)} className="flex-1 border rounded px-2 py-1.5 text-sm bg-white">
                <option value="">— escolha uma obra —</option>
                {obras
                  .filter((o) => !vinculos.some((v) => v.obra_id === o.id))
                  .map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <select value={novoPapelObra} onChange={(e) => setNovoPapelObra(e.target.value)} className="border rounded px-2 py-1.5 text-sm bg-white">
                {PAPEIS_OBRA.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <button
                disabled={pending || !novaObra}
                onClick={() => run(adicionarVinculoObra(usuario.id, novaObra, novoPapelObra), "Vinculo adicionado").then(() => setNovaObra(""))}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </section>

          <section className="border-t pt-4">
            {!confirmExcluir ? (
              <button
                onClick={() => setConfirmExcluir(true)}
                disabled={eu}
                title={eu ? "Voce nao pode excluir a propria conta" : "Excluir usuario"}
                className="text-sm px-3 py-2 rounded border text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                Excluir usuario
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
                <div className="text-sm font-medium text-red-900">Excluir {usuario.nome}?</div>
                <p className="text-xs text-red-800">
                  Remove de Authentication, perfis e perfis_obras. Historico de alteracoes feitas por ele permanece (alterado_por vira NULL).
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={pending}
                    onClick={() => run(excluirUsuario(usuario.id), "Usuario excluido").then((r) => { if (r?.ok) onClose(); })}
                    className="text-xs px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
                  >
                    Sim, excluir
                  </button>
                  <button onClick={() => setConfirmExcluir(false)} className="text-xs px-3 py-1.5 rounded border">Cancelar</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function gerarSenha() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = "abcdefghjkmnpqrstuvwxyz";
  const d = "23456789";
  const s = "@#$%&";
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pwd = pick(a) + pick(b) + pick(d) + pick(s);
  for (let i = 0; i < 8; i++) pwd += pick(a + b + d);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}
