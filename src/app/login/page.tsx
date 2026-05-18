"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/";
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setLoading(false);
      if (error) {
        setErro(error.message);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch (e: any) {
      setLoading(false);
      const msg = e?.message ?? String(e);
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setErro("Falhou em chegar no Supabase. Abra /diagnostico para verificar URL, key e conexao.");
      } else {
        setErro(msg);
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 bg-white p-8 rounded-xl shadow">
        <h1 className="text-xl font-semibold">App Vistorias</h1>
        <p className="text-sm text-gray-500">Entre com seu email e senha.</p>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Senha</label>
          <input
            type="password" autoComplete="current-password" required
            value={senha} onChange={(e) => setSenha(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
        </div>

        {erro && (
          <div className="text-sm text-red-600 space-y-1">
            <p>{erro}</p>
            <p className="text-xs"><a href="/diagnostico" className="underline">Abrir diagnostico</a></p>
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full bg-gray-900 text-white py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
