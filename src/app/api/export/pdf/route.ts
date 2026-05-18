/**
 * GET /api/export/pdf?tipo=<dashboard|agenda|unidade|mapa>&obraId=<uuid>&...
 *
 * Estrategia:
 *   1) Identifica o usuario logado (cookies)
 *   2) Constroi a URL absoluta de uma pagina /print/...
 *      A pagina e renderizada SSR com o usuario autenticado
 *   3) Puppeteer abre essa URL passando os cookies da sessao
 *   4) Captura PDF e retorna
 *
 * Nota Vercel/serverless: Puppeteer com Chromium embutido pesa muito em
 * serverless. Para producao, usar @sparticuz/chromium + puppeteer-core.
 * Em desenvolvimento local com `puppeteer` instalado, funciona out-of-the-box.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Tipo = "dashboard" | "agenda" | "unidade" | "mapa";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tipo = (url.searchParams.get("tipo") || "") as Tipo;
  const obraId = url.searchParams.get("obraId");
  const periodo = url.searchParams.get("periodo") || "todos";
  const unidadeId = url.searchParams.get("unidadeId");
  const torreId = url.searchParams.get("torreId");
  if (!tipo) return NextResponse.json({ error: "tipo obrigatorio" }, { status: 400 });
  if (tipo !== "unidade" && !obraId) return NextResponse.json({ error: "obraId obrigatorio" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "nao autenticado" }, { status: 401 });

  // Em serverless (Vercel) o Chromium embutido do `puppeteer` nao roda.
  // Para nao quebrar deploy, retornamos um erro amigavel.
  // Excel continua funcionando normalmente em produc cao.
  if (process.env.VERCEL && !process.env.ENABLE_PDF_VERCEL) {
    return NextResponse.json({
      error: "Geração de PDF não está disponível neste deployment. Use Excel ou rode o app localmente para gerar PDFs."
    }, { status: 503 });
  }

  // monta URL da pagina /print
  const origin = req.nextUrl.origin;
  let printPath = "";
  switch (tipo) {
    case "dashboard": printPath = `/print/dashboard?obraId=${obraId}`; break;
    case "agenda":    printPath = `/print/agenda?obraId=${obraId}&periodo=${encodeURIComponent(periodo)}`; break;
    case "unidade":   printPath = `/print/unidade?unidadeId=${unidadeId}`; break;
    case "mapa":      printPath = `/print/mapa?obraId=${obraId}${torreId ? `&torreId=${torreId}` : ""}`; break;
  }
  const printUrl = `${origin}${printPath}`;

  // serializa cookies da sessao para o Puppeteer
  const cookieStore = cookies();
  const cookiesArr = cookieStore.getAll().map((c) => {
    const u = new URL(origin);
    return {
      name: c.name,
      value: c.value,
      domain: u.hostname,
      path: "/",
      httpOnly: false,
      secure: u.protocol === "https:",
      sameSite: "Lax" as const
    };
  });

  let puppeteer: any;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch (e: any) {
    return NextResponse.json({
      error: "Puppeteer nao instalado. Rode `npm install` na raiz do projeto."
    }, { status: 500 });
  }

  let browser: any;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const page = await browser.newPage();
    await page.setCookie(...cookiesArr);
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1.5 });
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
    // Pequeno wait para garantir paint de charts
    await new Promise((r) => setTimeout(r, 400));
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "12mm", bottom: "16mm", left: "12mm" }
    });
    await browser.close();
    const fname = `${tipo}_${new Date().toISOString().slice(0,10)}.pdf`;
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (e: any) {
    if (browser) try { await browser.close(); } catch {}
    return NextResponse.json({ error: `Falha ao gerar PDF: ${e?.message ?? e}` }, { status: 500 });
  }
}
