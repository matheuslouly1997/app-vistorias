"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";
import { criarCliente, editarCliente, excluirCliente, desvincularClienteUnidade, vincularClienteUnidade } from "./actions";

type Cliente = { id: string; nome: string; cpf: string | null; email: string | null; telefone: string | null; observacoes: string | null; created_at: string; };
type Unidade = { id: string; identificador: string; status: string; cliente_atual_id: string | null; };
type Agenda = { id: string; cliente_id: string | null; unidade_id: string; data_agendada: string; status_agenda: "agendada" | "concluida" | "cancelada" | "remarcada"; resultado: "aprovada" | "reprovada" | "pendente" | null; tipo: string; };

export default function ClientesUI({ obraId, clientes: clientesIniciais, unidades: unidadesIniciais, agendas: agendasIniciais }: {
  obraId: string; clientes: Cliente[]; unidades: Unidade[]; agendas: Agenda[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [selecionado, setSelecionado] = useState<Cliente | null>(null);
  const [busca, setBusca] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais);
  const [unidades, setUnidades] = useState<Unidade[]>(unidadesIniciais);
  const [agendas, setAgendas] = useState<Agenda[]>(agendasIniciais);

  useEffect(() => { setClientes(clientesIniciais); }, [clientesIniciais]);
  useEffect(() => { setUnidades(unidadesIniciais); }, [unidadesIniciais]);
  useEffect(() => { setAgendas(agendasIniciais); }, [agendasIniciais]);

  useEffect(() => {
    const supabase = createClient();
    const chCli = supabase.channel(`clientes_obra_${obraId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "clientes", filter: `obra_id=eq.${obraId}` }, (p) => {
        const novo = p.new as Cliente;
        setClientes((prev) => prev.some((c) => c.id === novo.id) ? prev : [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clientes", filter: `obra_id=eq.${obraId}` }, (p) => {
        const a = p.new as Cliente;
        setClientes((prev) => prev.map((c) => c.id === a.id ? { ...c, ...a } : c));
        setSelecionado((sel) => sel?.id === a.id ? { ...sel, ...a } : sel);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "clientes", filter: `obra_id=eq.${obraId}` }, (p) => {
        const id = (p.old as Partial<Cliente>).id;
        if (id) { setClientes((prev) => prev.filter((c) => c.id !== id)); setSelecionado((sel) => sel?.id === id ? null : sel); }
      }).subscribe();
    const chUn = supabase.channel(`unidades_clientes_obra_${obraId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "unidades", filter: `obra_id=eq.${obraId}` }, (p) => {
        const nova = p.new as Unidade;
        setUnidades((prev) => prev.map((u) => u.id === nova.id ? { ...u, ...nova } : u));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "agenda", filter: `obra_id=eq.${obraId}` }, (p) => {
        const nova = p.new as Agenda;
        setAgendas((prev) => prev.some((a) => a.id === nova.id) ? prev : [...prev, nova]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "agenda", filter: `obra_id=eq.${obraId}` }, (p) => {
        const a = p.new as Agenda;
        setAgendas((prev) => prev.map((ag) => ag.id === a.id ? { ...ag, ...a } : ag));
      }).subscribe();
    return () => { supabase.removeChannel(chCli); supabase.removeChannel(chUn); };
  }, [obraId]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => [c.nome, c.cpf, c.email, c.telefone].some((v) => v?.toLowerCase().includes(q)));
  }, [clientes, busca]);

  function aplicarCriar(fd: FormData) {
    fd.set("obra_id", obraId);
    start(async () => {
      const r = await criarCliente(fd);
      if (r?.erro) return toast.erro(r.erro);
      toast.sucesso("Cliente adicionado"); setNovoAberto(false); router.refresh();
    });
  }
  function aplicarEditar(input: any) {
    start(async () => {
      const r = await editarCliente({ ...input, obra_id: obraId });
      if (r?.erro) return toast.erro(r.erro);
      toast.sucesso("Cliente atualizado"); router.refresh();
    });
  }
  function aplicarExcluir(id: string) {
    start(async () => {
      const r = await excluirCliente(id, obraId);
      if (r?.erro) return toast.erro(r.erro);
      toast.sucesso("Cliente removido"); setSelecionado(null); router.refresh();
    });
  }
  function aplicarDesvincular(unidadeId: string) {
    start(async () => {
      const r = await desvincularClienteUnidade(unidadeId, obraId);
      if (r?.erro) return toast.erro(r.erro);
      toast.sucesso("Unidade desvinculada"); router.refresh();
    });
  }
  function aplicarVincularUnidade(clienteId: string, novaId: string | null, antigaId: string | null) {
    start(async () => {
      const r = await vincularClienteUnidade({ clienteId, novaUnidadeId: novaId, antigaUnidadeId: antigaId, obraId });
      if (r?.erro) return toast.erro(r.erro);
      toast.sucesso("Vinculo de unidade atualizado"); router.refresh();
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="bg-white border rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-3 justify-between">
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nome, CPF, email, telefone..."
          className="flex-1 min-w-[200px] text-sm border rounded-md px-3 py-1.5" />
        <div className="text-xs text-gray-500">{filtrados.length} cliente{filtrados.length !== 1 ? "s" : ""}</div>
        <button onClick={() => setNovoAberto(true)} className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">+ Novo cliente</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtrados.map((c) => {
          const uds = unidades.filter((u) => u.cliente_atual_id === c.id);
          const prox = agendas.filter((a) => a.cliente_id === c.id && a.status_agenda === "agendada" && new Date(a.data_agendada).getTime() >= Date.now() - 60_000)
            .sort((a, b) => +new Date(a.data_agendada) - +new Date(b.data_agendada))[0];
          return (
            <button key={c.id} onClick={() => setSelecionado(c)}
              className="text-left bg-white border rounded-lg p-4 hover:shadow-md hover:border-gray-400 transition">
              <div className="font-medium text-sm">{c.nome}</div>
              <div className="text-xs text-gray-500 mt-0.5">{c.telefone ?? "(sem telefone)"}{c.email ? ` · ${c.email}` : ""}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {uds.slice(0, 3).map((u) => (
                  <span key={u.id} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700">{u.identificador}</span>
                ))}
                {uds.length > 3 && <span className="text-[11px] text-gray-500">+{uds.length - 3}</span>}
                {uds.length === 0 && <span className="text-[11px] text-gray-400">sem unidade vinculada</span>}
              </div>
              {prox && <div className="mt-2 text-[11px] text-blue-700">Proxima: {new Date(prox.data_agendada).toLocaleString("pt-BR")}</div>}
            </button>
          );
        })}
        {filtrados.length === 0 && (
          <div className="col-span-full text-sm text-gray-500 bg-white p-4 rounded-lg border text-center">Nenhum cliente.</div>
        )}
      </div>

      {selecionado && (
        <ClientePainel
          cliente={selecionado}
          todasUnidades={unidades}
          unidadesDoCliente={unidades.filter((u) => u.cliente_atual_id === selecionado.id)}
          agendas={agendas.filter((a) => a.cliente_id === selecionado.id)}
          pending={pending}
          onClose={() => setSelecionado(null)}
          onEditar={aplicarEditar}
          onExcluir={() => aplicarExcluir(selecionado.id)}
          onDesvincular={aplicarDesvincular}
          onVincularUnidade={(novaId, antigaId) => aplicarVincularUnidade(selecionado.id, novaId, antigaId)}
        />
      )}

      {novoAberto && (
        <NovoClienteModal unidades={unidades} pending={pending} onClose={() => setNovoAberto(false)} onSubmit={aplicarCriar} />
      )}
    </div>
  );
}

function ClientePainel({ cliente, todasUnidades, unidadesDoCliente, agendas, pending, onClose, onEditar, onExcluir, onDesvincular, onVincularUnidade }: {
  cliente: Cliente; todasUnidades: Unidade[]; unidadesDoCliente: Unidade[]; agendas: Agenda[];
  pending: boolean; onClose: () => void; onEditar: (input: any) => void; onExcluir: () => void;
  onDesvincular: (unidadeId: string) => void; onVincularUnidade: (novaId: string | null, antigaId: string | null) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [editandoVinculo, setEditandoVinculo] = useState<string | null>(null);

  const proximaAgenda = agendas
    .filter((a) => a.status_agenda === "agendada" && new Date(a.data_agendada).getTime() >= Date.now() - 60_000)
    .sort((a, b) => +new Date(a.data_agendada) - +new Date(b.data_agendada))[0];
  const agendasAtivas = agendas.filter((a) => a.status_agenda === "agendada").length;

  return (
    <div className="fixed inset-0 z-30 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-[fadein_.15s_ease-out]" onClick={onClose} />
      <aside className="relative ml-auto w-full sm:max-w-lg bg-white h-full overflow-y-auto shadow-2xl animate-[slidein_.15s_ease-out]">
        <div className="px-5 py-4 border-b sticky top-0 bg-white z-10 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">Cliente</div>
            <div className="text-xl font-semibold">{cliente.nome}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {!editando ? (
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">Dados</div>
                <button onClick={() => setEditando(true)} className="text-xs text-blue-700 hover:underline">Editar</button>
              </div>
              <div className="text-sm space-y-1">
                <Linha label="CPF" valor={cliente.cpf} />
                {cliente.telefone
                  ? <div className="flex items-center justify-between"><span className="text-gray-500">Telefone</span><a href={`tel:${cliente.telefone}`} className="text-blue-700 hover:underline">{cliente.telefone}</a></div>
                  : <Linha label="Telefone" valor={null} />}
                {cliente.email
                  ? <div className="flex items-center justify-between"><span className="text-gray-500">Email</span><a href={`mailto:${cliente.email}`} className="text-blue-700 hover:underline">{cliente.email}</a></div>
                  : <Linha label="Email" valor={null} />}
                <Linha label="Observacoes" valor={cliente.observacoes} />
              </div>
            </section>
          ) : (
            <FormEditarCliente cliente={cliente} pending={pending}
              onSalvar={(input) => { onEditar(input); setEditando(false); }}
              onCancelar={() => setEditando(false)} />
          )}

          <section>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Unidades vinculadas ({unidadesDoCliente.length})</div>
            {unidadesDoCliente.length === 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-500">Nenhuma unidade vinculada.</div>
                <button onClick={() => setEditandoVinculo("__nova__")}
                  className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50">+ Vincular unidade</button>
              </div>
            ) : (
              <ul className="space-y-2">
                {unidadesDoCliente.map((u) => (
                  <li key={u.id} className="bg-gray-50 border rounded-lg px-3 py-2 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{u.identificador}</span>
                        <span className="ml-2 text-xs text-gray-500">{u.status}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button disabled={pending} onClick={() => setEditandoVinculo(editandoVinculo === u.id ? null : u.id)}
                          className="text-xs px-2 py-1 rounded border text-blue-700 hover:bg-blue-50 disabled:opacity-50">Alterar</button>
                        <button disabled={pending} onClick={() => onDesvincular(u.id)}
                          className="text-xs px-2 py-1 rounded border text-gray-700 hover:bg-white disabled:opacity-50">Desvincular</button>
                      </div>
                    </div>
                    {editandoVinculo === u.id && (
                      <FormAlterarVinculo antigaUnidade={u} todasUnidades={todasUnidades} clienteId={cliente.id}
                        pending={pending} onCancelar={() => setEditandoVinculo(null)}
                        onSalvar={(novaId) => { setEditandoVinculo(null); onVincularUnidade(novaId, u.id); }} />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editandoVinculo === "__nova__" && (
              <div className="mt-2">
                <FormAlterarVinculo antigaUnidade={null} todasUnidades={todasUnidades} clienteId={cliente.id}
                  pending={pending} onCancelar={() => setEditandoVinculo(null)}
                  onSalvar={(novaId) => { setEditandoVinculo(null); onVincularUnidade(novaId, null); }} />
              </div>
            )}
            {unidadesDoCliente.length > 0 && editandoVinculo !== "__nova__" && (
              <button onClick={() => setEditandoVinculo("__nova__")}
                className="mt-2 text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50">+ Vincular outra unidade</button>
            )}
          </section>

          {proximaAgenda && (
            <section className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-[11px] uppercase tracking-wide text-blue-700">Proxima vistoria</div>
              <div className="text-sm font-medium text-blue-900 mt-0.5">{new Date(proximaAgenda.data_agendada).toLocaleString("pt-BR")}</div>
              <div className="text-xs text-blue-700">{proximaAgenda.tipo.replace("_", " ")}</div>
            </section>
          )}

          <section>
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Historico de vistorias ({agendas.length})</div>
            <ol className="space-y-1.5">
              {agendas.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${a.status_agenda === "cancelada" ? "bg-slate-400" : a.resultado === "aprovada" ? "bg-emerald-500" : a.resultado === "reprovada" ? "bg-red-500" : "bg-blue-500"}`} />
                  <span className="text-gray-600">{new Date(a.data_agendada).toLocaleDateString("pt-BR")}</span>
                  <span className="text-gray-400">·</span>
                  <span className="font-medium">{a.tipo.replace("_", " ")}</span>
                  <span className="text-gray-400">·</span>
                  <span className="capitalize">{a.status_agenda === "concluida" ? (a.resultado ?? "concluida") : a.status_agenda}</span>
                </li>
              ))}
              {agendas.length === 0 && <li className="text-sm text-gray-500">Sem registros.</li>}
            </ol>
          </section>

          <section className="border-t pt-4">
            {!confirmExcluir ? (
              <button onClick={() => setConfirmExcluir(true)} className="text-sm px-3 py-2 rounded-md border text-red-700 hover:bg-red-50">Excluir cliente</button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-3">
                <div className="text-sm font-medium text-red-900">Confirmar exclusao de <b>{cliente.nome}</b>?</div>
                {(unidadesDoCliente.length > 0 || agendas.length > 0) && (
                  <ul className="text-xs text-red-900 space-y-1 list-disc list-inside">
                    {unidadesDoCliente.length > 0 && <li><b>{unidadesDoCliente.length}</b> unidade(s) serao desvinculadas</li>}
                    {agendasAtivas > 0 && <li><b>{agendasAtivas}</b> agenda(s) em aberto serao canceladas</li>}
                    {agendas.length - agendasAtivas > 0 && <li><b>{agendas.length - agendasAtivas}</b> agenda(s) no historico terao o vinculo removido (linhas mantidas para auditoria)</li>}
                  </ul>
                )}
                <div className="text-[11px] text-red-700">O historico de status das unidades nao e alterado.</div>
                <div className="flex gap-2">
                  <button disabled={pending} onClick={onExcluir} className="text-sm px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                    {pending ? "Excluindo..." : "Sim, excluir"}
                  </button>
                  <button onClick={() => setConfirmExcluir(false)} className="text-sm px-3 py-1.5 rounded border">Cancelar</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function FormAlterarVinculo({ antigaUnidade, todasUnidades, clienteId, pending, onCancelar, onSalvar }: {
  antigaUnidade: Unidade | null; todasUnidades: Unidade[]; clienteId: string;
  pending: boolean; onCancelar: () => void; onSalvar: (novaUnidadeId: string | null) => void;
}) {
  const [novaId, setNovaId] = useState<string>("");
  const [confirmando, setConfirmando] = useState(false);

  const disponiveis = useMemo(() =>
    todasUnidades
      .filter((u) => u.cliente_atual_id === null && u.id !== antigaUnidade?.id)
      .sort((a, b) => a.identificador.localeCompare(b.identificador, "pt-BR")),
    [todasUnidades, antigaUnidade]
  );

  const novaSelecionada = disponiveis.find((u) => u.id === novaId);

  if (confirmando && novaSelecionada) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3 text-sm">
        <div className="font-medium text-amber-900">Confirmar alteracao de vinculo?</div>
        <div className="text-xs text-amber-800 space-y-1">
          {antigaUnidade && <div>Remover vinculo de: <strong>{antigaUnidade.identificador}</strong></div>}
          <div>Vincular a: <strong>{novaSelecionada.identificador}</strong></div>
        </div>
        <div className="flex gap-2">
          <button disabled={pending} onClick={() => onSalvar(novaId)}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {pending ? "Salvando..." : "Confirmar"}
          </button>
          <button onClick={() => setConfirmando(false)} className="text-xs px-3 py-1.5 rounded border">Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="text-xs font-medium text-blue-900">
        {antigaUnidade ? `Alterar vinculo (atual: ${antigaUnidade.identificador})` : "Vincular unidade"}
      </div>
      {disponiveis.length === 0 ? (
        <div className="text-xs text-gray-500">Todas as unidades disponiveis ja estao vinculadas a outros clientes.</div>
      ) : (
        <select value={novaId} onChange={(e) => setNovaId(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm bg-white">
          <option value="">Selecione a nova unidade...</option>
          {disponiveis.map((u) => (
            <option key={u.id} value={u.id}>{u.identificador} ({u.status})</option>
          ))}
        </select>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="text-xs px-3 py-1.5 rounded border">Cancelar</button>
        <button disabled={pending || !novaId} onClick={() => novaId && setConfirmando(true)}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50">Continuar</button>
      </div>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span>{valor ?? <span className="text-gray-400">&#8212;</span>}</span>
    </div>
  );
}

function FormEditarCliente({ cliente, pending, onSalvar, onCancelar }: {
  cliente: Cliente; pending: boolean; onSalvar: (input: any) => void; onCancelar: () => void;
}) {
  const [nome, setNome] = useState(cliente.nome);
  const [cpf, setCpf] = useState(cliente.cpf ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [telefone, setTelefone] = useState(cliente.telefone ?? "");
  const [observacoes, setObservacoes] = useState(cliente.observacoes ?? "");

  return (
    <section className="space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">Editar dados</div>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome *" className="w-full border rounded px-3 py-2 text-sm" />
      <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="CPF" className="w-full border rounded px-3 py-2 text-sm" />
      <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone" className="w-full border rounded px-3 py-2 text-sm" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full border rounded px-3 py-2 text-sm" />
      <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observacoes" rows={2} className="w-full border rounded px-3 py-2 text-sm" />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancelar} className="text-sm px-3 py-1.5 rounded border">Cancelar</button>
        <button disabled={pending} onClick={() => onSalvar({ id: cliente.id, nome, cpf, email, telefone, observacoes })}
          className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50">
          {pending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </section>
  );
}

function NovoClienteModal({ unidades, pending, onClose, onSubmit }: {
  unidades: Unidade[]; pending: boolean; onClose: () => void; onSubmit: (fd: FormData) => void;
}) {
  const [vinculadas, setVinculadas] = useState<Unidade[]>([]);
  const [query, setQuery] = useState("");
  const [aberto, setAberto] = useState(false);

  const idsSelecionados = new Set(vinculadas.map((u) => u.id));
  const sugestoes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unidades.filter((u) => !idsSelecionados.has(u.id) && u.cliente_atual_id === null && (q === "" || u.identificador.toLowerCase().includes(q))).slice(0, 12);
  }, [query, unidades, idsSelecionados]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-[fadein_.15s_ease-out]" onClick={onClose} />
      <form onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("unidades_ids", JSON.stringify(vinculadas.map((u) => u.id)));
        onSubmit(fd);
      }} className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-5 space-y-3 animate-[slidein_.15s_ease-out]">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Novo cliente</div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl leading-none">&times;</button>
        </div>
        <input name="nome" required placeholder="Nome *" className="w-full border rounded px-3 py-2 text-sm" />
        <input name="cpf" placeholder="CPF" className="w-full border rounded px-3 py-2 text-sm" />
        <input name="telefone" placeholder="Telefone" className="w-full border rounded px-3 py-2 text-sm" />
        <input name="email" type="email" placeholder="Email" className="w-full border rounded px-3 py-2 text-sm" />
        <textarea name="observacoes" rows={2} placeholder="Observacoes" className="w-full border rounded px-3 py-2 text-sm" />
        <div className="space-y-1">
          <label className="text-xs text-gray-600 block">Vincular apartamento(s) a este cliente</label>
          {vinculadas.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {vinculadas.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {u.identificador}
                  <button type="button" onClick={() => setVinculadas(vinculadas.filter((v) => v.id !== u.id))} className="text-blue-700 hover:text-blue-900">&times;</button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setAberto(true); }}
              onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)}
              placeholder={vinculadas.length === 0 ? "Buscar identificador..." : "Adicionar mais..."}
              className="w-full border rounded px-3 py-2 text-sm" />
            {aberto && sugestoes.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-56 overflow-y-auto">
                {sugestoes.map((u) => (
                  <li key={u.id}>
                    <button type="button" onMouseDown={() => { setVinculadas([...vinculadas, u]); setQuery(""); setAberto(false); }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center justify-between gap-2">
                      <span className="font-medium">{u.identificador}</span>
                      <span className="text-[11px] text-gray-500">{u.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {aberto && sugestoes.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-md px-3 py-2 text-xs text-gray-500">
                {query ? `Nenhuma unidade disponivel com "${query}"` : "Nenhuma unidade disponivel (todas ja vinculadas)"}
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-500">Apenas unidades sem cliente vinculado aparecem aqui.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="text-sm px-3 py-2 rounded border">Cancelar</button>
          <button type="submit" disabled={pending} className="text-sm px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
            {pending ? "Salvando..." : `Adicionar${vinculadas.length ? ` + ${vinculadas.length} vinculo${vinculadas.length > 1 ? "s" : ""}` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}
