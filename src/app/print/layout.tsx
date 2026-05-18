export const metadata = { title: "Relatório" };

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white text-gray-900 px-8 py-6 max-w-[210mm] mx-auto">
      {children}
    </div>
  );
}
