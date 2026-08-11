/**
 * Foto's verkleinen in de browser, vóór ze naar de opslag gaan.
 *
 * WAAROM DIT ER MOET ZIJN
 * Foto's gingen ongewijzigd naar Vercel Blob — tot 20 MB per stuk. Een foto van een
 * telefoon is al gauw 3 tot 8 MB, en op de website worden ze door de beeldoptimalisatie
 * van Vercel in meerdere maten en formaten gezet. Voor élke maat wordt het ORIGINEEL
 * opnieuw uit Blob gehaald. Met zes breedtes maal twee formaten is dat twaalf keer het
 * hele bestand voor één foto, en dan is de datalimiet van het gratis abonnement een
 * kwestie van weken.
 *
 * Wat hier gebeurt is simpel: schalen naar een breedte die op een scherm zinvol is, en
 * opslaan als WebP. Een foto van 4 MB wordt daarmee doorgaans 250 tot 400 kB — dezelfde
 * foto, want groter dan 1920 pixels breed heeft op geen enkel scherm zin, en het verschil
 * tussen JPEG op volle kwaliteit en WebP op 82 is met het blote oog niet te zien op een
 * autofoto.
 *
 * WAT ER NIET GEBEURT
 * Er wordt niet bijgesneden en niet gedraaid. Is een foto al kleiner dan de grens, dan
 * gaat hij ongewijzigd door: opnieuw comprimeren van iets dat al klein is levert alleen
 * kwaliteitsverlies op. Lukt het verkleinen niet — een raar bestandsformaat, een browser
 * zonder ondersteuning — dan gaat het origineel alsnog naar boven. Een foto die niet
 * geüpload wordt is erger dan een foto die te groot is.
 */

/** Breder dan dit heeft geen enkel scherm nodig; de website vraagt maximaal 1920. */
const MAX_BREEDTE = 1920;
/** Boven deze grens loont verkleinen; daaronder niet. */
const DREMPEL_BYTES = 400 * 1024;
const KWALITEIT = 0.82;

export type Verkleind = {
  bestand: File;
  /** Voor de melding aan de gebruiker: hoeveel er is bespaard. */
  vanBytes: number;
  naarBytes: number;
  aangepast: boolean;
};

function laadPlaatje(bestand: File): Promise<HTMLImageElement> {
  return new Promise((klaar, mislukt) => {
    const url = URL.createObjectURL(bestand);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      klaar(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      mislukt(new Error("Afbeelding kon niet worden gelezen"));
    };
    img.src = url;
  });
}

export async function verkleinFoto(bestand: File): Promise<Verkleind> {
  const onveranderd: Verkleind = {
    bestand,
    vanBytes: bestand.size,
    naarBytes: bestand.size,
    aangepast: false,
  };

  // Al klein genoeg, of geen afbeelding die we aankunnen.
  if (bestand.size <= DREMPEL_BYTES) return onveranderd;
  if (!/^image\/(jpeg|png|webp)$/.test(bestand.type)) return onveranderd;

  try {
    const img = await laadPlaatje(bestand);
    const schaal = Math.min(1, MAX_BREEDTE / Math.max(img.naturalWidth, img.naturalHeight));
    const breedte = Math.round(img.naturalWidth * schaal);
    const hoogte = Math.round(img.naturalHeight * schaal);

    const doek = document.createElement("canvas");
    doek.width = breedte;
    doek.height = hoogte;
    const ctx = doek.getContext("2d");
    if (!ctx) return onveranderd;
    ctx.drawImage(img, 0, 0, breedte, hoogte);

    const blob = await new Promise<Blob | null>((klaar) =>
      doek.toBlob(klaar, "image/webp", KWALITEIT)
    );
    if (!blob) return onveranderd;

    // Groter geworden? Dan het origineel houden. Komt voor bij foto's die al goed
    // gecomprimeerd zijn en waar WebP niets meer aan kan verbeteren.
    if (blob.size >= bestand.size) return onveranderd;

    const naam = bestand.name.replace(/\.[^.]+$/, "") + ".webp";
    return {
      bestand: new File([blob], naam, { type: "image/webp", lastModified: Date.now() }),
      vanBytes: bestand.size,
      naarBytes: blob.size,
      aangepast: true,
    };
  } catch {
    return onveranderd;
  }
}

export const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
