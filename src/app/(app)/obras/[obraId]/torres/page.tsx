import { createClient } from "@/lib/supabase/server";
import NovaTorreForm from "./nova-torre-form";

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
        <div className="space-y-2">
          {(torres ?? []).map((t) => (
            <div key={t.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">Torre {t.nome}</div>
                <div className="text-xs text-gray-500">
                  {t.qtd_pavimentos} pavs &times; {t.layout_codigos.length} = {t.qtd_pavimentos * t.layout_codigos.length} unidades
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {t.layout_codigos.map((c: string) => (
                  <span key={c} className="text-[11px] bg-gray-100 rounded px-1.5 py-0.5">{c}</span>
                ))}
              </div>
            </div>
          ))}
          {(torres ?? []).length === 0 && (
            <div className="text-sm text-gray-500 bg-white p-4 rounded border">Nenhuma torre.</div>
          )}
        </div>
      </section>
      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Nova torre</h2>
        <NovaTorreForm obraId={params.obraId} />
      </section>
    </div>
  );
}
