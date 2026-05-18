"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarObra } from "./actions";

export default function NovaObraForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      className="bg-white border rounded-lg p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setErro(null);
        start(async () => {
          const r = await criarObra(fd);
          if (r?.erro) setErro(r.erro);
          else { router.refresh(); (e.target as HTMLFormElement).reset(); }
        });
      }}
    >
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Nome da obra *</label>
        <input name="nome" required className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Endereco</label>
        <input name="endereco" className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Data de inicio</label>
        <input name="data_inicio" type="date" className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit" disabled={pending}
        className="w-full bg-gray-900 text-white py-2 rounded text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Criando..." : "Criar obra"}
      </button>
    </form>
  );
}
