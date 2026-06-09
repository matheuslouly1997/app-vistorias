"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Mantem o dashboard SSR vivo: assina mudancas em unidades, agenda e
 * historico_status para esta obra e dispara router.refresh() debounced.
 *
 * O componente nao renderiza nada visivel — apenas o efeito de sincronia.
 * Mantemos o dashboard SSR (calculos pesados ficam no servidor) e usamos
 * o refresh do Next para repuxar os dados sem reload da pagina.
 */
export default function DashboardRealtime({ obraId }: { obraId: string }) {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const refresh = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Debounce: aglutina rajadas (ex.: aprovar = update agenda + update unidade)
      timeoutRef.current = setTimeout(() => router.refresh(), 400);
    };

    const ch = supabase
      .channel(`dashboard_realtime_${obraId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "unidades", filter: `obra_id=eq.${obraId}` },
        refresh)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "agenda", filter: `obra_id=eq.${obraId}` },
        refresh)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "historico_status", filter: `obra_id=eq.${obraId}` },
        refresh)
      .subscribe();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(ch);
    };
  }, [obraId, router]);

  return null;
}
