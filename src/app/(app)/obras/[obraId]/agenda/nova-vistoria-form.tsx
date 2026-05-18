"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { agendarVistoria } from "./actions";

type UnidadeMin = { id: string; identificador: string; status: string };
type ClienteMin = { id: string; nome: string };

export default function NovaVistoriaForm({
  obraId, unidades, clientes
}: {
  obraId: string;
  unidades: UnidadeMin[];
  clientes: ClienteMin[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      className="bg-white border rounded-lg p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("obra_id", obraId);
        setErro(null);
        start(async () => {
          const r = await agendarVistoria(fd);
          if (r?.erro) setErro(r.erro);
          else { router.refresh(); (e.target as HTMLFormElement).reset(); }
        });
      }}
    >
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Unidade *</label>
        <select name="unidade_id" required className="w-full border rounded px-3 py-2 text-sm">
          <option value="">Selecione...</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.identificador} ({u.status})
            </option>
          ))}
        </select>
        <p className="text-[10px] text-gray-500">Listadas: unidades em finalizada_obra, reprovada ou revistoria.</p>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Cliente</label>
        <select name="cliente_id" className="w-full border rounded px-3 py-2 text-sm">
          <option value="">(sem cliente)</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Tipo *</label>
          <select name="tipo" required className="w-full border rounded px-3 py-2 text-sm">
            <option value="vistoria_1a">1a vistoria</option>
            <option value="revistoria">Revistoria</option>
            <option value="vistoria_extra">Extra</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Duracao (min)</label>
          <input name="duracao_min" type="number" defaultValue={60} className="w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Data e hora *</label>
        <input name="data_agendada" type="datetime-local" required className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Observacoes</label>
        <textarea name="observacoes" rows={2} className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button type="submit" disabled={pending} className="w-full bg-gray-900 text-white py-2 rounded text-sm font-medium disabled:opacity-50">
        {pending ? "Agendando..." : "Agendar"}
      </button>
    </form>
  );
}
