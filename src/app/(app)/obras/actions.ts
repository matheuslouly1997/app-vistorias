"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarObra(formData: FormData) {
  const supabase = createClient();
  const nome = String(formData.get("nome") ?? "").trim();
  const endereco = String(formData.get("endereco") ?? "").trim() || null;
  const data_inicio = String(formData.get("data_inicio") ?? "").trim() || null;
  if (!nome) return { erro: "Informe o nome da obra." };

  const { error } = await supabase.from("obras").insert({ nome, endereco, data_inicio });
  if (error) return { erro: error.message };
  revalidatePath("/obras");
  return { ok: true };
}
