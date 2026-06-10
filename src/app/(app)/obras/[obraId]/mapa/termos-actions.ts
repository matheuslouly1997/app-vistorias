"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Resp = { ok?: true; erro?: string };

export async function salvarTermo(input: {
  unidadeId: string;
  agendaId: string | null;
  resultado: "reprovacao" | "aprovacao";
  arquivoPath: string;
}): Promise<Resp> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("termos_unidade").insert({
    unidade_id: input.unidadeId,
    agenda_id: input.agendaId ?? null,
    resultado: input.resultado,
    arquivo_path: input.arquivoPath,
    anexado_por: user?.id ?? null,
  } as any);
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

export async function excluirTermo(termoId: string, arquivoPath: string): Promise<Resp> {
  const supabase = createClient();
  await supabase.storage.from("termos-unidade").remove([arquivoPath]);
  const { error } = await supabase.from("termos_unidade").delete().eq("id", termoId);
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}

export async function atualizarDataAssinaturaTermo(
  termoId: string,
  dataAssinatura: string | null,
): Promise<Resp> {
  const supabase = createClient();
  const { error } = await (supabase as any)
    .from("termos_unidade")
    .update({ data_assinatura: dataAssinatura })
    .eq("id", termoId);
  if (error) return { erro: error.message };
  revalidatePath("/obras", "layout");
  return { ok: true };
}
