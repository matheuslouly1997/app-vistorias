"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { criarCliente } from "./actions";

export default function NovoClienteForm({ obraId }: { obraId: string }) {
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
          const r = await criarCliente(fd);
          if (r?.erro) setErro(r.erro);
          else { router.refresh(); (e.target as HTMLFormElement).reset(); }
        });
      }}
    >
      <input name="nome" required placeholder="Nome *" className="w-full border rounded px-3 py-2 text-sm" />
      <input name="cpf" placeholder="CPF" className="w-full border rounded px-3 py-2 text-sm" />
      <input name="email" type="email" placeholder="Email" className="w-full border rounded px-3 py-2 text-sm" />
      <input name="telefone" placeholder="Telefone" className="w-full border rounded px-3 py-2 text-sm" />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button type="submit" disabled={pending} className="w-full bg-gray-900 text-white py-2 rounded text-sm font-medium disabled:opacity-50">
        {pending ? "Salvando..." : "Adicionar cliente"}
      </button>
    </form>
  );
}
