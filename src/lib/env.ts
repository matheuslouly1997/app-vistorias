/**
 * Diagnostico seguro de envs publicas.
 * Nunca expoe a key completa, so prefixo + sufixo.
 */

export type EnvStatus = {
  urlPresente: boolean;
  urlDominio: string | null;       // ex: "iwrjjtptsqdxaidzerde.supabase.co"
  urlBruta: string | null;
  keyPresente: boolean;
  keyFormato: "jwt-legado" | "sb_publishable" | "sb_secret" | "desconhecido" | null;
  keyMascarada: string | null;     // ex: "sb_publishable_yhYE...sGiJRJLL"
};

/** Mascara uma key mostrando prefixo + 4 chars iniciais do corpo + ... + 4 chars finais. */
function mascararKey(k: string): string {
  if (!k) return "";
  const prefixos = ["sb_publishable_", "sb_secret_"];
  for (const p of prefixos) {
    if (k.startsWith(p)) {
      const corpo = k.slice(p.length);
      const head = corpo.slice(0, 4);
      const tail = corpo.slice(-4);
      return `${p}${head}...${tail}`;
    }
  }
  if (k.startsWith("eyJ")) {
    return `${k.slice(0, 6)}...${k.slice(-4)} (JWT)`;
  }
  return `${k.slice(0, 4)}...${k.slice(-4)}`;
}

function detectarFormato(k: string | null | undefined): EnvStatus["keyFormato"] {
  if (!k) return null;
  if (k.startsWith("sb_publishable_")) return "sb_publishable";
  if (k.startsWith("sb_secret_"))      return "sb_secret";
  if (k.startsWith("eyJ"))             return "jwt-legado";
  return "desconhecido";
}

export function lerEnvStatus(): EnvStatus {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  let urlDominio: string | null = null;
  let urlBruta: string | null = null;
  if (url) {
    try {
      const u = new URL(url);
      urlDominio = u.host;
      urlBruta = url.length > 60 ? `${url.slice(0, 30)}...${url.slice(-15)}` : url;
    } catch {
      urlDominio = "(URL invalida)";
      urlBruta = url;
    }
  }

  return {
    urlPresente: Boolean(url),
    urlDominio,
    urlBruta,
    keyPresente: Boolean(key),
    keyFormato: detectarFormato(key),
    keyMascarada: key ? mascararKey(key) : null
  };
}

/** Estoura com mensagem clara se algo faltar. Usado pelos clients. */
export function exigirEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const status = lerEnvStatus();
    const msg = [
      "Variaveis Supabase ausentes ou nao carregadas.",
      `  NEXT_PUBLIC_SUPABASE_URL presente: ${status.urlPresente}`,
      `  NEXT_PUBLIC_SUPABASE_ANON_KEY presente: ${status.keyPresente}`,
      "Verifique se .env.local existe na raiz do projeto e se o dev server foi REINICIADO apos editar."
    ].join("\n");
    throw new Error(msg);
  }
  return { url, key };
}
