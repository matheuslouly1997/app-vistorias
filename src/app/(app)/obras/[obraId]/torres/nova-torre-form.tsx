"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarTorre } from "./actions";

export default function NovaTorreForm({ obraId }: { obraId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [codigos, setCodigos] = useState<string[]>(["1A","2A","3A","4A","1B","2B","3B","4B"]);
  const [novoCodigo, setNovoCodigo] = useState("");

  function addCodigo() {
    const c = novoCodigo.trim().toUpperCase();
    if (!c || codigos.includes(c)) return;
    setCodigos([...codigos, c]);
    setNovoCodigo("");
  }
  function rmCodigo(c: string) {
    setCodigos(codigos.filter((x) => x !== c));
  }

  return (
    <form
      className="bg-white border rounded-lg p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("layout_codigos", JSON.stringify(codigos));
        fd.set("obra_id", obraId);
        setErro(null);
        start(async () => {
          const r = await criarTorre(fd);
          if (r?.erro) setErro(r.erro);
          else { router.refresh(); (e.target as HTMLFormElement).reset(); }
        });
      }}
    >
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Nome da torre *</label>
        <input name="nome" required placeholder="A, B, Unica..." className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Pavimentos *</label>
          <input name="qtd_pavimentos" type="number" min={1} required defaultValue={17} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Ordem</label>
          <input name="ordem" type="number" defaultValue={0} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Layout de codigos por pavimento</label>
        <div className="flex flex-wrap gap-1 border rounded p-2 min-h-[40px]">
          {codigos.map((c) => (
            <span key={c} className="text-[11px] bg-gray-100 rounded px-2 py-0.5 flex items-center gap-1">
              {c}
              <button type="button" onClick={() => rmCodigo(c)} className="text-gray-500 hover:text-red-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={novoCodigo}
            onChange={(e) => setNovoCodigo(e.target.value)}
            placeholder="ex. 5C"
            className="flex-1 border rounded px-3 py-1.5 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCodigo(); } }}
          />
          <button type="button" onClick={addCodigo} className="text-sm px-3 py-1.5 border rounded">Adicionar</button>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit" disabled={pending || codigos.length === 0}
        className="w-full bg-gray-900 text-white py-2 rounded text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Criando..." : "Criar torre"}
      </button>
    </form>
  );
}
