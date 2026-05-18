"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Toast = {
  id: number;
  mensagem: string;
  variante: "info" | "sucesso" | "erro";
  acaoLabel?: string;
  acao?: () => void | Promise<void>;
  duracaoMs: number;
};

type ToastCtx = {
  /** Mostra um toast. Retorna o id (para descartar manualmente). */
  mostrar: (t: Omit<Toast, "id" | "duracaoMs"> & { duracaoMs?: number }) => number;
  /** Atalhos com a "marca" mais comum. */
  sucesso: (mensagem: string, opts?: { acaoLabel?: string; acao?: () => void | Promise<void>; duracaoMs?: number }) => number;
  erro:    (mensagem: string, opts?: { acaoLabel?: string; acao?: () => void | Promise<void>; duracaoMs?: number }) => number;
  info:    (mensagem: string, opts?: { acaoLabel?: string; acao?: () => void | Promise<void>; duracaoMs?: number }) => number;
  descartar: (id: number) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast deve ser usado dentro de <ToastProvider>");
  return c;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const descartar = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback<ToastCtx["mostrar"]>((t) => {
    idRef.current += 1;
    const id = idRef.current;
    const novo: Toast = {
      id,
      mensagem: t.mensagem,
      variante: t.variante,
      acaoLabel: t.acaoLabel,
      acao: t.acao,
      duracaoMs: t.duracaoMs ?? 5000
    };
    setToasts((prev) => [...prev, novo]);
    if (novo.duracaoMs > 0) {
      setTimeout(() => descartar(id), novo.duracaoMs);
    }
    return id;
  }, [descartar]);

  const value = useMemo<ToastCtx>(() => ({
    mostrar,
    sucesso: (m, opts) => mostrar({ mensagem: m, variante: "sucesso", ...opts }),
    erro:    (m, opts) => mostrar({ mensagem: m, variante: "erro",    duracaoMs: 8000, ...opts }),
    info:    (m, opts) => mostrar({ mensagem: m, variante: "info",    ...opts }),
    descartar
  }), [mostrar, descartar]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} descartar={descartar} />
    </Ctx.Provider>
  );
}

function ToastViewport({ toasts, descartar }: { toasts: Toast[]; descartar: (id: number) => void }) {
  return (
    <div className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-stretch sm:items-end pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => descartar(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const cor = toast.variante === "sucesso" ? "bg-emerald-600"
            : toast.variante === "erro"    ? "bg-red-600"
            : "bg-slate-800";
  return (
    <div className={`pointer-events-auto w-full sm:max-w-md rounded-lg shadow-lg text-white text-sm px-4 py-3 ${cor} flex items-center gap-3 animate-[slidein_.15s_ease-out]`}>
      <div className="flex-1">{toast.mensagem}</div>
      {toast.acao && toast.acaoLabel && (
        <button
          className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
          onClick={async () => {
            try { await toast.acao!(); } finally { onClose(); }
          }}
        >
          {toast.acaoLabel}
        </button>
      )}
      <button
        aria-label="Fechar"
        className="text-white/70 hover:text-white text-base leading-none"
        onClick={onClose}
      >&times;</button>
    </div>
  );
}

// animacao leve no CSS global — adicionada em globals.css
