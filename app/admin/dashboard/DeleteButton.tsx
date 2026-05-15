"use client";

import { useRouter } from "next/navigation";

export default function DeleteButton({ id, naam }: { id: number; naam: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Weet je zeker dat je "${naam}" wilt verwijderen?`)) return;

    const res = await fetch(`/api/admin/delete-car?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Verwijderen mislukt");
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
