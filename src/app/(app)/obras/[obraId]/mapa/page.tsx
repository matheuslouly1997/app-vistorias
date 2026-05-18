import { createClient } from "@/lib/supabase/server";
import MapaOperacional from "./mapa-operacional";

export const dynamic = "force-dynamic";

export default async function MapaPage({ params }: { params: { obraId: string } }) {
  const supabase = createClient();

  const [{ data: torres }, { data: unidades }, { data: clientes }] = await Promise.all([
    supabase.from("torres")
      .select("id, nome, qtd_pavimentos, layout_codigos, ordem")
      .eq("obra_id", params.obraId)
      .order("ordem"),
    supabase.from("unidades")
      .select("id, torre_id, pavimento, codigo_unidade, identificador, status, cliente_atual_id, observacoes")
      .eq("obra_id", params.obraId),
    supabase.from("clientes")
      .select("id, nome, telefone, email")
      .eq("obra_id", params.obraId)
      .order("nome")
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <MapaOperacional
        obraId={params.obraId}
        torres={torres ?? []}
        unidadesIniciais={unidades ?? []}
        clientes={clientes ?? []}
      />
    </div>
  );
}
