"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarTorre(formData: FormData) {
  const supabase = createClient();
  const obra_id = String(formData.get("obra_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const qtd_pavimentos = Number(formData.get("qtd_pavimentos") ?? 0);
  const ordem = Number(formData.get("ordem") ?? 0);
  let layout_codigos: string[] = [];
  try { layout_codigos = JSON.parse(String(formData.get("layout_codigos") ?? "[]")); }
  catch { return { erro: "Layout de codigos invalido." }; }

  if (!obra_id || !nome) return { erro: "Dados incompletos." };
  if (qtd_pavimentos < 1) return { erro: "Pavimentos deve ser >= 1." };
  if (layout_codigos.length === 0) return { erro: "Informe ao menos um codigo de unidade." };

  const { error } = await supabase.from("torres").insert({
    obra_id, nome, qtd_pavimentos, layout_codigos, ordem
  });
  if (error) return { erro: error.message };
  revalidatePath(`/obras/${obra_id}/torres`);
  revalidatePath(`/obras/${obra_id}/mapa`);
  return { ok: true };
}
