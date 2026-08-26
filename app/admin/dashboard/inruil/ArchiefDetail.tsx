"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Car, Check, ClipboardCopy, ExternalLink, RotateCcw, Tag, Trash2, Wallet,
} from "lucide-react";
import {
  T, num, micro, klein, fmt, fmtGetal, fmtKm,
  Panel, Field, inputStijl, Btn, Chip, Spinner, PanelVoet,
  Th, Td, TabelWrap, rijStijl,
} from "../inkoop/ui";
import { berekenInruil, maxBod, bodBijBijbetaling } from "./som";
import { maakVoorstel } from "./voorstel";
import { useDialoog } from "../Dialoog";
import type { InruilArchiefRij } from "./types";

/**
 * Eén bewaarde inruil, helemaal uitgeklapt — en aan te passen.
 *
 * WAAROM BEWERKBAAR
 * Een inruil is zelden in één gesprek klaar. De klant belt terug met "en als ik er nou
 * twaalfduizend bij leg?", of je hebt de auto inmiddels gezien en hij is minder waard dan
 * gedacht. Was deze pagina alleen om te lezen, dan zou je dat elders moeten narekenen en
 * zou het archief het verhaal van vorige week blijven vertellen.
 *
 * Alles wat je hier verandert wordt vanzelf bewaard, en de bedragen eronder rekenen mee:
 * de bijbetaling, wat je eraan overhoudt, en of het maximum van de klant nog uit kan.
 *
 * WAT HIER NIET KAN
 * Een andere auto uit de voorraad kiezen, en opnieuw taxeren. Dat zit in de rekenmachine,
 * één knop hiervandaan — met de bedragen van deze regel al ingevuld.
 */

const getalUit = (s: string) => parseInt(s.replace(/\D/g, "")) || 0;
const fmtTeken = (n: number) => (n < 0 ? `− ${fmt(Math.abs(n))}` : fmt(n));

function datumTijd(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Regel in een lijstje van label + waarde. */
function Regel({ label, waarde, sterk }: { label: string; waarde: string; sterk?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5" style={{ borderTop: `1px solid ${T.line}` }}>
      <span style={{ fontFamily: T.inter, fontSize: 11.5, color: T.ink(0.5) }}>{label}</span>
      <span
        style={{
          fontFamily: sterk ? T.play : T.inter,
          fontSize: sterk ? 14 : 11.5,
          fontWeight: 700,
          color: T.navy,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {waarde}
      </span>
    </div>
  );
}

export default function ArchiefDetail({
  rij,
  onTerug,
  onBijgewerkt,
  onVerwijderd,
  onTerugzetten,
}: {
  rij: InruilArchiefRij;
  onTerug: () => void;
  onBijgewerkt: (r: InruilArchiefRij) => void;
  onVerwijderd: (id: string) => void;
  onTerugzetten: (r: InruilArchiefRij) => void;
}) {
  const { vraag } = useDialoog();

  // ── Wat je kunt aanpassen ──
  const [klant, setKlant] = useState(rij.klant);
  const [km, setKm] = useState(rij.km ? String(rij.km) : "");
  const [verkoop, setVerkoop] = useState(rij.verkoopwaarde ? String(rij.verkoopwaarde) : "");
  const [bodTekst, setBodTekst] = useState(rij.bod ? String(rij.bod) : "");
  const [vraagTekst, setVraagTekst] = useState(rij.vraagprijs ? String(rij.vraagprijs) : "");
  const [kortingTekst, setKortingTekst] = useState(rij.korting ? String(rij.korting) : "");
  const [kostenTekst, setKostenTekst] = useState(rij.kosten ? String(rij.kosten) : "");
  const [maxBijTekst, setMaxBijTekst] = useState(rij.max_bijbetaling ? String(rij.max_bijbetaling) : "");
  const [marge, setMarge] = useState(rij.marge || 10);
  const [btwType, setBtwType] = useState<"marge" | "btw">(rij.btw_type === "btw" ? "btw" : "marge");

  const [bezig, setBezig] = useState(false);
  const [bewaardOp, setBewaardOp] = useState<string | null>(null);
  const [fout, setFout] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);

  const kmNum = getalUit(km);
  const verkoopwaarde = getalUit(verkoop);
  const bod = getalUit(bodTekst);
  const vraagprijs = getalUit(vraagTekst);
  const korting = getalUit(kortingTekst);
  const kosten = getalUit(kostenTekst);
  const maxBij = getalUit(maxBijTekst);

  const som = berekenInruil({ vraagprijs, korting, inruilbod: bod, verwachteVerkoop: verkoopwaarde, kosten, btwType });
  const advies = maxBod(verkoopwaarde, marge, kosten, btwType);
  const benodigdBod = bodBijBijbetaling(som.onzePrijs, maxBij);
  const bijMax = berekenInruil({
    vraagprijs, korting, inruilbod: benodigdBod, verwachteVerkoop: verkoopwaarde, kosten, btwType,
  });

  const rdw = rij.gegevens?.rdw ?? null;
  const taxatie = rij.gegevens?.taxatie ?? null;
  const posten = rij.gegevens?.posten ?? [];
  const postenTotaal = posten.reduce((s, p) => s + (p.bedrag || 0), 0);

  const klantAuto = [rij.merk, rij.model].filter(Boolean).join(" ") || "Auto van de klant";
  const uitkomstLabel =
    som.richting === "uit" ? "Wij betalen uit" : som.richting === "gelijk" ? "Gelijke ruil" : "Klant betaalt bij";

  // ── Vanzelf bewaren ────────────────────────────────────────────
  //
  // Dezelfde afspraak als in de rekenmachine: je hoeft nergens op te drukken. Een korte
  // pauze na de laatste toetsaanslag, zodat er niet bij elk cijfer een verzoek uitgaat —
  // en zodat "1" onderweg naar "12500" niet even als bod in het archief staat.
  const handtekening = [klant, kmNum, verkoopwaarde, bod, vraagprijs, korting, kosten, maxBij, marge, btwType].join("|");
  /**
   * Wat er in de database staat. Bewust een ref en geen begintoestand: draai je een bedrag
   * terug naar wat het was, dan moet dát ook bewaard worden. Met alleen de openingswaarde
   * als ijkpunt zou zo'n terugdraai stil verdwijnen.
   */
  const bewaardeHandtekening = useRef(handtekening);
  const bewaarRef = useRef<() => Promise<void>>(async () => {});

  const bewaarNu = async () => {
    const nu = handtekening;
    setBezig(true);
    setFout(false);
    try {
      const res = await fetch(`/api/admin/inruil/archief/${rij.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...rij,
          klant,
          km: kmNum,
          vraagprijs,
          korting,
          verkoopwaarde,
          bod,
          verschil: som.verschil,
          netto_marge: som.nettoMarge,
          marge,
          kosten,
          btw_type: btwType,
          max_bijbetaling: maxBij,
        }),
      });
      if (!res.ok) {
        setFout(true);
        return;
      }
      const nieuw: InruilArchiefRij = await res.json();
      bewaardeHandtekening.current = nu;
      onBijgewerkt(nieuw);
      setBewaardOp(new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setFout(true);
    } finally {
      setBezig(false);
    }
  };

  // De verwijzing na het tekenen bijwerken, niet tijdens. Zo wijst de tijdklok hieronder
  // altijd naar de bedragen zoals ze op dat moment op het scherm staan.
  useEffect(() => {
    bewaarRef.current = bewaarNu;
  });

  useEffect(() => {
    // Openen is geen wijziging: alleen wat afwijkt van wat er in de database staat gaat weg.
    if (handtekening === bewaardeHandtekening.current) return;
    const t = setTimeout(() => void bewaarRef.current(), 1200);
    return () => clearTimeout(t);
  }, [handtekening]);

  const voorstel = useMemo(
    () =>
      maakVoorstel({
        onzeAuto: rij.auto_naam,
        vraagprijs,
        korting,
        klantAuto,
        km: kmNum,
        bod,
        richting: som.richting,
        bedrag: som.bedrag,
      }),
    [rij.auto_naam, vraagprijs, korting, klantAuto, kmNum, bod, som.richting, som.bedrag]
  );

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(voorstel);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2500);
    } catch {
      /* Zonder klembordrechten valt er niets te kopiëren; alles staat op het scherm. */
    }
  };

  const verwijder = async () => {
    const akkoord = await vraag({
      titel: `Inruil van ${klantAuto} verwijderen?`,
      tekst:
        [klant, rij.kenteken ? rij.kenteken.toUpperCase() : "", `bewaard op ${datumTijd(rij.aangemaakt)}`]
          .filter(Boolean)
          .join(" · ") + "\n\nAlles wat hier staat verdwijnt mee. Dit is niet ongedaan te maken.",
      bevestig: "Verwijderen",
      gevaar: true,
    });
    if (!akkoord) return;
    await fetch(`/api/admin/inruil/archief/${rij.id}`, { method: "DELETE" });
    onVerwijderd(rij.id);
  };

  const geldVeld = {
    ...inputStijl,
    height: 44,
    paddingRight: 30,
    fontFamily: T.play,
    fontSize: 18,
    fontWeight: 700,
    color: T.navy,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Balk: terug, status, acties ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Btn variant="ghost" size="sm" onClick={onTerug}>
          <ArrowLeft size={12} /> Terug naar het archief
        </Btn>

        <span className="flex items-center gap-1.5" style={klein(fout ? T.rood : T.ink(0.45))}>
          {bezig ? (
            <>
              <Spinner size={11} /> Bewaren…
            </>
          ) : fout ? (
            "Niet bewaard — controleer je verbinding"
          ) : bewaardOp ? (
            <>
              <Check size={11} style={{ color: T.groen }} /> Bewaard om {bewaardOp}
            </>
          ) : (
            "Wijzigingen worden vanzelf bewaard"
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Btn variant="ghost" size="sm" onClick={kopieer}>
            {gekopieerd ? <Check size={11} /> : <ClipboardCopy size={11} />}
            {gekopieerd ? "Gekopieerd" : "Kopieer voorstel"}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => onTerugzetten(rij)}>
            <RotateCcw size={11} /> Naar de rekenmachine
          </Btn>
          <button
            type="button"
            onClick={verwijder}
            aria-label="Verwijderen"
            className="px-2.5 py-1.5 transition-all hover:opacity-70"
            style={{ border: "1px solid rgba(185,28,28,0.25)", color: T.rood }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Kop: de uitkomst ── */}
      <Panel tone="donker">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p style={{ ...micro("rgba(255,255,255,0.45)"), fontSize: 9 }}>{uitkomstLabel}</p>
            <p className="mt-1" style={num(38, "#ffffff")}>
              {fmt(som.bedrag)}
            </p>
            <p className="mt-1.5" style={klein("rgba(255,255,255,0.5)")}>
              {klantAuto}
              {rij.kenteken ? ` (${rij.kenteken.toUpperCase()})` : ""}
              {rij.auto_naam ? ` tegen ${rij.auto_naam}` : ""}
            </p>
          </div>
          <div className="text-right">
            {klant && (
              <p style={{ fontFamily: T.inter, fontSize: 13, fontWeight: 700, color: "#ffffff" }}>{klant}</p>
            )}
            <p className="mt-0.5" style={klein("rgba(255,255,255,0.45)")}>
              Bewaard op {datumTijd(rij.aangemaakt)}
            </p>
            {rij.bijgewerkt && (
              <p style={klein("rgba(255,255,255,0.35)")}>Laatst aangepast {datumTijd(rij.bijgewerkt)}</p>
            )}
          </div>
        </div>
      </Panel>

      {/* ── De twee auto's ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="De auto van de klant" icon={<Car size={13} style={{ color: T.ink(0.35) }} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Klant" hint="Naam of telefoonnummer">
              <input
                type="text"
                value={klant}
                onChange={(e) => setKlant(e.target.value)}
                placeholder="Naam of telefoonnummer"
                style={inputStijl}
              />
            </Field>
            <Field label="Kilometerstand" suffix="km">
              <input
                type="text"
                inputMode="numeric"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="0"
                style={{ ...inputStijl, paddingRight: 34 }}
              />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Wat verkopen wij hem voor"
              suffix="€"
              hint={rij.bron ? `Destijds bepaald met ${rij.bron}` : undefined}
            >
              <input
                type="text"
                inputMode="numeric"
                value={verkoop}
                onChange={(e) => setVerkoop(e.target.value)}
                placeholder="0"
                style={geldVeld}
              />
            </Field>
            <Field
              label="Wat wij ervoor gaven"
              suffix="€"
              hint={
                advies > 0
                  ? bod > advies
                    ? `${fmt(bod - advies)} boven het advies van ${fmt(advies)}`
                    : `Advies bij ${marge}%: maximaal ${fmt(advies)}`
                  : undefined
              }
              hintColor={advies > 0 && bod > advies ? T.amber : undefined}
            >
              <input
                type="text"
                inputMode="numeric"
                value={bodTekst}
                onChange={(e) => setBodTekst(e.target.value)}
                placeholder="0"
                style={geldVeld}
              />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Klaarmaakkosten"
              suffix="€"
              hint={
                posten.length > 0
                  ? kosten === postenTotaal
                    ? posten.map((p) => `${p.label} ${fmt(p.bedrag)}`).join(" · ")
                    : `Handmatig aangepast — was ${posten.map((p) => p.label).join(" · ")} samen ${fmt(postenTotaal)}`
                  : undefined
              }
            >
              <input
                type="text"
                inputMode="numeric"
                value={kostenTekst}
                onChange={(e) => setKostenTekst(e.target.value)}
                placeholder="0"
                style={{ ...inputStijl, paddingRight: 34 }}
              />
            </Field>
            <div>
              <p className="mb-1.5" style={micro()}>
                Gewenste marge
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[8, 10, 12, 15, 20].map((p) => (
                  <Chip key={p} active={marge === p} onClick={() => setMarge(p)}>
                    {p}%
                  </Chip>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Chip active={btwType === "marge"} onClick={() => setBtwType("marge")}>
                  Particulier
                </Chip>
                <Chip active={btwType === "btw"} onClick={() => setBtwType("btw")}>
                  Bedrijf (btw)
                </Chip>
              </div>
            </div>
          </div>

          {rdw && (
            <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.line2}` }}>
              <p className="mb-1" style={{ ...micro(), fontSize: 8.5 }}>
                Uit het RDW-register
              </p>
              {(
                [
                  ["Bouwjaar", rij.bouwjaar ? String(rij.bouwjaar) : ""],
                  ["Brandstof", rdw.brandstof ?? ""],
                  ["Carrosserie", rdw.bodytype ?? ""],
                  ["Kleur", rdw.kleur ?? ""],
                  ["Vermogen", rdw.vermogen ?? ""],
                  ["APK tot", rdw.apk ?? ""],
                  ["Nieuwprijs", rdw.catalogusprijs ? fmt(rdw.catalogusprijs) : ""],
                  ["Uitvoering", rij.gegevens?.uitvoering ?? ""],
                ] as [string, string][]
              )
                .filter(([, v]) => v)
                .map(([l, v]) => (
                  <Regel key={l} label={l} waarde={v} />
                ))}
            </div>
          )}
        </Panel>

        <Panel title="Onze auto" icon={<Tag size={13} style={{ color: T.ink(0.35) }} />}>
          <p className="mb-3" style={{ fontFamily: T.play, fontSize: 16, fontWeight: 700, color: T.navy }}>
            {rij.auto_naam || "Losse vraagprijs"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Vraagprijs" suffix="€">
              <input
                type="text"
                inputMode="numeric"
                value={vraagTekst}
                onChange={(e) => setVraagTekst(e.target.value)}
                placeholder="0"
                style={geldVeld}
              />
            </Field>
            <Field label="Korting" suffix="€">
              <input
                type="text"
                inputMode="numeric"
                value={kortingTekst}
                onChange={(e) => setKortingTekst(e.target.value)}
                placeholder="0"
                style={geldVeld}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Regel label="Onze prijs" waarde={fmt(som.onzePrijs)} sterk />
            <Regel label={`Inruil ${klantAuto}`} waarde={`− ${fmt(bod)}`} />
            <Regel label={uitkomstLabel} waarde={fmt(som.bedrag)} sterk />
          </div>

          <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.line2}` }}>
            <p className="mb-1" style={{ ...micro(), fontSize: 8.5 }}>
              Wat je aan zijn auto overhield
            </p>
            <p style={num(26, som.nettoMarge < 0 ? T.rood : T.groen)}>{fmtTeken(som.nettoMarge)}</p>
            <div className="mt-2">
              <Regel label="Verkoopwaarde" waarde={fmt(verkoopwaarde)} />
              <Regel label="Ons bod" waarde={`− ${fmt(bod)}`} />
              <Regel
                label={btwType === "btw" ? "Btw (21% over de verkoop)" : "Btw (21/121 over de marge)"}
                waarde={`− ${fmt(som.btwAfdracht)}`}
              />
              <Regel label="Klaarmaakkosten" waarde={`− ${fmt(kosten)}`} />
            </div>
          </div>

          <PanelVoet>
            Een andere auto uit de voorraad kiezen of opnieuw taxeren doe je in de rekenmachine —
            de knop bovenaan zet deze inruil daar met alle bedragen weer neer.
          </PanelVoet>
        </Panel>
      </div>

      {/* ── Zijn maximum ── */}
      <Panel title="Wat de klant maximaal bijbetaalt" icon={<Wallet size={13} style={{ color: T.ink(0.35) }} />}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8">
          <div className="lg:col-span-4">
            <Field
              label="Hij legt er maximaal bij"
              suffix="€"
              hint="Aanpassen mag — belt hij terug met een ander bedrag, dan zie je hier meteen of het nog uit kan."
            >
              <input
                type="text"
                inputMode="numeric"
                value={maxBijTekst}
                onChange={(e) => setMaxBijTekst(e.target.value)}
                placeholder="0"
                style={geldVeld}
              />
            </Field>
          </div>

          <div className="lg:col-span-8">
            {maxBij <= 0 || som.onzePrijs <= 0 ? (
              <p style={klein()}>
                Vul in wat hij maximaal wil bijleggen, dan staat hier wat je zijn auto daarvoor moet
                overnemen en of dat uit kan.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p style={{ ...micro(), fontSize: 9 }}>Dan neem je zijn auto over voor</p>
                    <p className="mt-1" style={num(28)}>
                      {fmt(benodigdBod)}
                    </p>
                  </div>
                  <div>
                    <p style={{ ...micro(), fontSize: 9 }}>Houd je daaraan over</p>
                    <p className="mt-1" style={num(28, bijMax.nettoMarge < 0 ? T.rood : T.groen)}>
                      {fmtTeken(bijMax.nettoMarge)}
                    </p>
                  </div>
                </div>
                <p style={klein()}>
                  {advies > 0 && benodigdBod <= advies
                    ? `Dat past binnen de ${marge}% die je wilde houden — ${fmt(advies - benodigdBod)} onder het advies van ${fmt(advies)}.`
                    : bijMax.nettoMarge > 0
                      ? `Dat is ${fmt(benodigdBod - advies)} boven het advies van ${fmt(advies)}: het kan, maar het kost je marge.`
                      : `Voor ${fmt(benodigdBod)} koop je een auto die ${fmt(verkoopwaarde)} opbrengt — daar leg je ${fmt(-bijMax.nettoMarge)} op toe.`}
                </p>
                {benodigdBod !== bod && benodigdBod > 0 && (
                  <div>
                    <Btn variant="ghost" size="sm" onClick={() => setBodTekst(String(benodigdBod))}>
                      Neem {fmt(benodigdBod)} over als ons bod
                    </Btn>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* ── Waar de waarde op rustte ── */}
      {taxatie && (
        <Panel
          title="Waar de waarde op rustte"
          meta={taxatie.berekening?.bron}
          flush
        >
          <div className="px-4 md:px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(
              [
                ["Advertenties", taxatie.markt?.aantal_gevonden ? String(taxatie.markt.aantal_gevonden) : "—"],
                ["Gemiddelde vraagprijs", taxatie.markt?.gemiddelde_prijs ? fmt(taxatie.markt.gemiddelde_prijs) : "—"],
                [
                  "Spreiding",
                  taxatie.markt?.min_prijs
                    ? `${fmt(taxatie.markt.min_prijs)} – ${fmt(taxatie.markt.max_prijs)}`
                    : "—",
                ],
                [
                  "Per 1.000 km",
                  taxatie.berekening?.per_duizend_km
                    ? `€ ${fmtGetal(Math.abs(taxatie.berekening.per_duizend_km))}`
                    : "—",
                ],
                [
                  "Koerslijst",
                  taxatie.berekening?.koerslijst_waarde ? fmt(taxatie.berekening.koerslijst_waarde) : "—",
                ],
              ] as [string, string][]
            ).map(([l, v]) => (
              <div key={l} className="p-2.5" style={{ backgroundColor: "rgba(0,19,55,0.02)", border: `1px solid ${T.line}` }}>
                <p className="truncate" style={{ ...micro(), fontSize: 8.5 }}>
                  {l}
                </p>
                <p className="mt-1" style={num(14)}>
                  {v}
                </p>
              </div>
            ))}
          </div>

          {taxatie.markt?.vergelijkbare && taxatie.markt.vergelijkbare.length > 0 && (
            <TabelWrap>
              <thead>
                <tr style={{ borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line2}` }}>
                  <Th>Advertentie</Th>
                  <Th align="right">Bouwjaar</Th>
                  <Th align="right">Kilometerstand</Th>
                  <Th align="right">Vraagprijs</Th>
                  <Th align="center" width={40}>
                    Link
                  </Th>
                </tr>
              </thead>
              <tbody>
                {taxatie.markt.vergelijkbare.map((a, i) => (
                  <tr key={`${a.titel}-${i}`} style={rijStijl(i)}>
                    <Td>
                      <span className="block truncate" style={{ maxWidth: 340 }}>
                        {a.titel}
                      </span>
                    </Td>
                    <Td align="right">{a.bouwjaar || "—"}</Td>
                    <Td align="right">{a.km ? fmtKm(a.km) : "—"}</Td>
                    <Td align="right" cijfer>
                      {fmt(a.prijs)}
                    </Td>
                    <Td align="center">
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: T.blauw }}>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TabelWrap>
          )}

          <PanelVoet>
            Dit is het aanbod zoals het er toen bij stond. Die advertenties zijn inmiddels verkocht of
            aangepast; opnieuw taxeren geeft de markt van vandaag.
          </PanelVoet>
        </Panel>
      )}
    </div>
  );
}
