import { redirect } from "next/navigation";

export default function AprovacaoRedirect({ params }: { params: { obraId: string } }) {
  redirect(`/obras/${params.obraId}/dashboard`);
}
