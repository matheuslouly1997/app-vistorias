import { lerEnvStatus } from "@/lib/env";
import TesteConexao from "./teste-conexao";

export const dynamic = "force-dynamic";

export default function DiagnosticoPage() {
  const env = lerEnvStatus();

  const tudoOk = env.urlPresente && env.keyPresente &&
    env.keyFormato !== "desconhecido" && env.urlDominio !== "(URL invalida)";

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Diagnostico — App Vistorias</h1>
          <p className="text-sm text-gray-500">
            Esta pagina e publica e nao envia nenhuma key para servidores externos.
            E so verificacao local entre o seu navegador, o Next.js e o Supabase.
          </p>
        </header>

        <section className="bg-white border rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Variaveis de ambiente
          </h2>
          <Linha
            ok={env.urlPresente}
            label="NEXT_PUBLIC_SUPABASE_URL"
            valor={env.urlPresente ? env.urlDominio : "AUSENTE"}
          />
          <Linha
            ok={env.keyPresente}
            label="NEXT_PUBLIC_SUPABASE_ANON_KEY"
            valor={env.keyPresente ? env.keyMascarada : "AUSENTE"}
          />
          <Linha
            ok={env.keyFormato !== "desconhecido"}
            label="Formato detectado"
            valor={env.keyFormato ?? "—"}
          />
          {env.keyFormato === "sb_secret" && (
            <p className="text-sm text-red-600">
              ATENCAO: voce colou a service_role (sb_secret_...). Essa key NUNCA vai no frontend.
              Substitua pela publishable (sb_publishable_...) ou anon JWT (eyJ...).
            </p>
          )}
          {env.keyFormato === "desconhecido" && (
            <p className="text-sm text-amber-600">
              Formato nao reconhecido. Esperado: <code>sb_publishable_...</code> (novo) ou <code>eyJ...</code> (JWT legado).
            </p>
          )}
        </section>

        <TesteConexao />

        <section className="bg-white border rounded-lg p-5 space-y-3 text-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            Se algo aqui esta vermelho
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Confirme que existe um arquivo <code>.env.local</code> na <b>raiz do projeto</b>
              (mesmo nivel de <code>package.json</code>), com cada variavel em uma linha:
              <pre className="bg-gray-50 border rounded p-2 mt-1 text-xs overflow-x-auto">
NEXT_PUBLIC_SUPABASE_URL=https://SEUPROJ.supabase.co{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
              </pre>
            </li>
            <li>
              <b>Reinicie o dev server</b> apos editar <code>.env.local</code>:
              Ctrl+C no terminal onde rodou <code>npm run dev</code>, e rode de novo.
              Next.js so le envs no startup.
            </li>
            <li>
              Confirme no painel do Supabase &rarr; Project Settings &rarr; API que a
              key copiada e a <b>anon/publishable</b> e nao a <b>service_role</b>.
            </li>
            <li>
              Atualize as deps caso ainda nao tenha:{" "}
              <code>npm install @supabase/supabase-js@latest @supabase/ssr@latest</code>.
            </li>
            <li>
              Se o teste de conexao falhar com erro de rede, verifique firewall/proxy
              corporativo bloqueando <code>*.supabase.co</code>.
            </li>
          </ol>
        </section>

        {tudoOk && (
          <a href="/login" className="inline-block px-4 py-2 bg-gray-900 text-white rounded text-sm">
            Tudo ok &rarr; voltar para login
          </a>
        )}
      </div>
    </div>
  );
}

function Linha({ ok, label, valor }: { ok: boolean; label: string; valor: string | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <code className="bg-gray-50 border rounded px-2 py-0.5 text-xs">{valor ?? "—"}</code>
        <span
          className={`inline-block w-3 h-3 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
          title={ok ? "OK" : "Faltando"}
        />
      </div>
    </div>
  );
}
