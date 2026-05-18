"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { concluirVistoria, cancelarAgenda } from "./actions";

type Item = {
  id: string;
  tipo: string;
  data_agendada: string;
  duracao_min: number;
  status_agenda: string;
  resultado: string | null;
  observacoes: string | null;
  unidade_identificador: string;
  cliente_nome: string;
};

export default function AgendaTabela({ itens }: { itens: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function aplicarResultado(agendaId: string, resultado: "aprovada" | "reprovada") {
    setErro(null);
    start(async () => {
      const r = await concluirVistoria(agendaId, resultado);
      if (r?.erro) setErro(r.erro);
      else router.refresh();
    });
  }

  function cancelar(agendaId: string) {
    setErro(null);
    start(async () => {
      const r = await cancelarAgenda(agendaId);
      if (r?.erro) setErro(r.erro);
      else router.refresh();
    });
  }

  if (itens.length === 0)
    return <div className="text-sm text-gray-500 bg-white p-4 rounded border">Sem agendas.</div>;

  return (
    <>
      {erro && <p className="text-sm text-red-600 mb-2">{erro}</p>}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Unidade</th>
              <th className="px-3 py-2 text-left">Cliente</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(a.data_agendada).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{a.unidade_identificador}</td>
                <td className="px-3 py-2">{a.cliente_nome}</td>
                <td className="px-3 py-2">{a.tipo}</td>
                <td className="px-3 py-2">
                  {a.status_agenda}{a.resultado ? ` · ${a.resultado}` : ""}
                </td>
                <td className="px-3 py-2">
                  {a.status_agenda === "agendada" && (
                    <div className="flex gap-1">
                      <button disabled={pending} onClick={() => aplicarResultado(a.id, "aprovada")} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50">Aprovar</button>
                      <button disabled={pending} onClick={() => aplicarResultado(a.id, "reprovada")} className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50">Reprovar</button>
                      <button disabled={pending} onClick={() => cancelar(a.id)} className="text-xs px-2 py-1 rounded border disabled:opacity-50">Cancelar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
