"use client";

import { useState, useEffect } from "react";
import { ImageDown, Check } from "lucide-react";
import { T, micro, body, klein, Panel, Btn, Spinner, Foutmelding, Waarschuwing } from "./inkoop/ui";
import { useDialoog } from "./Dialoog";

/**
 * Bestaande foto's verkleinen.
 *
 * Eenmalig onderhoud, geen dagelijkse knop — daarom staat hij pas in beeld als er ook echt
 * iets te doen is. Nieuwe foto's worden bij het uploaden al verkleind; dit is voor alles
 * wat er stond voordat dat werd ingebouwd.
 *
 * Het draait in rondes van vijfenveertig seconden, omdat een functie op Vercel niet langer
 * mag duren. Na elke ronde weet je hoeveel er nog te gaan zijn en gaat hij vanzelf door.
 */
export default function FotosOpruimen() {
  const [openstaand, setOpenstaand] = useState<number | null>(null);
  const [totaal, setTotaal] = useState(0);
  const [bezig, setBezig] = useState(false);
  const [gedaan, setGedaan] = useState(0);
  const [bespaard, setBespaard] = useState(0);
  const [fout, setFout] = useState("");
  const [meldingen, setMeldingen] = useState<string[]>([]);
  const { vraag } = useDialoog();

  useEffect(() => {
    fetch("/api/admin/fotos/verklein", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tellen: true }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setOpenstaand(Number(d.openstaand) || 0);
        setTotaal(Number(d.totaal) || 0);
      })
      .catch(() => setOpenstaand(0));
  }, []);

  const start = async () => {
    if (bezig || !openstaand) return;
    const door = await vraag({
      titel: `${openstaand} foto's verkleinen?`,
      tekst:
        "Elke foto wordt vervangen door een versie van maximaal 1920 pixels breed in WebP — precies wat bezoekers van de website nu al te zien krijgen. De oude versie wordt pas verwijderd als de nieuwe erin staat.\n\nHet draait in rondes; je kunt het scherm openhouden tot het klaar is.",
      bevestig: "Verkleinen",
    });
    if (!door) return;

    setBezig(true);
    setFout("");
    setMeldingen([]);
    let over = openstaand;
    let totaalGedaan = 0;
    let totaalBespaard = 0;

    try {
      // Blijven doorgaan zolang een ronde nog iets oplevert. Levert een ronde niets op,
      // dan is wat overblijft niet te verkleinen en heeft doorgaan geen zin.
      for (let ronde = 0; ronde < 20 && over > 0; ronde++) {
        const res = await fetch("/api/admin/fotos/verklein", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setFout(d.error || "Het verkleinen is onderbroken. Wat al klaar is blijft staan.");
          break;
        }
        const d = await res.json();
        totaalGedaan += Number(d.gedaan) || 0;
        totaalBespaard += Number(d.bespaard) || 0;
        setGedaan(totaalGedaan);
        setBespaard(totaalBespaard);
        setOpenstaand(Number(d.resterend) || 0);
        if (Array.isArray(d.meldingen) && d.meldingen.length) setMeldingen(d.meldingen);
        if ((Number(d.gedaan) || 0) === 0) break;
        over = Number(d.resterend) || 0;
      }
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e));
    } finally {
      setBezig(false);
    }
  };

  // Niets te doen en niets gedaan: dan hoeft deze knop er niet te staan.
  if (openstaand === null || (openstaand === 0 && gedaan === 0)) return null;

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(0)} MB`;

  return (
    <div className="px-4 md:px-8 pb-4">
      <Panel
        title="Foto's verkleinen"
        actions={<ImageDown size={14} color={T.ink(0.35)} />}
      >
        {fout && <div className="mb-3"><Foutmelding>{fout}</Foutmelding></div>}

        {openstaand > 0 ? (
          <>
            <p style={body(12, T.ink(0.7))}>
              {openstaand} van de {totaal}{" "}foto&apos;s staan nog op volledige grootte in de opslag.
              Die zijn geüpload voordat het verkleinen was ingebouwd.
            </p>
            <p className="mt-1.5" style={klein()}>
              Ze worden vervangen door de versie die bezoekers van de website nu al zien:
              maximaal 1920 pixels breed, WebP. Dat scheelt opslag én dataverkeer, want voor
              elke maat die de website maakt wordt nu telkens het volledige origineel opgehaald.
            </p>
            <div className="mt-3">
              <Btn onClick={start} disabled={bezig}>
                {bezig ? <Spinner size={12} /> : <ImageDown size={12} />}
                {bezig ? `Bezig… nog ${openstaand}` : `Verklein ${openstaand} foto's`}
              </Btn>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Check size={14} color={T.groen} />
            <p style={body(12, T.ink(0.7))}>
              Alle foto&apos;s zijn verkleind. {gedaan} vervangen
              {bespaard > 0 ? `, ${mb(bespaard)} minder in de opslag` : ""}.
            </p>
          </div>
        )}

        {gedaan > 0 && openstaand > 0 && (
          <p className="mt-2" style={klein(T.groen)}>
            {gedaan} klaar{bespaard > 0 ? ` · ${mb(bespaard)} bespaard` : ""}
          </p>
        )}

        {meldingen.length > 0 && (
          <div className="mt-3">
            <Waarschuwing>
              <span style={{ ...micro(T.amber), fontSize: 9 }}>Overgeslagen</span>
              <br />
              {meldingen.join(" · ")}
            </Waarschuwing>
          </div>
        )}
      </Panel>
    </div>
  );
}
