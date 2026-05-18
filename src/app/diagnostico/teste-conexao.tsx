"use client";
import { useState } from "react";

type Resultado =
  | { tipo: "idle" }
  | { tipo: "carregando" }
  | { tipo: "ok"; status: number; segundos: string }
  | { tipo: "erro"; mensagem: string };

export default function TesteConexao() {
  const [r, setR] = useState<Resultado>({ tipo: "idle" });

  async function testar() {
    setR({ tipo: "carregando" });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setR({ tipo: "erro", mensagem: "Envs ausentes no bundle do browser. Reinicie o dev server." });
      return;
    }
    const inicio = performance.now();
    try {
      const resp = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      });
      const seg = ((performance.now() - inicio) / 1000).toFixed(2);
      if (!resp.ok) {
        setR({ tipo: "erro", mensagem: `HTTP ${resp.status} apos ${seg}s. Verifique se URL e key sao do mesmo projeto.` });
        return;
      }
      setR({ tipo: "ok", status: resp.status, segundos: seg });
    } catch (e: any) {
      setR({ tipo: "erro", mensagem: `${e?.message ?? "Failed to fetch"}. Confira a URL e a conectividade com supabase.co.` });
    }
  }

  return (
    <section className="bg-white border rounded-lg p-5 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
        Teste de conexao
      </h2>
      <p className="text-sm text-gray-600">
        Chama <code>{`<URL>/auth/v1/settings`}</code> com a key publica.
        E uma chamada inofensiva que so confirma que o navegador alcanca o seu projeto Supabase.
      </p>
      <button
        type="button"
        onClick={testar}
        disabled={r.tipo === "carregando"}
        className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white disabled:opacity-50"
      >
        {r.tipo === "carregando" ? "Testando..." : "Rodar teste"}
      </button>

      {r.tipo === "ok" && (
        <p className="text-sm text-emerald-700">
          OK — HTTP {r.status} em {r.segundos}s. Conexao com Supabase funcionando.
        </p>
      )}
      {r.tipo === "erro" && (
        <p className="text-sm text-red-600">Falhou: {r.mensagem}</p>
      )}
    </section>
  );
}
