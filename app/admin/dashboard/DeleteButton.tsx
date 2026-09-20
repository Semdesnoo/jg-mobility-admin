"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useDialoog } from "./Dialoog";

export default function DeleteButton({ id, naam }: { id: number; naam: string }) {
  const router = useRouter();
  const { vraag, melden } = useDialoog();

  const handleDelete = async () => {
    const akkoord = await vraag({
      titel: `${naam} verwijderen?`,
      tekst: "De auto verdwijnt uit de voorraad en meteen ook van de website. Dit is niet ongedaan te maken.",
      bevestig: "Verwijderen",
      gevaar: true,
    });
    if (!akkoord) return;

    const res = await fetch(`/api/admin/delete-car?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      await melden({
        titel: "Verwijderen mislukt",
        tekst: `${naam} staat er nog. Probeer het zo nog eens; blijft het misgaan, ververs dan de pagina.`,
      });
    }
  };

  return (
    <button
      onClick={handleDelete}
      aria-label={`${naam} verwijderen`}
      title="Verwijderen"
      className="inline-flex items-center justify-center transition-all hover:-translate-y-0.5"
      style={{
        width: 38,
        height: 38,
        border: "1px solid rgba(220,38,38,0.3)",
        color: "#dc2626",
        backgroundColor: "#ffffff",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#fef2f2"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#ffffff"; }}
    >
      <Trash2 size={15} />
    </button>
  );
}
