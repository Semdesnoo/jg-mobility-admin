"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, Fuel, Euro, Globe, Check, Search } from "lucide-react";
import { T, micro, body, Panel, Btn, Chip, Field, inputStijl, Spinner, PanelVoet } from "./inkoop/ui";

export type Criteria = {
  brandstof: string[];
  prijsMin: number;
  prijsMax: number;
  straalKm: number;
  vertrekpunt: { naam: string; lat: number; lon: number };
  landen: string[];
};

const BRANDSTOFFEN = [
  { id: "benzine", label: "Benzine" },
  { id: "diesel", label: "Diesel" },
  { id: "hybride", label: "Hybride" },
  { id: "elektrisch", label: "Elektrisch" },
];

const LANDEN = [
  { code: "NL", naam: "Nederland" },
  { code: "BE", naam: "België" },
  { code: "DE", naam: "Duitsland" },
];

/** Referentiesteden om de straal aan af te meten. */
const STEDEN = [
  { naam: "Rotterdam", lat: 51.9225, lon: 4.4792, land: "NL" },
  { naam: "Den Haag", lat: 52.0705, lon: 4.3007, land: "NL" },
  { naam: "Dordrecht", lat: 51.8133, lon: 4.6901, land: "NL" },
  { naam: "Breda", lat: 51.5719, lon: 4.7683, land: "NL" },
  { naam: "Utrecht", lat: 52.0907, lon: 5.1214, land: "NL" },
  { naam: "Amsterdam", lat: 52.3676, lon: 4.9041, land: "NL" },
  { naam: "Eindhoven", lat: 51.4416, lon: 5.4697, land: "NL" },
  { naam: "Arnhem", lat: 51.9851, lon: 5.8987, land: "NL" },
  { naam: "Middelburg", lat: 51.4988, lon: 3.6136, land: "NL" },
  { naam: "Zwolle", lat: 52.5168, lon: 6.083, land: "NL" },
  { naam: "Enschede", lat: 52.2215, lon: 6.8937, land: "NL" },
  { naam: "Leeuwarden", lat: 53.2012, lon: 5.7999, land: "NL" },
  { naam: "Groningen", lat: 53.2194, lon: 6.5665, land: "NL" },
  { naam: "Maastricht", lat: 50.8514, lon: 5.691, land: "NL" },
  { naam: "Antwerpen", lat: 51.2194, lon: 4.4025, land: "BE" },
  { naam: "Brussel", lat: 50.8503, lon: 4.3517, land: "BE" },
  { naam: "Gent", lat: 51.0543, lon: 3.7174, land: "BE" },
  { naam: "Duisburg", lat: 51.4344, lon: 6.7623, land: "DE" },
  { naam: "Düsseldorf", lat: 51.2277, lon: 6.7735, land: "DE" },
];

const KM_PER_GRAAD = 111.32;

function afstandKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Kaartje met de actieradius.
 *
 * Geen echte kaartdienst maar een eigen tekening: dat scheelt een externe
 * afhankelijkheid én verzoeken naar buiten, en de vraag die je beantwoord wilt
 * hebben is toch "hoe ver kom ik" — niet "waar loopt de A15". De steden staan op
 * hun echte coördinaten en de cirkel is op kilometers geschaald, dus wat je ziet
 * klopt: valt Utrecht binnen de rand, dan valt Utrecht er ook echt in.
 */
function StraalKaart({
  punt,
  straalKm,
  landen,
}: {
  punt: { naam: string; lat: number; lon: number };
  straalKm: number;
  landen: string[];
}) {
  const B = 150; // halve breedte van het tekenvlak
  const H = 118; // halve hoogte
  // De cirkel mag 78% van de halve hoogte beslaan; zo blijft er rand over voor
  // steden die er net buiten vallen.
  const schaal = (H * 0.78) / straalKm;
  const cosLat = Math.cos((punt.lat * Math.PI) / 180);

  const naarXY = (s: { lat: number; lon: number }) => ({
    x: (s.lon - punt.lon) * KM_PER_GRAAD * cosLat * schaal,
    y: -(s.lat - punt.lat) * KM_PER_GRAAD * schaal,
  });

  const zichtbaar = STEDEN.map((s) => {
    const { x, y } = naarXY(s);
    const km = afstandKm(punt, s);
    return { ...s, x, y, km, binnen: km <= straalKm && landen.includes(s.land) };
  }).filter((s) => Math.abs(s.x) < B - 6 && Math.abs(s.y) < H - 6);

  const binnen = zichtbaar.filter((s) => s.binnen);

  return (
    <div>
      <svg
        viewBox={`${-B} ${-H} ${B * 2} ${H * 2}`}
        style={{ width: "100%", height: "auto", display: "block", backgroundColor: "#f6f7f9" }}
        role="img"
        aria-label={`Actieradius van ${straalKm} kilometer rond ${punt.naam}`}
      >
        {/* Ringen op een kwart, de helft en driekwart van de straal, als maatlat */}
        {[0.25, 0.5, 0.75].map((f) => (
          <circle
            key={f}
            cx={0}
            cy={0}
            r={straalKm * f * schaal}
            fill="none"
            stroke="rgba(0,19,55,0.08)"
            strokeWidth={0.8}
          />
        ))}

        <circle
          cx={0}
          cy={0}
          r={straalKm * schaal}
          fill="rgba(0,19,55,0.06)"
          stroke={T.navy}
          strokeWidth={1.4}
        />

        {zichtbaar.map((s) => (
          <g key={s.naam}>
            <circle
              cx={s.x}
              cy={s.y}
              r={s.binnen ? 2.6 : 1.8}
              fill={s.binnen ? T.groen : "rgba(0,19,55,0.28)"}
            />
            <text
              x={s.x + 4}
              y={s.y + 3}
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: 7,
                fill: s.binnen ? T.navy : "rgba(0,19,55,0.4)",
                fontWeight: s.binnen ? 700 : 400,
              }}
            >
              {s.naam}
            </text>
          </g>
        ))}

        {/* Het vertrekpunt zelf */}
        <circle cx={0} cy={0} r={3.6} fill={T.navy} stroke="#ffffff" strokeWidth={1.4} />
        <text
          x={0}
          y={-7}
          textAnchor="middle"
          style={{ fontFamily: "var(--font-inter)", fontSize: 8, fill: T.navy, fontWeight: 700 }}
        >
          {punt.naam.split(",")[0]}
        </text>

        {/* Maatlat rechtsonder */}
        <g transform={`translate(${B - 12}, ${H - 10})`}>
          <line x1={-straalKm * schaal} y1={0} x2={0} y2={0} stroke="rgba(0,19,55,0.35)" strokeWidth={0.8} />
          <line x1={-straalKm * schaal} y1={-2.5} x2={-straalKm * schaal} y2={2.5} stroke="rgba(0,19,55,0.35)" strokeWidth={0.8} />
          <line x1={0} y1={-2.5} x2={0} y2={2.5} stroke="rgba(0,19,55,0.35)" strokeWidth={0.8} />
          <text
            x={(-straalKm * schaal) / 2}
            y={-4}
            textAnchor="middle"
            style={{ fontFamily: "var(--font-inter)", fontSize: 7, fill: "rgba(0,19,55,0.5)" }}
          >
            {straalKm} km
          </text>
        </g>
      </svg>

      <p className="mt-2" style={body(11.5, T.ink(0.5))}>
        {binnen.length > 0 ? (
          <>
            Binnen bereik: <strong style={{ color: T.navy }}>{binnen.map((s) => s.naam).join(", ")}</strong>
          </>
        ) : (
          "Geen van de referentiesteden valt binnen deze straal — kies een grotere afstand."
        )}
      </p>
    </div>
  );
}

export default function VerkopersCriteria({ onFout }: { onFout: (s: string) => void }) {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [opgeslagen, setOpgeslagen] = useState<string>("");
  const [bezig, setBezig] = useState(false);

  // Zoeken naar een vertrekpunt
  const [plaatsZoek, setPlaatsZoek] = useState("");
  const [plaatsen, setPlaatsen] = useState<{ naam: string; lat: number; lon: number }[]>([]);
  const [zoekt, setZoekt] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/verkopers/criteria")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.criteria) return;
        setCriteria(d.criteria);
        setOpgeslagen(JSON.stringify(d.criteria));
      })
      .catch(() => {});
  }, []);

  // Zoeken pas nadat je even stil bent — anders vuurt elke toetsaanslag een verzoek af.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (plaatsZoek.trim().length < 2) {
      setPlaatsen([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setZoekt(true);
      try {
        const r = await fetch(`/api/admin/verkopers/locatie?q=${encodeURIComponent(plaatsZoek)}`);
        const d = await r.json();
        setPlaatsen(d.resultaten ?? []);
      } catch {
        setPlaatsen([]);
      } finally {
        setZoekt(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [plaatsZoek]);

  const gewijzigd = useMemo(
    () => criteria !== null && JSON.stringify(criteria) !== opgeslagen,
    [criteria, opgeslagen]
  );

  const bewaar = async () => {
    if (!criteria) return;
    setBezig(true);
    onFout("");
    try {
      const r = await fetch("/api/admin/verkopers/criteria", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      const d = await r.json();
      if (!r.ok) {
        onFout(d.error || "Opslaan mislukt");
        return;
      }
      setCriteria(d.criteria);
      setOpgeslagen(JSON.stringify(d.criteria));
    } finally {
      setBezig(false);
    }
  };

  if (!criteria) {
    return (
      <Panel title="Zoekgrenzen">
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </Panel>
    );
  }

  const zet = (deel: Partial<Criteria>) => setCriteria({ ...criteria, ...deel });

  return (
    <Panel
      title="Zoekgrenzen"
      icon={<MapPin size={14} color={T.navy} />}
      actions={
        gewijzigd ? (
          <Btn size="sm" onClick={bewaar} disabled={bezig}>
            {bezig ? <Spinner size={11} tone="donker" /> : <Check size={11} />} Opslaan
          </Btn>
        ) : (
          <span style={{ ...micro(T.ink(0.3)), fontSize: 8.5 }}>opgeslagen</span>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {/* Brandstof */}
        <div>
          <p className="flex items-center gap-1.5 mb-2" style={micro()}>
            <Fuel size={11} /> Brandstof
          </p>
          <div className="flex flex-wrap gap-1.5">
            {BRANDSTOFFEN.map((b) => {
              const aan = criteria.brandstof.includes(b.id);
              return (
                <Chip
                  key={b.id}
                  active={aan}
                  onClick={() =>
                    zet({
                      brandstof: aan
                        ? criteria.brandstof.filter((x) => x !== b.id)
                        : [...criteria.brandstof, b.id],
                    })
                  }
                >
                  {b.label}
                </Chip>
              );
            })}
          </div>
          <p className="mt-1.5" style={body(11, T.ink(0.42))}>
            {criteria.brandstof.length === 0
              ? "Niets aangevinkt = alle brandstoffen."
              : `Alleen ${criteria.brandstof.join(", ")}.`}
          </p>
        </div>

        {/* Prijsklasse */}
        <div>
          <p className="flex items-center gap-1.5 mb-2" style={micro()}>
            <Euro size={11} /> Prijsklasse
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Vanaf" hint="0 = geen ondergrens">
              <input
                type="number"
                min={0}
                step={500}
                value={criteria.prijsMin || ""}
                placeholder="0"
                onChange={(e) => zet({ prijsMin: Number(e.target.value) || 0 })}
                style={inputStijl}
              />
            </Field>
            <Field label="Tot" hint="0 = geen bovengrens">
              <input
                type="number"
                min={0}
                step={500}
                value={criteria.prijsMax || ""}
                placeholder="geen max"
                onChange={(e) => zet({ prijsMax: Number(e.target.value) || 0 })}
                style={inputStijl}
              />
            </Field>
          </div>
        </div>

        {/* Landen */}
        <div>
          <p className="flex items-center gap-1.5 mb-2" style={micro()}>
            <Globe size={11} /> Landen
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LANDEN.map((l) => {
              const aan = criteria.landen.includes(l.code);
              return (
                <Chip
                  key={l.code}
                  active={aan}
                  onClick={() =>
                    zet({
                      landen: aan
                        ? criteria.landen.filter((x) => x !== l.code)
                        : [...criteria.landen, l.code],
                    })
                  }
                >
                  {l.naam}
                </Chip>
              );
            })}
          </div>
        </div>

        {/* Vertrekpunt en straal */}
        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <Field
                label="Vertrekpunt"
                hint={`Nu: ${criteria.vertrekpunt.naam}`}
              >
                <div className="relative">
                  <input
                    value={plaatsZoek}
                    onChange={(e) => setPlaatsZoek(e.target.value)}
                    placeholder="andere plaats of postcode zoeken"
                    style={{ ...inputStijl, paddingRight: 30 }}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {zoekt ? <Spinner size={11} /> : <Search size={12} color={T.ink(0.3)} />}
                  </span>
                </div>
              </Field>

              {plaatsen.length > 0 && (
                <div style={{ border: `1px solid ${T.line2}` }}>
                  {plaatsen.map((p) => (
                    <button
                      key={`${p.naam}-${p.lat}-${p.lon}`}
                      type="button"
                      onClick={() => {
                        zet({ vertrekpunt: { naam: p.naam, lat: p.lat, lon: p.lon } });
                        setPlaatsZoek("");
                        setPlaatsen([]);
                      }}
                      className="w-full text-left px-3 py-2 transition-all hover:opacity-70"
                      style={{ ...body(12, T.navy), borderBottom: `1px solid ${T.line}` }}
                    >
                      {p.naam}
                    </button>
                  ))}
                </div>
              )}

              <Field label={`Actieradius — ${criteria.straalKm} km`}>
                <input
                  type="range"
                  min={10}
                  max={250}
                  step={5}
                  value={criteria.straalKm}
                  onChange={(e) => zet({ straalKm: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: T.navy }}
                />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {[25, 50, 75, 100, 150].map((km) => (
                  <Chip key={km} active={criteria.straalKm === km} onClick={() => zet({ straalKm: km })}>
                    {km} km
                  </Chip>
                ))}
              </div>
            </div>

            <StraalKaart
              punt={criteria.vertrekpunt}
              straalKm={criteria.straalKm}
              landen={criteria.landen}
            />
          </div>
        </div>
      </div>

      <PanelVoet>
        Deze grenzen gelden bij elke zoekopdracht. Merk en model laat je bewust vrij — het gaat erom
        dat het een particulier is die zijn auto verkoopt.
      </PanelVoet>
    </Panel>
  );
}
