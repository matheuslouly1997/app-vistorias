import { createClient } from "@/lib/supabase/server";
import ClientesUI from "./clientes-ui";

export const dynamic = "force-dynamic";

export default async function ClientesPage({ params }: { params: { obraId: string } }) {
  const supabase = createClient();

  const [{ data: clientes }, { data: unidades }, { data: agendas }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, cpf, email, telefone, observacoes, created_at")
      .eq("obra_id", params.obraId)
      .order("nome"),
    supabase
      .from("unidades")
      .select("id, identificador, status, cliente_atual_id")
      .eq("obra_id", params.obraId),
    supabase
      .from("agenda")
      .select("id, cliente_id, unidade_id, data_agendada, status_agenda, resultado, tipo")
      .eq("obra_id", params.obraId)
      .order("data_agendada", { ascending: false })
  ]);

  return (
    <ClientesUI
      obraId={params.obraId}
      clientes={clientes ?? []}
      unidades={unidades ?? []}
      agendas={agendas ?? []}
    />
  );
}
