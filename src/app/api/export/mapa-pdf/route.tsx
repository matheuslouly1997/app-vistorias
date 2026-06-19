import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbParaUI, STATUS_LABELS_UI, STATUS_ORDER_UI } from "@/lib/constants/status";
import type { StatusUI } from "@/lib/constants/status";
import type { StatusUnidade } from "@/lib/types/database";
import { codigoUnidade } from "@/lib/format/unidade";
import {
  Document, Page, View, Text, StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// ── tipos locais ─────────────────────────────────────────────────────────────
type Torre = {
  id: string; nome: string; qtd_pavimentos: number;
  layout_codigos: string[]; ordem: number;
};
type Unidade = {
  id: string; torre_id: string; pavimento: number;
  codigo_unidade: string; identificador: string; status: StatusUnidade;
};

// ── cores por status ──────────────────────────────────────────────────────────
const BG: Record<StatusUI, string> = {
  em_obra:                    "#e2e8f0",
  finalizada_obra:            "#bae6fd",
  agendada:                   "#3b82f6",
  aprovada:                   "#10b981",
  reprovada:                  "#ef4444",
  reagendada:                 "#f97316",
  entregue:                   "#0f172a",
  em_correcao_pos_reprovacao: "#7e22ce",
  pronta_revistoria:          "#f59e0b",
};
const FG: Record<StatusUI, string> = {
  em_obra:                    "#1e293b",
  finalizada_obra:            "#0c4a6e",
  agendada:                   "#ffffff",
  aprovada:                   "#ffffff",
  reprovada:                  "#ffffff",
  reagendada:                 "#ffffff",
  entregue:                   "#ffffff",
  em_correcao_pos_reprovacao: "#ffffff",
  pronta_revistoria:          "#ffffff",
};

// ── estilos ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:       { padding: 24, fontFamily: "Helvetica", fontSize: 8, color: "#111827", backgroundColor: "#ffffff" },
  header:     { marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 8 },
  metaLabel:  { fontSize: 7, color: "#6b7280" },
  title:      { fontSize: 16, fontWeight: "bold", marginTop: 2 },
  meta:       { fontSize: 7, color: "#6b7280", marginTop: 3 },
  legend:     { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 10 },
  chip:       { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  chipTxt:    { fontSize: 6, fontWeight: "bold" },
  section:    { marginBottom: 12 },
  sectionHdr: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  sectionTtl: { fontSize: 9, fontWeight: "bold" },
  sectionMta: { fontSize: 7, color: "#9ca3af" },
  row:        { flexDirection: "row" },
  pavNum:     { width: 20, fontSize: 7, color: "#9ca3af", textAlign: "right", paddingRight: 3, paddingTop: 2 },
  colHdr:     { flex: 1, fontSize: 6, color: "#9ca3af", textAlign: "center", paddingBottom: 2, fontWeight: "bold" },
  cell:       { flex: 1, height: 14, marginHorizontal: 0.5, marginVertical: 0.5, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  cellTxt:    { fontSize: 6, fontWeight: "bold" },
  emptyCell:  { flex: 1, height: 14, marginHorizontal: 0.5, marginVertical: 0.5, borderRadius: 2, backgroundColor: "#f8fafc" },
  tblSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 },
  tblTitle:   { fontSize: 9, fontWeight: "bold", marginBottom: 4 },
  tblHdrRow:  { flexDirection: "row", backgroundColor: "#f9fafb", paddingVertical: 3, paddingHorizontal: 3, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tblRow:     { flexDirection: "row", paddingVertical: 2.5, paddingHorizontal: 3, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" },
  th:         { fontSize: 7, fontWeight: "bold", color: "#374151" },
  td:         { fontSize: 7, color: "#374151" },
  c1: { flex: 2 }, c2: { flex: 1 }, c3: { width: 28, textAlign: "center" }, c4: { flex: 2.5 },
  footer:     { position: "absolute", bottom: 14, left: 24, right: 24, fontSize: 6, color: "#9ca3af", borderTopWidth: 0.5, borderTopColor: "#e5e7eb", paddingTop: 3 },
});

// ── componente PDF ────────────────────────────────────────────────────────────
function MapaDoc({
  obra, torresVisiveis, allTorres, porTorrePavCodigo,
  statusesFiltro, hasFilter, unidadesFiltradas, contagem,
  torreFiltroNome, filtroLabel,
}: {
  obra: { nome: string };
  torresVisiveis: Torre[];
  allTorres: Torre[];
  porTorrePavCodigo: Map<string, Map<number, Map<string, Unidade>>>;
  statusesFiltro: StatusUI[];
  hasFilter: boolean;
  unidadesFiltradas: Unidade[];
  contagem: Record<string, number>;
  torreFiltroNome: string;
  filtroLabel: string;
}) {
  const now = new Date().toLocaleString("pt-BR");

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* Cabeçalho */}
        <View style={S.header}>
          <Text style={S.metaLabel}>MAPA DE VISTORIAS</Text>
          <Text style={S.title}>{obra.nome}</Text>
          <Text style={S.meta}>
            Torre: {torreFiltroNome}{"   "}·{"   "}Filtro: {filtroLabel}{"   "}·{"   "}Gerado em {now}
          </Text>
        </View>

        {/* Legenda */}
        <View style={S.legend}>
          {STATUS_ORDER_UI
            .filter((s) => !hasFilter || statusesFiltro.includes(s))
            .map((s) => (
              <View key={s} style={[S.chip, { backgroundColor: BG[s] }]}>
                <Text style={[S.chipTxt, { color: FG[s] }]}>
                  {STATUS_LABELS_UI[s]}{contagem[s] ? ` · ${contagem[s]}` : ""}
                </Text>
              </View>
            ))}
          {hasFilter && (
            <View style={[S.chip, { backgroundColor: "#f1f5f9" }]}>
              <Text style={[S.chipTxt, { color: "#94a3b8" }]}>
                Fora do filtro
              </Text>
            </View>
          )}
        </View>

        {/* Grade por torre */}
        {torresVisiveis.map((torre) => {
          const pavs = Array.from(
            { length: torre.qtd_pavimentos },
            (_, i) => torre.qtd_pavimentos - i
          );
          const pavMap = porTorrePavCodigo.get(torre.id);

          return (
            <View key={torre.id} style={S.section} wrap={false}>
              <View style={S.sectionHdr}>
                <Text style={S.sectionTtl}>Torre {torre.nome}</Text>
                <Text style={S.sectionMta}>
                  {torre.qtd_pavimentos} pav × {torre.layout_codigos.length} un = {torre.qtd_pavimentos * torre.layout_codigos.length}
                </Text>
              </View>

              {/* cabeçalho de colunas */}
              <View style={S.row}>
                <View style={{ width: 20 }} />
                {torre.layout_codigos.map((c) => (
                  <Text key={c} style={S.colHdr}>{c}</Text>
                ))}
              </View>

              {/* linhas de pavimento */}
              {pavs.map((pav) => (
                <View key={pav} style={S.row}>
                  <Text style={S.pavNum}>{String(pav).padStart(2, "0")}</Text>
                  {torre.layout_codigos.map((codigo) => {
                    const u = pavMap?.get(pav)?.get(codigo);
                    if (!u) return <View key={codigo} style={S.emptyCell} />;
                    const ui = dbParaUI(u.status);
                    const isActive = !hasFilter || statusesFiltro.includes(ui);
                    return (
                      <View
                        key={codigo}
                        style={[S.cell, { backgroundColor: isActive ? BG[ui] : "#f1f5f9" }]}
                      >
                        <Text style={[S.cellTxt, { color: isActive ? FG[ui] : "#cbd5e1" }]}>
                          {codigoUnidade(u.identificador)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}

        {/* Tabela de unidades filtradas */}
        {hasFilter && unidadesFiltradas.length > 0 && (
          <View style={S.tblSection}>
            <Text style={S.tblTitle}>
              Unidades com filtro aplicado ({unidadesFiltradas.length})
            </Text>
            <View style={S.tblHdrRow}>
              <Text style={[S.th, S.c1]}>Unidade</Text>
              <Text style={[S.th, S.c2]}>Torre</Text>
              <Text style={[S.th, S.c3]}>Pav.</Text>
              <Text style={[S.th, S.c4]}>Status</Text>
            </View>
            {unidadesFiltradas
              .sort((a, b) => a.identificador.localeCompare(b.identificador))
              .map((u) => {
                const ui = dbParaUI(u.status);
                const nomeT = allTorres.find((t) => t.id === u.torre_id)?.nome ?? "";
                return (
                  <View key={u.id} style={S.tblRow}>
                    <Text style={[S.td, S.c1]}>{u.identificador}</Text>
                    <Text style={[S.td, S.c2]}>{nomeT}</Text>
                    <Text style={[S.td, S.c3]}>{u.pavimento}</Text>
                    <Text style={[S.td, S.c4]}>{STATUS_LABELS_UI[ui]}</Text>
                  </View>
                );
              })}
          </View>
        )}

        {/* Rodapé */}
        <View style={S.footer} fixed>
          <Text>App Vistorias — Mapa de vistorias gerado em {now}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── handler ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const obraId      = url.searchParams.get("obraId");
  const torreId     = url.searchParams.get("torreId") || "";
  const statusesParam = url.searchParams.get("statuses") || "";

  if (!obraId) return NextResponse.json({ error: "obraId obrigatorio" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao autenticado" }, { status: 401 });

  const [{ data: obraRaw }, { data: torresRaw }, { data: unidadesRaw }] = await Promise.all([
    supabase.from("obras").select("nome, status").eq("id", obraId).maybeSingle(),
    supabase.from("torres" as any).select("id, nome, qtd_pavimentos, layout_codigos, ordem").eq("obra_id", obraId).order("ordem"),
    supabase.from("unidades").select("id, torre_id, pavimento, codigo_unidade, identificador, status").eq("obra_id", obraId),
  ]);

  const obra = obraRaw as { nome: string; status: string } | null;
  if (!obra) return NextResponse.json({ error: "obra nao encontrada" }, { status: 404 });

  const allTorres: Torre[]   = (torresRaw   as any[]) ?? [];
  const allUnidades: Unidade[] = (unidadesRaw as any[]) ?? [];

  const torresVisiveis = torreId && torreId !== "todas"
    ? allTorres.filter((t) => t.id === torreId)
    : allTorres;

  const statusesFiltro: StatusUI[] = statusesParam
    ? (statusesParam.split(",").filter(Boolean) as StatusUI[])
    : [];
  const hasFilter = statusesFiltro.length > 0;

  const porTorrePavCodigo = new Map<string, Map<number, Map<string, Unidade>>>();
  for (const u of allUnidades) {
    if (!porTorrePavCodigo.has(u.torre_id)) porTorrePavCodigo.set(u.torre_id, new Map());
    const t = porTorrePavCodigo.get(u.torre_id)!;
    if (!t.has(u.pavimento)) t.set(u.pavimento, new Map());
    t.get(u.pavimento)!.set(u.codigo_unidade, u);
  }

  const unidadesVisiveis = torresVisiveis.flatMap((t) =>
    allUnidades.filter((u) => u.torre_id === t.id)
  );
  const unidadesFiltradas = hasFilter
    ? unidadesVisiveis.filter((u) => statusesFiltro.includes(dbParaUI(u.status)))
    : unidadesVisiveis;

  const contagem: Record<string, number> = {};
  for (const u of unidadesFiltradas) {
    const ui = dbParaUI(u.status);
    contagem[ui] = (contagem[ui] ?? 0) + 1;
  }

  const torreFiltroNome = torreId && torreId !== "todas"
    ? `Torre ${allTorres.find((t) => t.id === torreId)?.nome ?? ""}`
    : "Todas as torres";
  const filtroLabel = hasFilter
    ? statusesFiltro.map((s) => STATUS_LABELS_UI[s]).join(", ")
    : "Todos os status";

  const pdfBuffer = await renderToBuffer(
    <MapaDoc
      obra={obra}
      torresVisiveis={torresVisiveis}
      allTorres={allTorres}
      porTorrePavCodigo={porTorrePavCodigo}
      statusesFiltro={statusesFiltro}
      hasFilter={hasFilter}
      unidadesFiltradas={unidadesFiltradas}
      contagem={contagem}
      torreFiltroNome={torreFiltroNome}
      filtroLabel={filtroLabel}
    />
  );

  const nomeSanitizado = obra.nome.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fname = `mapa_${nomeSanitizado}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
