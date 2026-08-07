export type Bijlage = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
};

type Deel = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { attachmentId?: string | null; size?: number | null } | null;
  parts?: unknown[];
};

/**
 * Loopt de MIME-boom van een Gmail-bericht af en verzamelt alle échte bijlagen:
 * een bestandsnaam én een attachmentId. Inline handtekening-plaatjes hebben geen
 * naam en vallen zo vanzelf af.
 *
 * Staat hier en niet in een route omdat zowel het factuurscherm (één mail openen)
 * als de kwartaalexport (tientallen mails langslopen) hem nodig heeft.
 */
export function verzamelBijlagen(deel: Deel | undefined, uit: Bijlage[] = []): Bijlage[] {
  if (!deel) return uit;
  const naam = (deel.filename ?? "").trim();
  const attId = deel.body?.attachmentId ?? "";
  if (naam && attId) {
    uit.push({
      attachmentId: attId,
      filename: naam,
      mimeType: deel.mimeType ?? "application/octet-stream",
      size: deel.body?.size ?? 0,
    });
  }
  for (const kind of (deel.parts ?? []) as Deel[]) verzamelBijlagen(kind, uit);
  return uit;
}

/** PDF's eerst — dat is doorgaans de factuur zelf, de rest is bijvangst. */
export function pdfEerst(bijlagen: Bijlage[]): Bijlage[] {
  return [...bijlagen].sort(
    (a, b) => (a.mimeType === "application/pdf" ? 0 : 1) - (b.mimeType === "application/pdf" ? 0 : 1)
  );
}
