import { bewaarTaxatieResultaat, eenAanvraag } from "@/lib/aanvragen-db";

export const dynamic = "force-dynamic";

function alsObject(waarde: unknown): Record<string, unknown> {
  return waarde !== null && typeof waarde === "object" && !Array.isArray(waarde)
    ? (waarde as Record<string, unknown>)
    : {};
}

function veiligGetal(waarde: unknown, maximum = 10_000_000): number {
  const getal = Number(waarde);
  return Number.isFinite(getal) && getal >= 0 && getal <= maximum ? getal : 0;
}

function normaliseerResultaat(waarde: unknown) {
  const resultaat = alsObject(waarde);
  const berekening = alsObject(resultaat.berekening);
  const markt = alsObject(resultaat.markt);
  return {
    berekening: {
      max_inkoop: veiligGetal(berekening.max_inkoop),
      verwachte_verkoop: veiligGetal(berekening.verwachte_verkoop),
      verkoopbaarheid_reden: String(berekening.verkoopbaarheid_reden ?? "").slice(0, 500),
    },
    markt: {
      aantal_gevonden: Math.round(veiligGetal(markt.aantal_gevonden, 10_000)),
      gemiddelde_prijs: veiligGetal(markt.gemiddelde_prijs),
    },
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = alsObject(await req.json().catch(() => ({})));
  const resultaat = normaliseerResultaat(body.resultaat);

  // Eerst de payload valideren. Een mislukte of voorlopige taxatie mag nooit een bestaand
  // concept wissen of als € 0 aan een klantaanvraag worden gekoppeld.
  if (resultaat.berekening.max_inkoop <= 0) {
    return Response.json(
      { error: "De calculator leverde geen geldige maximale inkoopprijs op." },
      { status: 400 }
    );
  }

  try {
    const bestaand = await eenAanvraag(id);
    if (!bestaand) return Response.json({ error: "Deze taxatieaanvraag bestaat niet meer." }, { status: 404 });
    if (bestaand.antwoord_verstuurd_op) {
      return Response.json(
        { error: "Deze taxatie is al naar de klant verstuurd en kan niet opnieuw worden geopend." },
        { status: 409 }
      );
    }

    const bijgewerkt = await bewaarTaxatieResultaat(id, resultaat);
    if (!bijgewerkt) return Response.json({ error: "De aanvraag kon niet worden bijgewerkt." }, { status: 404 });

    return Response.json({ aanvraag: bijgewerkt });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "De taxatie kon niet worden gekoppeld." },
      { status: 500 }
    );
  }
}
