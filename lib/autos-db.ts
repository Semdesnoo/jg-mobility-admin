import sql from "./db";
import type { Auto } from "./autos";

export async function getAutos(): Promise<Auto[]> {
  const rows = await sql`SELECT data FROM autos ORDER BY id DESC`;
  return rows.map((r) => r.data as Auto);
}

export async function getAutoBySlug(slug: string): Promise<Auto | undefined> {
  const rows = await sql`SELECT data FROM autos WHERE slug = ${slug}`;
  return rows[0]?.data as Auto | undefined;
}

export async function getAutoById(id: number): Promise<Auto | undefined> {
  const rows = await sql`SELECT data FROM autos WHERE id = ${id}`;
  return rows[0]?.data as Auto | undefined;
}

export async function saveAuto(auto: Auto): Promise<void> {
  await sql`
    INSERT INTO autos (id, slug, data)
    VALUES (${auto.id}, ${auto.slug}, ${JSON.stringify(auto)})
    ON CONFLICT (id) DO UPDATE SET slug = ${auto.slug}, data = ${JSON.stringify(auto)}
  `;
}

export async function deleteAuto(id: number): Promise<boolean> {
  const result = await sql`DELETE FROM autos WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

export async function getNextId(): Promise<number> {
  const rows = await sql`SELECT COALESCE(MAX(id), 0) AS max_id FROM autos`;
  return Number(rows[0].max_id) + 1;
}

export function generateSlug(merk: string, model: string): string {
  return `${merk}-${model}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Garandeert een unieke slug. Is de basis-slug al door een ANDERE auto in gebruik,
// dan wordt -2, -3, ... toegevoegd. Voorkomt de 23505 unique-constraint crash bij
// twee auto's met identiek merk + model.
export async function ensureUniqueSlug(base: string, currentId?: number): Promise<string> {
  const basis = base || "auto";
  let kandidaat = basis;
  let n = 1;
  for (let poging = 0; poging < 1000; poging++) {
    const rows = await sql`SELECT id FROM autos WHERE slug = ${kandidaat} LIMIT 1`;
    const bezet = rows[0];
    if (!bezet || (currentId != null && Number(bezet.id) === currentId)) return kandidaat;
    n += 1;
    kandidaat = `${basis}-${n}`;
  }
  return `${basis}-${Date.now()}`;
}
