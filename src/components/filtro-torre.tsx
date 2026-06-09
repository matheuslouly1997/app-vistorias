"use client";

// Filtro client-side de torre. Recebe a lista de torres e um valor selecionado
// ("todas" | torre.id) e dispara onChange. Renderizado como segmented control.

type TorreMin = { id: string; nome: string };

export default function FiltroTorre({
  torres, valor, onChange, className = "",
}: {
  torres: TorreMin[];
  valor: string; // "todas" ou torre.id
  onChange: (novo: string) => void;
  className?: string;
}) {
  if (torres.length <= 1) return null;

  const opts: { id: string; label: string }[] = [
    { id: "todas", label: "Todas" },
    ...torres.map((t) => ({ id: t.id, label: `Torre ${t.nome}` })),
  ];

  return (
    <div className={`inline-flex border rounded-md overflow-hidden ${className}`}>
      {opts.map((o, i) => {
        const ativo = valor === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={
              `text-xs px-3 py-1.5 font-medium transition ` +
              (ativo ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50 text-gray-700") +
              (i > 0 ? " border-l" : "")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
