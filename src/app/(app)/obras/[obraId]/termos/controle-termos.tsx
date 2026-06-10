"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { excluirTermo, salvarTermo, atualizarDataAssinaturaTermo } from "../mapa/termos-actions";
import { STATUS_LABELS } from "@/lib/constants/status";
import type { StatusUnidade } from "@/lib/types/database";

export type FilaTermo = {
  unidadeId: string;
  identificador: string;
  torreNome: string;
  status: StatusUnidade;
  dataAgendamento: string | null;
  dataAprovacao: string | null;
  temTermo: boolean;
  termoId: string | null;
  termoArquivoPath: string | null;
  termoArquivoNome: string | null;
  termoDataAnexado: string | null;
  termoDataAssinatura: string | null;
  termoDivergente: boolean;
  agendaId: string | null;
};

type FiltroTermo = "todas" | "com_termo" | "sem_termo" | "divergente";

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function StatusChip({ status }: { status: StatusUnidade }) {
  const label = STATUS_LABELS[status] ?? status;
  const colors: Partial<Record<StatusUnidade, string>> = {
    em_obra: "bg-slate-100 text-slate-700",
    em_correcao: "bg-slate-100 text-slate-700",
    finalizada_obra: "bg-sky-100 text-sky-800",
    agendado: "bg-blue-100 text-blue-800",
    aprovada_1a: "bg-emerald-100 text-emerald-800",
    aprovada_2a_mais: "bg-emerald-100 text-emerald-800",
    reprovada: "bg-red-100 text-red-800",
    revistoria: "bg-orange-100 text-orange-800",
    entregue: "bg-slate-900 text-white",
    em_correcao_pos_reprovacao: "bg-purple-100 text-purple-900",
    pronta_revistoria: "bg-amber-100 text-amber-900",
  };
  return (
    <span className={`inline-block text-[11px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${colors[status] ?? "bg-gray-100 text-gray-700"}`}>
      {label}
    </span>
  );
}

export default function ControleTermos({
  filas,
  obraId,
  torres,
}: {
  filas: FilaTermo[];
  obraId: string;
  torres: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [filtroTermo, setFiltroTermo] = useState<FiltroTermo>("todas");
  const [filtroTorre, setFiltroTorre] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todas");

  // Edit date_assinatura
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaData, setNovaData] = useState("");
  const [salvandoData, setSalvandoData] = useState(false);

  // Inline upload form
  const [anexandoId, setAnexandoId] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [resultadoUpload, setResultadoUpload] = useState<"aprovacao" | "reprovacao">("aprovacao");
  const [uploading, setUploading] = useState(false);

  // Confirm delete
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const torresNomes = [...new Set(filas.map((f) => f.torreNome).filter(Boolean))].sort();
  const statusUnicos = [...new Set(filas.map((f) => f.status))].sort();

  const filtradas = filas.filter((f) => {
    if (filtroTermo === "com_termo" && !f.temTermo) return false;
    if (filtroTermo === "sem_termo" && f.temTermo) return false;
    if (filtroTermo === "divergente" && !f.termoDivergente) return false;
    if (filtroTorre !== "todas" && f.torreNome !== filtroTorre) return false;
    if (filtroStatus !== "todas" && f.status !== filtroStatus) return false;
    return true;
  });

  // ---- actions ----

  async function handleBaixar(arquivoPath: string) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("termos-unidade")
      .createSignedUrl(arquivoPath, 300);
    if (error || !data) { toast.erro("Erro ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function handleVisualizar(arquivoPath: string) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("termos-unidade")
      .createSignedUrl(arquivoPath, 300);
    if (error || !data) { toast.erro("Erro ao gerar link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function handleExcluir(termoId: string, arquivoPath: string) {
    setRemovendoId(termoId);
    const r = await excluirTermo(termoId, arquivoPath);
    setRemovendoId(null);
    if (r.erro) { toast.erro(r.erro); return; }
    toast.sucesso("Termo removido");
    router.refresh();
  }

  function abrirEdicaoData(f: FilaTermo) {
    if (!f.termoId) return;
    setEditandoId(f.termoId);
    setNovaData(f.termoDataAssinatura?.slice(0, 10) ?? "");
  }

  async function handleSalvarData(termoId: string) {
    setSalvandoData(true);
    const r = await atualizarDataAssinaturaTermo(termoId, novaData || null);
    setSalvandoData(false);
    if (r.erro) { toast.erro(r.erro); return; }
    setEditandoId(null);
    toast.sucesso("Data de assinatura salva");
    router.refresh();
  }

  async function handleUpload(unidadeId: string, agendaId: string | null) {
    if (!arquivo) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = arquivo.name.split(".").pop() ?? "pdf";
      const path = `${unidadeId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("termos-unidade")
        .upload(path, arquivo);
      if (upErr) { toast.erro(upErr.message); return; }
      const r = await salvarTermo({
        unidadeId,
        agendaId,
        resultado: resultadoUpload,
        arquivoPath: path,
      });
      if (r.erro) {
        await supabase.storage.from("termos-unidade").remove([path]);
        toast.erro(r.erro);
        return;
      }
      setAnexandoId(null);
      setArquivo(null);
      toast.sucesso("Termo anexado");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function exportarExcel() {
    window.location.href = `/api/export/excel?tipo=termos&obraId=${obraId}`;
  }

  // ---- render ----

  const qtdDivergente = filas.filter((f) => f.termoDivergente).length;
  const qtdSemTermo = filas.filter((f) => !f.temTermo).length;

  return (
    <div className="max-w-full mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Controle de Termos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {filas.length} unidades &middot; {filas.filter((f) => f.temTermo).length} com termo
            {qtdSemTermo > 0 && ` · ${qtdSemTermo} sem termo`}
            {qtdDivergente > 0 && (
              <span className="ml-1 text-amber-700 font-medium">· {qtdDivergente} divergente{qtdDivergente > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <button
          onClick={exportarExcel}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border hover:bg-gray-50"
        >
          ↓ Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Filtro termo */}
        <div className="flex rounded-md border overflow-hidden text-sm">
          {(["todas", "com_termo", "sem_termo", "divergente"] as FiltroTermo[]).map((v) => (
            <button
              key={v}
              onClick={() => setFiltroTermo(v)}
              className={`px-3 py-1.5 border-r last:border-r-0 ${
                filtroTermo === v ? "bg-gray-900 text-white" : "hover:bg-gray-50"
              }`}
            >
              {v === "todas" ? "Todas"
                : v === "com_termo" ? "Com termo"
                : v === "sem_termo" ? "Sem termo"
                : "Data divergente"}
            </button>
          ))}
        </div>

        {/* Filtro torre */}
        {torresNomes.length > 1 && (
          <select
            value={filtroTorre}
            onChange={(e) => setFiltroTorre(e.target.value)}
            className="border rounded-md px-2 py-1.5 text-sm bg-white"
          >
            <option value="todas">Todas as torres</option>
            {torresNomes.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        )}

        {/* Filtro status */}
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="border rounded-md px-2 py-1.5 text-sm bg-white"
        >
          <option value="todas">Todos os status</option>
          {statusUnicos.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>

        {(filtroTermo !== "todas" || filtroTorre !== "todas" || filtroStatus !== "todas") && (
          <button
            onClick={() => { setFiltroTermo("todas"); setFiltroTorre("todas"); setFiltroStatus("todas"); }}
            className="text-sm text-gray-500 hover:text-gray-900 underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Unidade</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Torre</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Data agendamento</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Data aprovacao</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Termo</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Data assinatura</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Arquivo</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400 text-sm">
                  Nenhuma unidade encontrada com os filtros selecionados.
                </td>
              </tr>
            )}
            {filtradas.map((f) => (
              <tr key={f.unidadeId} className={f.termoDivergente ? "bg-amber-50" : ""}>
                {/* Unidade */}
                <td className="px-3 py-2.5 font-medium whitespace-nowrap">{f.identificador}</td>

                {/* Torre */}
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{f.torreNome || "—"}</td>

                {/* Status */}
                <td className="px-3 py-2.5">
                  <StatusChip status={f.status} />
                </td>

                {/* Data agendamento */}
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtData(f.dataAgendamento)}</td>

                {/* Data aprovacao */}
                <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtData(f.dataAprovacao)}</td>

                {/* Possui termo */}
                <td className="px-3 py-2.5">
                  {f.temTermo ? (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Sim</span>
                  ) : (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Nao</span>
                  )}
                </td>

                {/* Data assinatura (editavel) */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {f.termoId && editandoId === f.termoId ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={novaData}
                        onChange={(e) => setNovaData(e.target.value)}
                        className="border rounded px-1.5 py-0.5 text-xs w-32 bg-white"
                      />
                      <button
                        onClick={() => handleSalvarData(f.termoId!)}
                        disabled={salvandoData}
                        className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white disabled:opacity-50"
                      >
                        {salvandoData ? "..." : "Ok"}
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="text-xs px-2 py-0.5 rounded border text-gray-600"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className={f.termoDivergente ? "text-amber-700 font-medium" : "text-gray-600"}>
                        {f.termoDataAssinatura
                          ? fmtData(f.termoDataAssinatura)
                          : f.termoDataAnexado
                          ? <span className="text-gray-400 italic">{fmtDataHora(f.termoDataAnexado)}</span>
                          : "—"}
                      </span>
                      {f.termoDivergente && (
                        <span title="Data do termo difere da data do agendamento" className="text-amber-600 text-xs">⚠</span>
                      )}
                      {f.termoId && (
                        <button
                          onClick={() => abrirEdicaoData(f)}
                          title="Editar data de assinatura"
                          className="text-gray-400 hover:text-gray-700 text-xs leading-none"
                        >
                          ✏
                        </button>
                      )}
                    </div>
                  )}
                </td>

                {/* Nome do arquivo */}
                <td className="px-3 py-2.5 text-gray-500 max-w-[180px] truncate" title={f.termoArquivoNome ?? ""}>
                  {f.termoArquivoNome ?? "—"}
                </td>

                {/* Acoes */}
                <td className="px-3 py-2.5">
                  {anexandoId === f.unidadeId ? (
                    <div className="flex flex-col gap-1.5 min-w-[220px]">
                      <select
                        value={resultadoUpload}
                        onChange={(e) => setResultadoUpload(e.target.value as any)}
                        className="border rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="aprovacao">Aprovacao</option>
                        <option value="reprovacao">Reprovacao</option>
                      </select>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                        className="text-xs"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleUpload(f.unidadeId, f.agendaId)}
                          disabled={!arquivo || uploading}
                          className="text-xs px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
                        >
                          {uploading ? "Enviando..." : "Salvar"}
                        </button>
                        <button
                          onClick={() => { setAnexandoId(null); setArquivo(null); }}
                          className="text-xs px-2 py-1 rounded border"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {f.temTermo && f.termoArquivoPath && (
                        <>
                          <button
                            onClick={() => handleVisualizar(f.termoArquivoPath!)}
                            className="text-xs px-2 py-1 rounded border text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                          >
                            Visualizar
                          </button>
                          <button
                            onClick={() => handleBaixar(f.termoArquivoPath!)}
                            className="text-xs px-2 py-1 rounded border text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                          >
                            Baixar
                          </button>
                          <button
                            onClick={() => {
                              if (removendoId === f.termoId) return;
                              if (confirm(`Remover o termo da unidade ${f.identificador}?`)) {
                                handleExcluir(f.termoId!, f.termoArquivoPath!);
                              }
                            }}
                            disabled={removendoId === f.termoId}
                            className="text-xs px-2 py-1 rounded border text-red-700 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                          >
                            {removendoId === f.termoId ? "..." : "Remover"}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => { setAnexandoId(f.unidadeId); setArquivo(null); setResultadoUpload("aprovacao"); }}
                        className="text-xs px-2 py-1 rounded border border-dashed text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                      >
                        + Anexar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        {filtradas.length} de {filas.length} unidades exibidas.
        {filtroTermo === "todas" && filtroTorre === "todas" && filtroStatus === "todas" ? "" : " Filtro ativo."}
      </p>
    </div>
  );
}
