import { redirect } from "next/navigation";

export default function Home() {
  // Middleware ja redireciona para /login se nao autenticado.
  // Se chegou aqui, vai pro seletor de obras.
  redirect("/obras");
}
