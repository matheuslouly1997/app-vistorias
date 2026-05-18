import { Suspense } from "react";
import LoginClient from "./login-client";

// Forca renderizacao dinamica. Login depende de query params e cookies
// do navegador; nao faz sentido prerenderizar estaticamente.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Carregando...
      </div>
    }>
      <LoginClient />
    </Suspense>
  );
}
