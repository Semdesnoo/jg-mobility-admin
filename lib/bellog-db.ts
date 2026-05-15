import sql from "./db";

export type Oproep = {
  id: string;
  datum: string;
  tijd: string;
  nummer: string;
  naam: string;
  notitie: string;
  terugbellen: boolean;
  afgehandeld: boolean;
};

export async function getOproepen(): Promise<Oproep[]> {
  const rows = await sql`SELECT * FROM bellog ORDER BY datum DESC, tijd DESC`;
  return rows as unknown as Oproep[];
}

export async function addOproep(data: Omit<Oproep, "id">): Promise<Oproep> {
  const id = `${Date.now()}`;
  const rows = await sql`
    INSERT INTO bellog (id, datum, tijd, nummer, naam, notitie, terugbellen, afgehandeld)
    VALUES (${id}, ${data.datum}, ${data.tijd}, ${data.nummer}, ${data.naam}, ${data.notitie}, ${data.terugbellen}, ${data.afgehandeld})
    RETURNING *
  `;
  return rows[0] as unknown as Oproep;
}

export async function updateOproep(id: string, data: Partial<Oproep>): Promise<boolean> {
  if (data.afgehandeld !== undefined) {
    await sql`UPDATE bellog SET afgehandeld = ${data.afgehandeld} WHERE id = ${id}`;
  }
  if (data.notitie !== undefined) {
    await sql`UPDATE bellog SET notitie = ${data.notitie} WHERE id = ${id}`;
  }
  if (data.terugbellen !== undefined) {
    await sql`UPDATE bellog SET terugbellen = ${data.terugbellen} WHERE id = ${id}`;
  }
  return true;
}

export async function deleteOproep(id: string): Promise<boolean> {
  const result = await sql`DELETE FROM bellog WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}
