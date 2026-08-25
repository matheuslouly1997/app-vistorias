import { createClient } from "@/lib/supabase/server";
import NovaTorreForm from "./nova-torre-form";
import TorresLista from "./torres-lista";

export const dynamic = "force-dynamic";

export default async function TorresPage({ params }: { params: { obraId: string } }) {
  const supabase = createClient();
  const { data: torres } = await supabase
    .from("torres")
    .select("id, nome, qtd_pavimentos, layout_codigos, ordem")
    .eq("obra_id", params.obraId)
    .order("ordem");

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid md:grid-cols-2 gap-6">
      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Torres da obra</h2>
        <TorresLista obraId={params.obraId} torres={(torres ?? []) as any} />
      </section>
      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Nova torre</h2>
        <NovaTorreForm obraId={params.obraId} />
      </section>
    </div>
  );
}
