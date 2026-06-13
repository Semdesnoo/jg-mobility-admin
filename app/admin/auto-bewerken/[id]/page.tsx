import { redirect } from "next/navigation";
import AutoForm from "@/components/AutoForm";
import { getAutoById } from "@/lib/autos-db";

export const dynamic = "force-dynamic";

// Bewerk-pagina: haalt de bestaande auto op uit de gedeelde database en vult er het
// formulier mee voor. Opslaan gaat via dezelfde save-car route (behoudt id/slug/standtijd)
// en ververst meteen de publieke website.
export default async function AutoBewerken({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Valideer het id vóór de DB-call: een niet-positief-geheel id (bv. /auto-bewerken/abc of een
  // oude bookmark) zou anders een integer-cast-fout in Postgres geven i.p.v. een nette redirect.
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) redirect("/admin/dashboard");

  const auto = await getAutoById(num);
  if (!auto) redirect("/admin/dashboard");

  return <AutoForm initial={auto} />;
}
