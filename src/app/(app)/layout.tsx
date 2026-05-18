import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, email, papel")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/obras" className="font-semibold">App Vistorias</Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{perfil?.nome ?? user.email}</span>
            <span className="text-xs uppercase tracking-wide text-gray-400">{perfil?.papel ?? "—"}</span>
            <form action="/logout" method="post">
              <button className="text-gray-600 hover:text-gray-900 underline">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
