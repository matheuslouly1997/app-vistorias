"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  STATUS_COLORS_UI, STATUS_LABELS_UI, ACAO_LABELS, ACAO_COR,
  acoesPermitidas, dbParaUI, type AcaoUnidade
} from "@/lib/constants/status";
import type { StatusUnidade, HistoricoStatus, Cliente, Agenda } from "@/lib/types/database";
import { useToast } from "@/components/toast";
import {
  aprovarUnidade, reprovarUnidade, reagendarUnidade, marcarVistoria,
  marcarEntregue, liberarParaVistoria, marcarEmCorrecao, voltarEmObra,
  atualizarObservacoesUnidade, desfazerUltimaAlteracao, resetarUnidade,
  enviarParaCorrecao, liberarParaRevistoria, agendarRevistoria,
} from "./actions";

type Unidade = {
  id: string; torre_id: string; pavimento: number; codigo_unidade: string;
  identificador: string; status: StatusUnidade; cliente_atual_id: string | null;
  observacoes?: string | null;
};
type Props = {
  unidade: Unidade; torreNome?: string; obraId: string;
  clientes: Pick<Cliente, "id" | "nome" | "telefone" | "email">[];
  onClose: () => void; onChanged: (u: Unidade) => void;
};
type FormAcaoTipo = "marcar_vistoria" | "reagendar" | "agendar_revistoria";

export default function UnidadePainel({ unidade, torreNome, obraId, clientes, onClose, onChanged }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [historico, setHistorico] = useState<HistoricoStatus[] | null>(null);
  const [agendas, setAgendas] = useState<Agenda[] | null>(null);
  const [obs, setObs] = useState(unidade.observacoes ?? "");
  const [obsDirty, setObsDirty] = useState(false);
  const [formAcao, setFormAcao] = useState<null | FormAcaoTipo>(null);
  const [confirmarReset, setConfirmarReset] = useState(false);

  useEffect(() => { setObs(unidade.observacoes ?? ""); setObsDirty(false); }, [unidade.id, unidade.observacoes]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const [{ data: h }, { data: a }] = await Promise.all([
        supabase.from("historico_status").select("*").eq("unidade_id", unidade.id).order("alterado_em", { ascending: false }),
        supabase.from("agenda").select("*").eq("unidade_id", unidade.id).order("data_agendada", { ascending: false })
      ]);
      if (alive) { setHistorico(h ?? []); setAgendas(a ?? []); }
    })();
    return () => { alive = false; };
  }, [unidade.id]);

  const ui = dbParaUI(unidade.status);
  const cor = STATUS_COLORS_UI[ui];

  const acoes = useMemo<AcaoUnidade[]>(() => {
    const lista = acoesPermitidas(unidade.status);
    const temAlteracao = (historico ?? []).some((h) => h.status_anterior !== null);
    return temAlteracao ? [...lista, "desfazer"] : lista;
  }, [unidade.status, historico]);

  const proximaAgenda = (agendas ?? []).find(
    (a) => a.status_agenda === "agendada" && new Date(a.data_agendada).getTime() >= Date.now() - 60_000
  );
  const ultimaAlteracao = (historico ?? [])[0];
  const clienteAtual = clientes.find((c) => c.id === unidade.cliente_atual_id);

  function recarregar() {
    return Promise.all([
      (async () => {
        const supabase = createClient();
        const { data: h } = await supabase.from("historico_status").select("*").eq("unidade_id", unidade.id).order("alterado_em", { ascending: false });
        setHistorico(h ?? []);
      })(),
      (async () => {
        const supabase = createClient();
        const { data: a } = await supabase.from("agenda").select("*").eq("unidade_id", unidade.id).order("data_agendada", { ascending: false });
        setAgendas(a ?? []);
      })()
    ]);
  }

  function aplicar(acao: AcaoUnidade, payload?: any) {
    start(async () => {
      let r: { ok?: true; erro?: string } | undefined;
      switch (acao) {
        case "marcar_em_correcao":      r = await marcarEmCorrecao(unidade.id);    break;
        case "voltar_em_obra":          r = await voltarEmObra(unidade.id);        break;
        case "liberar_para_vistoria":   r = await liberarParaVistoria(unidade.id); break;
        case "marcar_vistoria":         r = await marcarVistoria({ unidadeId: unidade.id, ...payload }); break;
        case "aprovar":                 r = await aprovarUnidade(unidade.id);      break;
        case "reprovar":                r = await reprovarUnidade(unidade.id);     break;
        case "reagendar":               r = await reagendarUnidade({ unidadeId: unidade.id, ...payload }); break;
        case "marcar_entregue":         r = await marcarEntregue(unidade.id);      break;
        case "enviar_para_correcao":    r = await enviarParaCorrecao(unidade.id);    break;
        case "liberar_para_revistoria": r = await liberarParaRevistoria(unidade.id); break;
        case "agendar_revistoria":      r = await agendarRevistoria({ unidadeId: unidade.id, ...payload }); break;
        case "desfazer": {
          const x = await desfazerUltimaAlteracao(unidade.id);
          if (x?.erro) { toast.erro(x.erro); return; }
          await recarregar();
          const supabase = createClient();
          const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
          if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
          toast.sucesso(`${unidade.identificador}: alteracao desfeita`);
          return;
        }
      }
      if (r?.erro) { toast.erro(r.erro); return; }
      const supabase = createClient();
      const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
      if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
      await recarregar();
      toast.sucesso(`${unidade.identificador}: ${ACAO_LABELS[acao]} aplicada`, {
        duracaoMs: 10000, acaoLabel: "Desfazer",
        acao: async () => {
          const x = await desfazerUltimaAlteracao(unidade.id);
          if (x?.erro) { toast.erro(x.erro); return; }
          await recarregar();
          const supabase = createClient();
          const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
          if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
          toast.sucesso(`${unidade.identificador}: alteracao desfeita`);
        }
      });
      setFormAcao(null);
    });
  }

  function aplicarResetar() {
    start(async () => {
      const r = await resetarUnidade(unidade.id);
      if (r?.erro) { toast.erro(r.erro); return; }
      const supabase = createClient();
      const { data: nv } = await supabase.from("unidades").select("status, cliente_atual_id, observacoes").eq("id", unidade.id).maybeSingle();
      if (nv) onChanged({ ...unidade, status: nv.status as StatusUnidade, cliente_atual_id: nv.cliente_atual_id, observacoes: nv.observacoes });
      await recarregar();
      setConfirmarReset(false);
      toast.sucesso(`${unidade.identificador} resetada para em obra`);
    });
  }

  function salvarObs() {
    start(async () => {
      const r = await atualizarObservacoesUnidade(unidade.id, obs);
      if (r?.erro) { toast.erro(r.erro); return; }
      setObsDirty(false);
      onChanged({ ...unidade, observacoes: obs });
      toast.sucesso("Observacoes salvas");
    });
  }

  const timeline = useMemo(() => construirTimeline(historico ?? [], agendas ?? []), [historico, agendas]);
  const acoesComForm = new Set<AcaoUnidade>(["marcar_vistoria", "reagendar", "agendar_revistoria"]);

  return (
    <div className="fixed inset-0 z-30 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-[fadein_.15s_ease-out]" onClick={onClose} />
      <aside className="relative ml-auto w-full sm:max-w-xl bg-white h-full overflow-y-auto shadow-2xl animate-[slidein_.15s_ease-out]">
        <div className="px-6 py-5 border-b sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-gray-500">
                {torreNome ? `Torre ${torreNome} · ` : ""}Pavimento {String(unidade.pavimento).padStart(2, "0")} · {unidade.codigo_unidade}
              </div>
              <div className="text-2xl font-semibold tracking-tight">{unidade.identificador}</div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded ${cor.chip}`}>
                  {STATUS_LABELS_UI[ui]}
                </span>
                {(unidade.status === "em_correcao_pos_reprovacao" || unidade.status === "pronta_revistoria") && (
                  <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded">
                    pos-reprovacao
                  </span>
                )}
                {ultimaAlteracao && (
                  <span className="text-[11px] text-gray-500">
                    Ultima alteracao: {new Date(ultimaAlteracao.alterado_em).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-2xl leading-none" aria-label="Fechar">&times;</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          <section className="grid sm:grid-cols-2 gap-3">
            <Card titulo="Cliente vinculado">
              {clienteAtual ? (
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{clienteAtual.nome}</div>
                  {clienteAtual.telefone && (
                    <a href={`tel:${clienteAtual.telefone}`} className="text-blue-700 hover:underline block">{clienteAtual.telefone}</a>
                  )}
                  {clienteAtual.email && (
                    <a href={`mailto:${clienteAtual.email}`} className="text-blue-700 hover:underline block">{clienteAtual.email}</a>
                  )}
                </div>
              ) : <div className="text-sm text-gray-500">Sem cliente vinculado.</div>}
            </Card>
            <Card titulo="Proxima vistoria">
              {proximaAgenda ? (
                <div className="text-sm">
                  <div className="font-medium">{new Date(proximaAgenda.data_agendada).toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-gray-500">{proximaAgenda.tipo} · {proximaAgenda.duracao_min}min · {proximaAgenda.status_agenda}</div>
                </div>
              ) : <div className="text-sm text-gray-500">Nenhuma vistoria agendada.</div>}
            </Card>
          </section>

          <section>
            <div className="text-xs font-medium text-gray-600 mb-2">Acoes rapidas</div>
            {unidade.status === "reprovada" && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800">
                <strong>Unidade reprovada.</strong> Use <em>Enviar para correcao</em> para iniciar o fluxo controlado
                ou <em>Reagendar direto</em> para agendar revistoria imediatamente.
              </div>
            )}
            {unidade.status === "em_correcao_pos_reprovacao" && (
              <div className="mb-3 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-900">
                <strong>Em correcao pos-reprovacao.</strong> Quando a obra terminar, clique em <em>Liberar para revistoria</em>.
              </div>
            )}
            {unidade.status === "pronta_revistoria" && (
              <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
                <strong>Pronta para revistoria.</strong> Agende a revistoria com o cliente.
              </div>
            )}
            {acoes.length === 0 && <div className="text-sm text-gray-500">Nenhuma acao disponivel neste status.</div>}
            <div className="flex flex-wrap gap-2">
              {acoes.map((a) => (
                <button key={a} disabled={pending}
                  onClick={() => { if (acoesComForm.has(a)) { setFormAcao(a as FormAcaoTipo); } else { aplicar(a); } }}
                  className={`text-sm px-3 py-2 rounded-md font-medium disabled:opacity-50 transition ${ACAO_COR[a]}`}>
                  {ACAO_LABELS[a]}
                </button>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t">
              {!confirmarReset ? (
                <button onClick={() => setConfirmarReset(true)}
                  className="text-xs px-3 py-1.5 rounded border text-red-700 hover:bg-red-50">
                  &#8634; Resetar (desmarcar tudo)
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <div className="text-sm font-medium text-red-900">Resetar {unidade.identificador}?</div>
                  <ul className="text-xs text-red-900 list-disc list-inside space-y-0.5">
                    <li>Cancela agendas em aberto desta unidade</li>
                    <li>Desvincula o cliente atual</li>
                    <li>Volta o status para <b>em obra</b></li>
                    <li>O historico de auditoria <b>nao</b> e apagado</li>
                  </ul>
                  <div className="flex gap-2">
                    <button disabled={pending} onClick={aplicarResetar}
                      className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                      {pending ? "Resetando..." : "Sim, resetar"}
                    </button>
                    <button onClick={() => setConfirmarReset(false)} className="text-xs px-3 py-1.5 rounded border">Cancelar</button>
                  </div>
                </div>
              )}
            </div>

            {formAcao && (
              <FormAgendaInline tipo={formAcao} clientes={clientes} clienteAtualId={unidade.cliente_atual_id}
                pending={pending} onCancel={() => setFormAcao(null)}
                onSubmit={(dados) => aplicar(formAcao, dados)} />
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-gray-600">Observacoes operacionais</div>
              {obsDirty && (
                <button disabled={pending} onClick={salvarObs}
                  className="text-xs px-2 py-1 rounded bg-gray-900 text-white disabled:opacity-50">Salvar</button>
              )}
            </div>
            <textarea rows={3} value={obs} onChange={(e) => { setObs(e.target.value); setObsDirty(true); }}
              placeholder="ex.: cliente pediu horario apos 18h"
              className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </section>

          <section>
            <div className="text-xs font-medium text-gray-600 mb-2">Timeline</div>
            <ol className="space-y-3">
              {timeline.length === 0 && <li className="text-sm text-gray-500">Sem eventos.</li>}
              {timeline.map((ev, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${ev.cor}`} />
                  <div className="flex-1">
                    <div>{ev.titulo}</div>
                    <div className="text-[11px] text-gray-500">{ev.quando}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{titulo}</div>
      {children}
    </div>
  );
}

function FormAgendaInline({ tipo, clientes, clienteAtualId, pending, onCancel, onSubmit }: {
  tipo: FormAcaoTipo; clientes: { id: string; nome: string }[]; clienteAtualId: string | null;
  pending: boolean; onCancel: () => void;
  onSubmit: (dados: { data_agendada: string; cliente_id?: string; observacoes?: string }) => void;
}) {
  const [data, setData] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>(clienteAtualId ?? "");
  const [observacoes, setObservacoes] = useState<string>("");

  const titulo = tipo === "marcar_vistoria" ? "Agendar 1a vistoria"
    : tipo === "agendar_revistoria" ? "Agendar revistoria (pos-correcao)"
    : "Agendar revistoria";

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!data) return;
      onSubmit({ data_agendada: new Date(data).toISOString(), cliente_id: clienteId || undefined, observacoes: observacoes || undefined });
    }} className="mt-3 bg-gray-50 border rounded-lg p-3 space-y-2">
      <div className="text-xs font-medium text-gray-700">{titulo}</div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input required type="datetime-local" value={data} onChange={(e) => setData(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm bg-white" />
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm bg-white">
          <option value="">(sem cliente)</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
        placeholder="observacoes (opcional)" className="w-full border rounded px-3 py-2 text-sm bg-white" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded border">Cancelar</button>
        <button type="submit" disabled={pending} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50">
          {pending ? "..." : "Confirmar"}
        </button>
      </div>
    </form>
  );
}

type EvTimeline = { titulo: string; quando: string; cor: string; tsMs: number };
function construirTimeline(historico: HistoricoStatus[], agendas: Agenda[]): EvTimeline[] {
  const evs: EvTimeline[] = [];
  for (const h of historico) {
    const ts = new Date(h.alterado_em).getTime();
    const ui = dbParaUI(h.status_novo as StatusUnidade);
    const titulo = h.status_anterior
      ? `Status: ${STATUS_LABELS_UI[dbParaUI(h.status_anterior as StatusUnidade)]} -> ${STATUS_LABELS_UI[ui]}`
      : `Status inicial: ${STATUS_LABELS_UI[ui]}`;
    evs.push({ titulo, quando: new Date(h.alterado_em).toLocaleString("pt-BR"), cor: STATUS_COLORS_UI[ui].bg, tsMs: ts });
  }
  for (const a of agendas) {
    const ts = new Date(a.data_agendada).getTime();
    evs.push({
      titulo: `Agenda ${a.tipo} - ${a.status_agenda}${a.resultado ? ` - ${a.resultado}` : ""}`,
      quando: new Date(a.data_agendada).toLocaleString("pt-BR"),
      cor: a.status_agenda === "cancelada" ? "bg-gray-400" : a.resultado === "aprovada" ? "bg-emerald-500" : a.resultado === "reprovada" ? "bg-red-500" : "bg-blue-500",
      tsMs: ts
    });
  }
  evs.sort((a, b) => b.tsMs - a.tsMs);
  return evs;
}
