/**
 * GET /api/export/excel?tipo=<agenda|clientes|unidades|kpi>&obraId=<uuid>&periodo=<hoje|semana|todos>
 *
 * Retorna um arquivo .xlsx. SheetJS gera o buffer em memoria.
 *
 * RLS: usa o cliente Supabase com a sessao do usuario (cookies), entao
 * so retorna o que o usuario pode ver via policies.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

type Tipo = "agenda" | "clientes" | "unidades" | "kpi";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tipo = (url.searchParams.get("tipo") || "") as Tipo;
  const obraId = url.searchParams.get("obraId");
  const periodo = url.searchParams.get("periodo") || "todos";
  if (!obraId || !tipo) return NextResponse.json({ error: "obraId e tipo obrigatorios" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao autenticado" }, { status: 401 });

  const { data: obra } = await supabase.from("obras").select("nome").eq("id", obraId).maybeSingle();
  if (!obra) return NextResponse.json({ error: "obra nao encontrada" }, { status: 404 });

  let rows: Record<string, unknown>[] = [];
  let abaNome = "Export";
  switch (tipo) {
    case "agenda":   { ({ rows, abaNome } = await rowsAgenda(supabase, obraId, periodo));   break; }
    case "clientes": { ({ rows, abaNome } = await rowsClientes(supabase, obraId));          break; }
    case "unidades": { ({ rows, abaNome } = await rowsUnidades(supabase, obraId));          break; }
    case "kpi":      { ({ rows, abaNome } = await rowsKpi(supabase, obraId));               break; }
    default: return NextResponse.json({ error: "tipo invalido" }, { status: 400 });
  }

  // monta a planilha
  const ws = XLSX.utils.json_to_sheet(rows);
  // ajusta larguras automaticamente
  const cols: { wch: number }[] = [];
  if (rows[0]) {
    for (const key of Object.keys(rows[0])) {
      const max = Math.max(key.length, ...rows.map((r) => String(r[key] ?? "").length));
      cols.push({ wch: Math.min(Math.max(max + 2, 8), 50) });
    }
    ws["!cols"] = cols;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, abaNome);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  const fname = `${slug((obra as any).nome)}_${tipo}_${new Date().toISOString().slice(0,10)}.xlsx`;
  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store"
    }
  });
}

/* ============================================================ */
async function rowsAgenda(supabase: ReturnType<typeof createClient>, obraId: string, periodo: string) {
  let q = supabase.from("agenda")
    .select(`id, tipo, data_agendada, duracao_min, status_agenda, resultado, observacoes,
             unidade_id, cliente_id`)
    .eq("obra_id", obraId)
    .order("data_agendada", { ascending: true });

  const { ini, fim } = rangePeriodo(periodo);
  if (ini) q = q.gte("data_agendada", ini.toISOString());
  if (fim) q = q.lte("data_agendada", fim.toISOString());

  const { data: agenda } = await q;
  const { data: unidades } = await supabase.from("unidades")
    .select("id, identificador").eq("obra_id", obraId);
  const { data: clientes } = await supabase.from("clientes")
    .select("id, nome, telefone").eq("obra_id", obraId);
  const uMap = new Map((unidades ?? []).map((u: any) => [u.id, u]));
  const cMap = new Map((clientes ?? []).map((c: any) => [c.id, c]));

  const rows = (agenda ?? []).map((a: any) => {
    const d = new Date(a.data_agendada);
    const c = a.cliente_id ? cMap.get(a.cliente_id) : null;
    return {
      Data: d.toLocaleDateString("pt-BR"),
      Horario: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      Unidade: uMap.get(a.unidade_id)?.identificador ?? "?",
      Cliente: c?.nome ?? "",
      Telefone: c?.telefone ?? "",
      Tipo: a.tipo,
      Status: a.status_agenda,
      Resultado: a.resultado ?? "",
      "Duracao (min)": a.duracao_min,
      Observacoes: a.observacoes ?? ""
    };
  });
  return { rows, abaNome: "Agenda" };
}

async function rowsClientes(supabase: ReturnType<typeof createClient>, obraId: string) {
  const { data } = await supabase.from("clientes")
    .select("nome, cpf, telefone, email, observacoes, created_at")
    .eq("obra_id", obraId).order("nome");
  const rows = (data ?? []).map((c: any) => ({
    Nome: c.nome, CPF: c.cpf ?? "", Telefone: c.telefone ?? "",
    Email: c.email ?? "", Observacoes: c.observacoes ?? "",
    "Cadastrado em": new Date(c.created_at).toLocaleDateString("pt-BR")
  }));
  return { rows, abaNome: "Clientes" };
}

async function rowsUnidades(supabase: ReturnType<typeof createClient>, obraId: string) {
  const { data: unidades } = await supabase.from("unidades")
    .select("id, identificador, pavimento, codigo_unidade, status, cliente_atual_id, torre_id, observacoes")
    .eq("obra_id", obraId).order("identificador");
  const { data: torres } = await supabase.from("torres").select("id, nome").eq("obra_id", obraId);
  const { data: clientes } = await supabase.from("clientes").select("id, nome, telefone").eq("obra_id", obraId);
  const tMap = new Map((torres ?? []).map((t: any) => [t.id, t]));
  const cMap = new Map((clientes ?? []).map((c: any) => [c.id, c]));
  const rows = (unidades ?? []).map((u: any) => ({
    Identificador: u.identificador,
    Torre: tMap.get(u.torre_id)?.nome ?? "",
    Pavimento: u.pavimento,
    "Codigo unidade": u.codigo_unidade,
    Status: u.status,
    "Cliente atual": u.cliente_atual_id ? cMap.get(u.cliente_atual_id)?.nome ?? "" : "",
    "Telefone cliente": u.cliente_atual_id ? cMap.get(u.cliente_atual_id)?.telefone ?? "" : "",
    Observacoes: u.observacoes ?? ""
  }));
  return { rows, abaNome: "Unidades" };
}

async function rowsKpi(supabase: ReturnType<typeof createClient>, obraId: string) {
  const { data } = await supabase.from("vw_central_aprovacao" as any).select("*").eq("obra_id", obraId).maybeSingle();
  if (!data) return { rows: [], abaNome: "KPIs" };
  const k = data as any;
  const rows = [
    { Metrica: "Obra",                              Valor: k.obra },
    { Metrica: "Taxa aprovacao 1a (oficial)",       Valor: `${k.taxa_aprovacao_1a_oficial}%` },
    { Metrica: "Aprovadas 1a (hist)",               Valor: k.aprovadas_1a_hist },
    { Metrica: "Reprovadas 1a (hist)",              Valor: k.reprovadas_1a_hist },
    { Metrica: "Total 1a executadas (hist)",        Valor: k.total_1a_vistoriadas_hist },
    { Metrica: "Em obra",                           Valor: k.em_obra },
    { Metrica: "Em correcao",                       Valor: k.em_correcao },
    { Metrica: "Finalizada obra",                   Valor: k.finalizada_obra },
    { Metrica: "Agendadas",                         Valor: k.agendadas },
    { Metrica: "Aprovadas 1a (atual)",              Valor: k.aprovadas_1a_atual },
    { Metrica: "Reprovadas (atual)",                Valor: k.reprovadas_atual },
    { Metrica: "Revistorias",                       Valor: k.revistorias },
    { Metrica: "Aprovadas 2a+ (atual)",             Valor: k.aprovadas_2a_mais },
    { Metrica: "Entregues",                         Valor: k.entregues },
    { Metrica: "Vistoriadas (atual)",               Valor: k.vistoriadas }
  ];
  return { rows, abaNome: "KPIs" };
}

/* ============================================================ */
function rangePeriodo(periodo: string): { ini: Date | null; fim: Date | null } {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  if (periodo === "hoje") {
    const fim = new Date(hoje); fim.setHours(23,59,59,999);
    return { ini: hoje, fim };
  }
  if (periodo === "amanha") {
    const ini = new Date(hoje); ini.setDate(ini.getDate()+1);
    const fim = new Date(ini); fim.setHours(23,59,59,999);
    return { ini, fim };
  }
  if (periodo === "semana" || periodo === "proximos7") {
    const fim = new Date(hoje); fim.setDate(fim.getDate()+6); fim.setHours(23,59,59,999);
    return { ini: hoje, fim };
  }
  return { ini: null, fim: null };
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
