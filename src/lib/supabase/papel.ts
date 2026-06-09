import { createClient } from "./server";

export async function getPapelAtual(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("perfis")
    .select("papel, ativo")
    .eq("id", user.id)
    .maybeSingle();
  const p = data as any;
  if (!p || p.ativo === false) return null;
  return p.papel ?? null;
}

export function ehSomenteLeitura(papel: string | null): boolean {
  return !["administrador", "escritorio", "obra"].includes(papel ?? "");
}
