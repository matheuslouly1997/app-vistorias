"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarCliente(formData: FormData) {
  const supabase = createClient();
  const obra_id = String(formData.get("obra_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const cpf = String(formData.get("cpf") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const telefone = String(formData.get("telefone") ?? "").trim() || null;
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;
  let unidades_ids: string[] = [];
  try {
    unidades_ids = JSON.parse(String(formData.get("unidades_ids") ?? "[]"));
  } catch { unidades_ids = []; }

  if (!obra_id || !nome) return { erro: "Informe pelo menos o nome." };

  const { data: novo, error } = await supabase.from("clientes")
    .insert({ obra_id, nome, cpf, email, telefone, observacoes })
    .select("id")
    .single();
  if (error) return { erro: error.message };

  if (novo && unidades_ids.length > 0) {
    const { error: errVinc } = await supabase
      .from("unidades")
      .update({ cliente_atual_id: novo.id })
      .in("id", unidades_ids)
      .eq("obra_id", obra_id);
    if (errVinc) {
      return { erro: `Cliente criado, mas falha ao vincular unidades: ${errVinc.message}` };
    }
  }

  revalidatePath(`/obras/${obra_id}/clientes`);
  revalidatePath(`/obras/${obra_id}/mapa`);
  return { ok: true };
}

export async function editarCliente(input: {
  id: string; obra_id: string;
  nome: string; cpf?: string | null; email?: string | null;
  telefone?: string | null; observacoes?: string | null;
}) {
  const supabase = createClient();
  if (!input.id || !input.nome?.trim()) return { erro: "Informe pelo menos o nome." };
  const { error } = await supabase
    .from("clientes")
    .update({
      nome: input.nome.trim(),
      cpf: input.cpf?.trim() || null,
      email: input.email?.trim() || null,
      telefone: input.telefone?.trim() || null,
      observacoes: input.observacoes?.trim() || null
    })
    .eq("id", input.id);
  if (error) return { erro: error.message };
  revalidatePath(`/obras/${input.obra_id}/clientes`);
  return { ok: true };
}

export async function desvincularClienteUnidade(unidadeId: string, obraId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("unidades")
    .update({ cliente_atual_id: null })
    .eq("id", unidadeId);
  if (error) return { erro: error.message };
  revalidatePath(`/obras/${obraId}/clientes`);
  revalidatePath(`/obras/${obraId}/mapa`);
  return { ok: true };
}

export async function excluirCliente(id: string, obra_id: string) {
  const supabase = createClient();

  const { error: e1 } = await supabase
    .from("agenda")
    .update({ status_agenda: "cancelada", observacoes: "cancelada por exclusao do cliente" })
    .eq("cliente_id", id)
    .eq("status_agenda", "agendada");
  if (e1) return { erro: `Falha ao cancelar agendas ativas: ${e1.message}` };

  const { error: e2 } = await supabase
    .from("agenda")
    .update({ cliente_id: null })
    .eq("cliente_id", id);
  if (e2) return { erro: `Falha ao remover vinculo das agendas: ${e2.message}` };

  const { error: e3 } = await supabase
    .from("unidades")
    .update({ cliente_atual_id: null })
    .eq("cliente_atual_id", id);
  if (e3) return { erro: `Falha ao desvincular unidades: ${e3.message}` };

  const { error: e4 } = await supabase.from("clientes").delete().eq("id", id);
  if (e4) return { erro: `Falha ao excluir cliente: ${e4.message}` };

  revalidatePath(`/obras/${obra_id}/clientes`);
  revalidatePath(`/obras/${obra_id}/mapa`);
  revalidatePath(`/obras/${obra_id}/agenda`);
  return { ok: true };
}
