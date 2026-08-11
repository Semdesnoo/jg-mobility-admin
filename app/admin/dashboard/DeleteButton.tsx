"use client";

import { useRouter } from "next/navigation";
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
      className="px-3 py-1.5 text-xs font-semibold tracking-wide transition-all hover:opacity-70"
      style={{
        border: "1px solid rgba(220,38,38,0.3)",
        color: "#dc2626",
        fontFamily: "var(--font-inter)",
      }}
    >
      Verwijder
    </button>
  );
}
