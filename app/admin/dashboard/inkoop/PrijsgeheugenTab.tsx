"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, Check, TrendingDown, AlertTriangle, Car, Search } from "lucide-react";
import {
  T, num, micro, klein, body, fmt, fmtGetal,
  Panel, Stat, Btn, Spinner, Empty, Waarschuwing, PanelVoet, inputStijl,
  Th, Td, TabelWrap, rijStijl,
} from "./ui";

/**
 * Het prijsgeheugen: klopt de prijs die de tool noemt met wat er in het echt gebeurde?
 *
 * WAT HIER TE ZIEN IS
 * Van elke auto de hele keten naast elkaar — wat de tool adviseerde, wat je betaalde, wat
 * je vroeg, en waarvoor hij wegging. Daaruit rolt één getal: hoeveel je gemiddeld krijgt
 * ten opzichte van je eigen eerste vraagprijs. Dat getal gaat terug de taxatietool in.
 *
 * WAAROM DE INVOERVELDEN BOVENAAN STAAN
 * Zonder verkoopprijzen valt er niets te ijken, en die zijn er alleen als iemand ze
 * invult. Daarom staat "wat ontbreekt er nog" boven de mooie tabellen: dat is het enige
 * op deze pagina waar je iets mee kúnt, en het is elke keer één bedrag intikken.
 */

type AutoIJking = {
  auto_id: number;
  kenteken: string;
  merk: string;
  model: string;
  bouwjaar: number;
  verkocht: boolean;
  toegevoegd_op: string | null;
  verkocht_op: string | null;
  standtijd: number | null;
  advies_verkoop: number | null;
  advies_inkoop: number | null;
  advies_bron: string;
  inkoop: number | null;
  kosten: number;
  eerste_vraagprijs: number | null;
  huidige_vraagprijs: number | null;
  verlagingen: number;
  verlaagd_met: number;
  vraagprijs_gemeten: boolean;
  verkocht_voor: number | null;
  verkoop_bron: string;
  realisatie: number | null;
  advies_afwijking: number | null;
  netto_marge: number | null;
};

type Kalibratie = {
  autos: AutoIJking[];
  ontbreekt: AutoIJking[];
  factor: number | null;
  aantal_verkopen: number;
  buiten_grenzen: number;
  per_merk: { merk: string; aantal: number; factor: number; gem_standtijd: number | null }[];
  advies_afwijking: number | null;
  aantal_met_advies: number;
  zonder_historie: number;
  gebruikte_factor: number;
  gebruikt_eigen_cijfer: boolean;
  gem_standtijd_verkocht: number | null;
  gem_verlaging: number | null;
  aantal_verlaagd: number;
};

const pct = (f: number) => `${(f * 100).toFixed(1).replace(".", ",")}%`;
/** Negatief hoort als "− € 550" te staan, niet als "€ -550": daar kijk je overheen. */
const fmtTeken = (n: number) => (n < 0 ? `− ${fmt(Math.abs(n))}` : fmt(n));
const naam = (a: AutoIJking) => `${a.merk} ${a.model}`.trim() || "Naamloos";

/** Hoe ver zat de tool ernaast? Kleur zegt hier alleen iets bij een echt verschil. */
const afwijkingKleur = (f: number) => (f >= 0.97 && f <= 1.03 ? T.groen : f >= 0.92 && f <= 1.08 ? T.amber : T.rood);

export default function PrijsgeheugenTab() {
  const [data, setData] = useState<Kalibratie | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [invoer, setInvoer] = useState<Record<number, string>>({});
  const [bezig, setBezig] = useState<number | null>(null);
  const [zoek, setZoek] = useState("");

  const laad = () =>
    fetch("/api/admin/prijzen")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Ophalen mislukt"))))
      .then((d: Kalibratie) => {
        setData(d);
        setFout(null);
      })
      .catch((e: unknown) => setFout(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    fetch("/api/admin/prijzen")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Ophalen mislukt"))))
      .then((d: Kalibratie) => setData(d))
      .catch((e: unknown) => setFout(e instanceof Error ? e.message : String(e)));
  }, []);

  const bewaarVerkoopprijs = async (a: AutoIJking) => {
    const bedrag = parseInt((invoer[a.auto_id] ?? "").replace(/\D/g, "")) || 0;
    if (bedrag <= 0) return;
    setBezig(a.auto_id);
    try {
      await fetch("/api/admin/prijzen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_id: a.auto_id, verkoopprijs: bedrag, kenteken: a.kenteken }),
      });
      setInvoer((v) => {
        const n = { ...v };
        delete n[a.auto_id];
        return n;
      });
      await laad();
    } finally {
      setBezig(null);
    }
  };

  const verkocht = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return (data?.autos ?? [])
      .filter((a) => a.verkocht && a.verkocht_voor != null)
      .filter((a) => !z || `${a.merk} ${a.model} ${a.kenteken}`.toLowerCase().includes(z))
      .sort((a, b) => (a.verkocht_op ?? "") < (b.verkocht_op ?? "") ? 1 : -1);
  }, [data, zoek]);

  const voorraad = useMemo(
    () =>
      (data?.autos ?? [])
        .filter((a) => !a.verkocht)
        .sort((a, b) => (b.standtijd ?? 0) - (a.standtijd ?? 0)),
    [data]
  );

  if (fout) {
    return (
      <Empty
        icon={<AlertTriangle size={28} style={{ color: T.rood }} />}
        title="Het prijsgeheugen kon niet worden opgehaald"
        body={fout}
      >
        <Btn onClick={laad}>Opnieuw proberen</Btn>
      </Empty>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-2 py-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse" style={{ height: 64, backgroundColor: "rgba(0,19,55,0.05)" }} />
        ))}
      </div>
    );
  }

  const nogNodig = Math.max(0, 5 - data.aantal_verkopen);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Wat het geheugen weet ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Je krijgt gemiddeld"
          value={data.factor != null ? pct(data.factor) : "—"}
          sub={
            data.aantal_verkopen > 0
              ? `van je eerste vraagprijs · ${data.aantal_verkopen} verkopen`
              : "nog geen verkopen gemeten"
          }
          accent={T.navy}
          size={28}
        />
        <Stat
          label="Tool rekent met"
          value={pct(data.gebruikte_factor)}
          sub={data.gebruikt_eigen_cijfer ? "jouw eigen cijfer" : "aanname, nog te weinig verkopen"}
          accent={data.gebruikt_eigen_cijfer ? T.groen : T.amber}
          size={28}
        />
        <Stat
          label="Gem. standtijd"
          value={data.gem_standtijd_verkocht != null ? `${Math.round(data.gem_standtijd_verkocht)}` : "—"}
          sub="dagen tot verkoop"
          size={28}
        />
        <Stat
          label="Gem. verlaging"
          value={data.gem_verlaging != null ? fmt(data.gem_verlaging) : "—"}
          sub={`bij ${data.aantal_verlaagd} van de verkochte auto's`}
          accent={T.amber}
          size={28}
        />
      </div>

      {/* ── Wat er nog ingevuld moet worden ── */}
      {data.ontbreekt.length > 0 && (
        <Panel
          title="Waarvoor zijn deze weggegaan?"
          icon={<AlertTriangle size={13} style={{ color: T.amber }} />}
          meta={`${data.ontbreekt.length} ${data.ontbreekt.length === 1 ? "auto" : "auto's"}`}
        >
          <p className="mb-3" style={body(12.5, T.ink(0.6))}>
            Deze auto&apos;s staan op verkocht, maar het bedrag is nergens vastgelegd. Zonder dat kan de
            tool niet leren of zijn prijs klopte. Vul in wat er werkelijk is betaald voor de auto zelf —
            zonder garantie, extra&apos;s of afleverkosten.
          </p>
          <div className="flex flex-col">
            {data.ontbreekt.map((a) => (
              <div
                key={a.auto_id}
                className="flex items-center gap-3 py-2.5 flex-wrap"
                style={{ borderTop: `1px solid ${T.line}` }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontFamily: T.inter, fontSize: 12.5, fontWeight: 600, color: T.navy }}>
                    {naam(a)}
                  </span>
                  <span className="block truncate" style={klein()}>
                    {[a.kenteken || null, a.bouwjaar || null, a.huidige_vraagprijs ? `vroeg ${fmt(a.huidige_vraagprijs)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={invoer[a.auto_id] ?? ""}
                    onChange={(e) => setInvoer((v) => ({ ...v, [a.auto_id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && bewaarVerkoopprijs(a)}
                    placeholder={a.huidige_vraagprijs ? String(a.huidige_vraagprijs) : "0"}
                    style={{ ...inputStijl, width: 130, fontFamily: T.play, fontWeight: 700, fontSize: 15 }}
                  />
                  <Btn
                    size="sm"
                    onClick={() => bewaarVerkoopprijs(a)}
                    disabled={bezig === a.auto_id || !(invoer[a.auto_id] ?? "").trim()}
                  >
                    {bezig === a.auto_id ? <Spinner size={11} tone="donker" /> : <Check size={11} />}
                    Vastleggen
                  </Btn>
                </div>
              </div>
            ))}
          </div>
          <PanelVoet>
            Is er een factuur van gemaakt, dan pakt het geheugen dat bedrag vanzelf op — dan hoef je hier
            niets te doen.
          </PanelVoet>
        </Panel>
      )}

      {/* ── Wat de tool ervan leert ── */}
      <Panel title="Wat de taxatietool hiermee doet" icon={<Brain size={13} style={{ color: T.ink(0.35) }} />}>
        <p style={body(12.5, T.ink(0.65))}>
          De tool kijkt naar vraagprijzen van vergelijkbare auto&apos;s op internet. Wat er in het echt
          betaald wordt ligt daaronder, en hoevéél daaronder was tot nu toe een aanname: 4%.{" "}
          {data.gebruikt_eigen_cijfer ? (
            <>
              Dat is nu jouw eigen cijfer geworden. Over {data.aantal_verkopen} verkopen ging er gemiddeld{" "}
              <strong style={{ color: T.navy }}>{pct(data.factor!)}</strong> van de eerste vraagprijs binnen,
              en daar rekent de taxatietool sinds die meting mee.
            </>
          ) : (
            <>
              {nogNodig === 1 ? "Er is nog" : "Er zijn nog"}{" "}
              <strong style={{ color: T.navy }}>
                {nogNodig} {nogNodig === 1 ? "verkoop" : "verkopen"}
              </strong>{" "}
              met een vastgelegde verkoopprijs nodig voordat je eigen cijfer die aanname vervangt. Tot die
              tijd blijft de tool op {pct(data.gebruikte_factor)}{" "}rekenen — beter een eerlijke
              aanname dan een gemiddelde over twee auto&apos;s.
            </>
          )}
          {data.buiten_grenzen > 0 && (
            <>
              {" "}
              {data.buiten_grenzen} {data.buiten_grenzen === 1 ? "verkoop telt" : "verkopen tellen"} niet
              mee: die weken zo ver af van de vraagprijs dat het geen onderhandeling meer was.
            </>
          )}
        </p>

        {data.zonder_historie > 0 && (
          <p className="mt-3" style={klein()}>
            Let op bij {data.zonder_historie} van de {data.aantal_verkopen} gemeten{" "}
            {data.zonder_historie === 1 ? "verkoop" : "verkopen"}: die auto&apos;s stonden er al voordat
            het prijsgeheugen bestond, dus daarvan kennen we alleen de láátste vraagprijs. Ben je bij die
            auto&apos;s tussendoor gezakt, dan ziet dit cijfer er gunstiger uit dan het was. Vanaf nu wordt
            elke verlaging onthouden, en klopt het vanzelf steeds beter.
          </p>
        )}

        {data.advies_afwijking != null && (
          <div className="mt-4 p-3.5" style={{ backgroundColor: "rgba(0,19,55,0.02)", border: `1px solid ${T.line}` }}>
            <p style={{ ...micro(), fontSize: 9 }}>De scorekaart</p>
            <p className="mt-1.5" style={num(22, afwijkingKleur(data.advies_afwijking))}>
              {pct(data.advies_afwijking)}
            </p>
            <p className="mt-1" style={klein()}>
              Zoveel bracht een auto op ten opzichte van wat de tool vooraf voorspelde, over{" "}
              {data.aantal_met_advies} {data.aantal_met_advies === 1 ? "auto" : "auto's"}.{" "}
              {data.advies_afwijking >= 0.97 && data.advies_afwijking <= 1.03
                ? "Dat is raak — de voorspelling klopt."
                : data.advies_afwijking < 0.97
                  ? "De tool zit structureel te hoog: je haalt minder binnen dan hij voorspelt."
                  : "De tool zit structureel te laag: je haalt méér binnen dan hij voorspelt."}{" "}
              Dit cijfer wordt bewust niet automatisch verrekend — de correctie hierboven zit al in de
              voorspelling, en twee keer corrigeren voor hetzelfde jaagt het model uit koers.
            </p>
          </div>
        )}

        {data.per_merk.length > 0 && (
          <div className="mt-4">
            <p className="mb-2" style={{ ...micro(), fontSize: 9 }}>
              Per merk — gebruikt zodra er genoeg van verkocht is
            </p>
            <div className="flex flex-wrap gap-2">
              {data.per_merk.map((m) => (
                <div
                  key={m.merk}
                  className="px-3 py-2"
                  style={{ border: `1px solid ${T.line2}`, backgroundColor: T.paper }}
                >
                  <span style={{ fontFamily: T.inter, fontSize: 11.5, fontWeight: 700, color: T.navy }}>
                    {m.merk}
                  </span>
                  <span className="ml-2" style={num(13)}>
                    {pct(m.factor)}
                  </span>
                  <span className="ml-2" style={klein()}>
                    {m.aantal} verkocht
                    {m.gem_standtijd != null ? ` · ${Math.round(m.gem_standtijd)} dgn` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* ── De keten per verkochte auto ── */}
      <Panel
        title="Wat elke auto werkelijk deed"
        icon={<TrendingDown size={13} style={{ color: T.ink(0.35) }} />}
        meta={`${verkocht.length} verkocht`}
        flush
        actions={
          <div className="relative">
            <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: T.ink(0.3) }} />
            <input
              type="text"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek auto of kenteken…"
              style={{ ...inputStijl, height: 30, paddingLeft: 26, fontSize: 11.5, width: 190 }}
            />
          </div>
        }
      >
        {verkocht.length === 0 ? (
          <div className="p-6">
            <p style={klein()}>
              Nog geen verkochte auto&apos;s met een vastgelegde verkoopprijs. Zodra je er een invult
              verschijnt hier de hele keten: van wat de tool adviseerde tot wat er binnenkwam.
            </p>
          </div>
        ) : (
          <TabelWrap>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.line2}` }}>
                <Th>Auto</Th>
                <Th align="right">Advies</Th>
                <Th align="right">Ingekocht</Th>
                <Th align="right">Eerst gevraagd</Th>
                <Th align="right">Gezakt</Th>
                <Th align="right">Verkocht</Th>
                <Th align="right">Realisatie</Th>
                <Th align="right">Standtijd</Th>
                <Th align="right">Netto marge</Th>
              </tr>
            </thead>
            <tbody>
              {verkocht.map((a, i) => (
                <tr key={a.auto_id} style={rijStijl(i)}>
                  <Td>
                    <span className="block" style={{ fontWeight: 600, color: T.navy }}>
                      {naam(a)}
                    </span>
                    <span className="block" style={{ fontSize: 10, color: T.ink(0.4) }}>
                      {[a.kenteken || null, a.bouwjaar || null].filter(Boolean).join(" · ")}
                    </span>
                  </Td>
                  <Td align="right" cijfer color={a.advies_verkoop ? undefined : T.ink(0.3)}>
                    {a.advies_verkoop ? fmt(a.advies_verkoop) : "—"}
                  </Td>
                  <Td align="right" cijfer color={a.inkoop ? undefined : T.ink(0.3)}>
                    {a.inkoop ? fmt(a.inkoop) : "—"}
                  </Td>
                  <Td align="right" cijfer color={a.vraagprijs_gemeten ? undefined : T.ink(0.45)}>
                    {a.eerste_vraagprijs ? `${fmt(a.eerste_vraagprijs)}${a.vraagprijs_gemeten ? "" : " *"}` : "—"}
                  </Td>
                  <Td align="right" color={a.verlaagd_met > 0 ? T.amber : T.ink(0.3)}>
                    {a.verlaagd_met > 0 ? `− ${fmt(a.verlaagd_met)}` : "—"}
                  </Td>
                  <Td align="right" cijfer>
                    {fmt(a.verkocht_voor!)}
                  </Td>
                  <Td align="right" color={a.realisatie ? afwijkingKleur(a.realisatie) : undefined}>
                    {a.realisatie ? pct(a.realisatie) : "—"}
                  </Td>
                  <Td align="right">{a.standtijd != null ? `${a.standtijd} dgn` : "—"}</Td>
                  <Td align="right" cijfer color={a.netto_marge == null ? T.ink(0.3) : a.netto_marge < 0 ? T.rood : T.groen}>
                    {a.netto_marge != null ? fmtTeken(a.netto_marge) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TabelWrap>
        )}
        <PanelVoet>
          Realisatie is de verkoopprijs gedeeld door je eerste vraagprijs. Een streepje betekent dat het
          cijfer er niet is: geen taxatie op dit kenteken, of geen inkoopprijs in de marge-calculator. Een
          sterretje bij de vraagprijs betekent dat die auto er al stond voordat het geheugen bestond — dan
          is het de laatst bekende vraagprijs en niet per se de eerste.
        </PanelVoet>
      </Panel>

      {/* ── Wat er nu staat ── */}
      <Panel
        title="Nu in de voorraad"
        icon={<Car size={13} style={{ color: T.ink(0.35) }} />}
        meta={`${voorraad.length} ${voorraad.length === 1 ? "auto" : "auto's"}`}
        flush
      >
        {voorraad.length === 0 ? (
          <div className="p-6">
            <p style={klein()}>Er staat op dit moment niets in de voorraad.</p>
          </div>
        ) : (
          <TabelWrap>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.line2}` }}>
                <Th>Auto</Th>
                <Th align="right">Eerst gevraagd</Th>
                <Th align="right">Nu</Th>
                <Th align="right">Gezakt</Th>
                <Th align="right">Verlagingen</Th>
                <Th align="right">Staat er</Th>
                <Th align="right">Verwacht bij dit tempo</Th>
              </tr>
            </thead>
            <tbody>
              {voorraad.map((a, i) => {
                // Wat je er volgens je eigen ervaring voor krijgt als je nu verkoopt.
                const verwacht =
                  a.huidige_vraagprijs != null
                    ? Math.round(a.huidige_vraagprijs * data.gebruikte_factor)
                    : null;
                return (
                  <tr key={a.auto_id} style={rijStijl(i)}>
                    <Td>
                      <span className="block" style={{ fontWeight: 600, color: T.navy }}>
                        {naam(a)}
                      </span>
                      <span className="block" style={{ fontSize: 10, color: T.ink(0.4) }}>
                        {[a.kenteken || null, a.bouwjaar || null].filter(Boolean).join(" · ")}
                      </span>
                    </Td>
                    <Td align="right" cijfer>
                      {a.eerste_vraagprijs ? fmt(a.eerste_vraagprijs) : "—"}
                    </Td>
                    <Td align="right" cijfer>
                      {a.huidige_vraagprijs ? fmt(a.huidige_vraagprijs) : "—"}
                    </Td>
                    <Td align="right" color={a.verlaagd_met > 0 ? T.amber : T.ink(0.3)}>
                      {a.verlaagd_met > 0 ? `− ${fmt(a.verlaagd_met)}` : "—"}
                    </Td>
                    <Td align="right" color={a.verlagingen > 0 ? T.navy : T.ink(0.3)}>
                      {a.verlagingen > 0 ? fmtGetal(a.verlagingen) : "—"}
                    </Td>
                    <Td align="right" color={(a.standtijd ?? 0) > 90 ? T.amber : undefined}>
                      {a.standtijd != null ? `${a.standtijd} dgn` : "—"}
                    </Td>
                    <Td align="right" cijfer color={T.ink(0.6)}>
                      {verwacht ? fmt(verwacht) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TabelWrap>
        )}
        <PanelVoet>
          &ldquo;Verwacht bij dit tempo&rdquo; is de huidige vraagprijs maal {pct(data.gebruikte_factor)} — wat
          er volgens je eigen verkopen van deze vraagprijs binnenkomt. Geen voorspelling voor déze auto,
          wel wat er gemiddeld gebeurt.
        </PanelVoet>
      </Panel>

      {data.autos.length > 0 && data.ontbreekt.length === 0 && data.aantal_verkopen === 0 && (
        <Waarschuwing>
          Er zijn nog geen verkopen met een vastgelegde prijs. Vanaf nu wordt elke prijswijziging in de
          voorraad onthouden, en bij het op verkocht zetten wordt gevraagd waarvoor hij wegging — daarna
          vult deze pagina zichzelf.
        </Waarschuwing>
      )}
    </div>
  );
}
