/**
 * GET /api/export/aprovadas-2a-pdf?obraId=<uuid>
 *
 * PDF com a lista dos apartamentos aprovados a partir da 2a vistoria
 * (status aprovada_2a_mais) + resumo com contagem e percentual sobre
 * o total de aprovados. Usa @react-pdf/renderer (funciona no Vercel).
 *
 * RLS: cliente Supabase com a sessao do usuario (cookies).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  Document, Page, View, Text, StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// ── tipos locais ─────────────────────────────────────────────────────────────
type Linha = {
  identificador: string;
  torre: string;
  cliente: string;
  reprovacoes: number;
  aprovadoEm: string;
};

// ── estilos ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:      { padding: 28, fontFamily: "Helvetica", fontSize: 9, color: "#111827", backgroundColor: "#ffffff" },
  header:    { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 8 },
  metaLabel: { fontSize: 7, color: "#6b7280", letterSpacing: 1 },
  title:     { fontSize: 17, fontWeight: "bold", marginTop: 2 },
  meta:      { fontSize: 7, color: "#6b7280", marginTop: 3 },

  cards:     { flexDirection: "row", gap: 8, marginBottom: 14 },
  card:      { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 6, padding: 8 },
  cardLbl:   { fontSize: 6.5, color: "#6b7280", textTransform: "uppercase" },
  cardVal:   { fontSize: 15, fontWeight: "bold", marginTop: 2 },
  cardSub:   { fontSize: 7, color: "#9ca3af", marginTop: 1 },
  cardHi:    { borderColor: "#10b981", backgroundColor: "#ecfdf5" },

  tblHdrRow: { flexDirection: "row", backgroundColor: "#f9fafb", paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tblRow:    { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" },
  th:        { fontSize: 7.5, fontWeight: "bold", color: "#374151" },
  td:        { fontSize: 8, color: "#374151" },
  cNum:      { width: 18, textAlign: "right", paddingRight: 4, color: "#9ca3af" },
  cApt:      { flex: 1.3 },
  cTorre:    { width: 34, textAlign: "center" },
  cCli:      { flex: 2.6 },
  cRep:      { width: 62, textAlign: "center" },
  cData:     { width: 62, textAlign: "right" },

  footer:    { position: "absolute", bottom: 16, left: 28, right: 28, fontSize: 6, color: "#9ca3af", borderTopWidth: 0.5, borderTopColor: "#e5e7eb", paddingTop: 3 },
});

// ── componente PDF ────────────────────────────────────────────────────────────
function Aprovadas2aDoc({
  obraNome, linhas, aprov1a, aprov2a, pct1a, pct2a,
}: {
  obraNome: string;
  linhas: Linha[];
  aprov1a: number;
  aprov2a: number;
  pct1a: number;
  pct2a: number;
}) {
  const now = new Date().toLocaleString("pt-BR");
  const total = aprov1a + aprov2a;

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Cabeçalho */}
        <View style={S.header}>
          <Text style={S.metaLabel}>RELATÓRIO DE QUALIDADE</Text>
          <Text style={S.title}>{obraNome}</Text>
          <Text style={S.meta}>
            Apartamentos aprovados a partir da 2ª vistoria{"   "}·{"   "}Gerado em {now}
          </Text>
        </View>

        {/* Resumo */}
        <View style={S.cards}>
          <View style={[S.card, S.cardHi]}>
            <Text style={S.cardLbl}>Aprovados na 2ª+</Text>
            <Text style={S.cardVal}>{aprov2a}</Text>
            <Text style={S.cardSub}>{pct2a}% do total aprovado</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLbl}>Aprovados na 1ª</Text>
            <Text style={S.cardVal}>{aprov1a}</Text>
            <Text style={S.cardSub}>{pct1a}% do total aprovado</Text>
          </View>
          <View style={S.card}>
            <Text style={S.cardLbl}>Total aprovados</Text>
            <Text style={S.cardVal}>{total}</Text>
            <Text style={S.cardSub}>1ª + 2ª+ vistoria</Text>
          </View>
        </View>

        {/* Tabela */}
        <View style={S.tblHdrRow}>
          <Text style={[S.th, S.cNum]}>#</Text>
          <Text style={[S.th, S.cApt]}>Apartamento</Text>
          <Text style={[S.th, S.cTorre]}>Torre</Text>
          <Text style={[S.th, S.cCli]}>Cliente</Text>
          <Text style={[S.th, S.cRep]}>Reprovações</Text>
          <Text style={[S.th, S.cData]}>Aprovado em</Text>
        </View>
        {linhas.map((l, i) => (
          <View key={l.identificador} style={S.tblRow} wrap={false}>
            <Text style={[S.td, S.cNum]}>{i + 1}</Text>
            <Text style={[S.td, S.cApt]}>{l.identificador}</Text>
            <Text style={[S.td, S.cTorre]}>{l.torre}</Text>
            <Text style={[S.td, S.cCli]}>{l.cliente}</Text>
            <Text style={[S.td, S.cRep]}>{l.reprovacoes}</Text>
            <Text style={[S.td, S.cData]}>{l.aprovadoEm}</Text>
          </View>
        ))}

        {linhas.length === 0 && (
          <Text style={{ fontSize: 9, color: "#9ca3af", marginTop: 12 }}>
            Nenhum apartamento aprovado a partir da 2ª vistoria.
          </Text>
        )}

        {/* Rodapé */}
        <View style={S.footer} fixed>
          <Text>App Vistorias — Relatório de aprovados na 2ª vistoria gerado em {now}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── handler ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const obraId = url.searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatorio" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao autenticado" }, { status: 401 });

  const { data: obra } = await supabase.from("obras").select("nome").eq("id", obraId).maybeSingle();
  if (!obra) return NextResponse.json({ error: "obra nao encontrada" }, { status: 404 });

  const [{ data: unidades }, { data: torres }, { data: clientes }] = await Promise.all([
    supabase.from("unidades").select("id, identificador, status, torre_id, cliente_atual_id").eq("obra_id", obraId),
    supabase.from("torres").select("id, nome").eq("obra_id", obraId),
    supabase.from("clientes").select("id, nome").eq("obra_id", obraId),
  ]);

  const todas = (unidades ?? []) as { id: string; identificador: string; status: string; torre_id: string; cliente_atual_id: string | null }[];
  const tMap = new Map((torres ?? []).map((t: any) => [t.id, t.nome as string]));
  const cMap = new Map((clientes ?? []).map((c: any) => [c.id, c.nome as string]));

  const aprov1a = todas.filter((u) => u.status === "aprovada_1a").length;
  const alvo = todas.filter((u) => u.status === "aprovada_2a_mais");
  const aprov2a = alvo.length;
  const total = aprov1a + aprov2a;
  const pct2a = total ? Math.round((aprov2a / total) * 1000) / 10 : 0;
  const pct1a = total ? Math.round((aprov1a / total) * 1000) / 10 : 0;

  // Historico das unidades-alvo: contagem de reprovacoes + data da aprovacao 2a
  const alvoIds = alvo.map((u) => u.id);
  const reprovCount = new Map<string, number>();
  const aprovData = new Map<string, string>();
  if (alvoIds.length > 0) {
    const { data: hist } = await supabase
      .from("historico_status")
      .select("unidade_id, status_novo, alterado_em")
      .in("unidade_id", alvoIds)
      .in("status_novo", ["reprovada", "aprovada_2a_mais"])
      .order("alterado_em", { ascending: true });
    for (const h of (hist ?? []) as { unidade_id: string; status_novo: string; alterado_em: string }[]) {
      if (h.status_novo === "reprovada") {
        reprovCount.set(h.unidade_id, (reprovCount.get(h.unidade_id) ?? 0) + 1);
      } else {
        aprovData.set(h.unidade_id, h.alterado_em); // fica com o mais recente (ordem asc)
      }
    }
  }

  const fmtData = (iso: string | undefined) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  const linhas: Linha[] = alvo
    .map((u) => ({
      identificador: u.identificador,
      torre: tMap.get(u.torre_id) ?? "",
      cliente: u.cliente_atual_id ? (cMap.get(u.cliente_atual_id) ?? "") : "—",
      reprovacoes: reprovCount.get(u.id) ?? 0,
      aprovadoEm: fmtData(aprovData.get(u.id)),
    }))
    .sort((a, b) => a.identificador.localeCompare(b.identificador));

  const pdfBuffer = await renderToBuffer(
    <Aprovadas2aDoc
      obraNome={(obra as any).nome}
      linhas={linhas}
      aprov1a={aprov1a}
      aprov2a={aprov2a}
      pct1a={pct1a}
      pct2a={pct2a}
    />
  );

  const nomeSanitizado = (obra as any).nome.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fname = `aprovadas_2a_${nomeSanitizado}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
