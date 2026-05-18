import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BotaoExportar from "@/components/botao-exportar";

const TABS = [
  { href: "dashboard", label: "Dashboard" },
  { href: "mapa",      label: "Mapa" },
  { href: "agenda",    label: "Agenda" },
  { href: "clientes",  label: "Clientes" },
  { href: "torres",    label: "Torres" }
];

export default async function ObraLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { obraId: string };
}) {
  const supabase = createClient();
  const { data: obra } = await supabase
    .from("obras")
    .select("id, nome, status")
    .eq("id", params.obraId)
    .maybeSingle();
  if (!obra) notFound();

  return (
    <div className="flex flex-col">
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <Link href="/obras" className="text-xs text-gray-500 hover:underline">&larr; todas as obras</Link>
              <h1 className="text-xl sm:text-2xl font-semibold mt-1 tracking-tight">{obra.nome}</h1>
              <span className="text-[11px] uppercase tracking-wide text-gray-500">{obra.status}</span>
            </div>
            <BotaoExportar obraId={obra.id} />
          </div>
          <nav className="mt-3 sm:mt-4 flex gap-1 overflow-x-auto -mx-4 px-4 scrollbar-thin">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={`/obras/${obra.id}/${t.href}`}
                className="px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 whitespace-nowrap"
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
