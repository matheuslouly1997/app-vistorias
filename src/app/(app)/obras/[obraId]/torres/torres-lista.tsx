"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editarTorre, excluirTorre } from "./actions";

type Torre = {
  id: string; nome: string; qtd_pavimentos: number;
  layout_codigos: string[]; ordem: number;
};

export default function TorresLista({ obraId, torres }: { obraId: string; torres: Torre[] }) {
  const [editando, setEditando] = useState<string | null>(null);

  if (torres.length === 0) {
    return <div className="text-sm text-gray-500 bg-white p-4 rounded border">Nenhuma torre.</div>;
  }

  return (
    <div className="space-y-2">
      {torres.map((t) =>
        editando === t.id ? (
          <EditarCard key={t.id} obraId={obraId} torre={t} onClose={() => setEditando(null)} />
        ) : (
          <VerCard key={t.id} obraId={obraId} torre={t} onEditar={() => setEditando(t.id)} />
        )
      )}
    </div>
  );
}

function VerCard({ obraId, torre, onEditar }: { obraId: string; torre: Torre; onEditar: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const totalUnidades = torre.qtd_pavimentos * torre.layout_codigos.length;

  function excluir() {
    if (!confirm(`Excluir a torre "${torre.nome}" e suas ${totalUnidades} unidades? Esta acao nao pode ser desfeita.`)) return;
    setErro(null);
    start(async () => {
      const r = await excluirTorre(torre.id, obraId);
      if (r?.erro) setErro(r.erro);
      else router.refresh();
    });
  }

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">Torre {torre.nome}</div>
        <div className="text-xs text-gray-500">
          {torre.qtd_pavimentos} pavs &times; {torre.layout_codigos.length} = {totalUnidades} unidades
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {torre.layout_codigos.map((c) => (
          <span key={c} className="text-[11px] bg-gray-100 rounded px-1.5 py-0.5">{c}</span>
        ))}
      </div>
      {erro && <p className="text-sm text-red-600 mt-2">{erro}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onEditar}
          disabled={pending}
          className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Editar
        </button>
        <button
          onClick={excluir}
          disabled={pending}
          className="text-xs px-3 py-1.5 border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50"
        >
          {pending ? "Excluindo..." : "Excluir"}
        </button>
      </div>
    </div>
  );
}

function EditarCard({ obraId, torre, onClose }: { obraId: string; torre: Torre; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [codigos, setCodigos] = useState<string[]>(torre.layout_codigos);
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
      className="bg-white border-2 border-blue-400 rounded-lg p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("layout_codigos", JSON.stringify(codigos));
        fd.set("obra_id", obraId);
        fd.set("torre_id", torre.id);
        setErro(null);
        start(async () => {
          const r = await editarTorre(fd);
          if (r?.erro) setErro(r.erro);
          else { onClose(); router.refresh(); }
        });
      }}
    >
      <div className="text-sm font-medium">Editar torre</div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Nome da torre *</label>
        <input name="nome" required defaultValue={torre.nome} placeholder="A, B, Unica..." className="w-full border rounded px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Pavimentos *</label>
          <input name="qtd_pavimentos" type="number" min={1} required defaultValue={torre.qtd_pavimentos} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Ordem</label>
          <input name="ordem" type="number" defaultValue={torre.ordem} className="w-full border rounded px-3 py-2 text-sm" />
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

      <p className="text-[11px] text-amber-600">
        Reduzir pavimentos ou remover codigos so e permitido se as unidades afetadas nao tiverem vistorias.
      </p>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit" disabled={pending || codigos.length === 0}
          className="flex-1 bg-gray-900 text-white py-2 rounded text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={onClose} disabled={pending} className="px-4 py-2 border rounded text-sm">Cancelar</button>
      </div>
    </form>
  );
}
