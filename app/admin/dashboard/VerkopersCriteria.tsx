"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, Fuel, Euro, Globe, Check, Search } from "lucide-react";
import { T, micro, body, Panel, Btn, Chip, Field, inputStijl, Spinner, PanelVoet } from "./inkoop/ui";
import "leaflet/dist/leaflet.css";

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

/** Vast op Nederland — zie de toelichting in lib/verkopers-criteria.ts. */
const LANDEN = ["NL"];

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
 * Echte kaart met de actieradius eroverheen.
 *
 * De tegels komen van OpenStreetMap: gratis, geen sleutel nodig, en je ziet
 * gewoon steden, wegen en water zoals op Google Maps. Leaflet raakt `window` aan
 * en wordt daarom pas ingeladen zodra het scherm er staat.
 *
 * De cirkel is een echte geografische cirkel (straal in meters), dus wat je ziet
 * klopt op de kilometer: valt een plaats binnen de rand, dan valt hij er ook
 * echt in.
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
  const vak = useRef<HTMLDivElement>(null);
  // De kaart en de cirkel leven buiten React: opnieuw tekenen bij elke
  // schuifbeweging zou de kaart laten knipperen, dus we passen ze bij.
  const kaart = useRef<import("leaflet").Map | null>(null);
  const cirkel = useRef<import("leaflet").Circle | null>(null);
  const speld = useRef<import("leaflet").CircleMarker | null>(null);

  useEffect(() => {
    let levend = true;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!levend || !vak.current || kaart.current) return;

      const m = L.map(vak.current, {
        zoomControl: true,
        scrollWheelZoom: false, // anders scroll je per ongeluk de kaart in plaats van de pagina
        attributionControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap",
      }).addTo(m);

      cirkel.current = L.circle([punt.lat, punt.lon], {
        radius: straalKm * 1000,
        color: T.navy,
        weight: 2,
        fillColor: T.navy,
        fillOpacity: 0.08,
      }).addTo(m);

      speld.current = L.circleMarker([punt.lat, punt.lon], {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        fillColor: T.navy,
        fillOpacity: 1,
      }).addTo(m);

      m.fitBounds(cirkel.current.getBounds(), { padding: [12, 12] });
      kaart.current = m;
    })();

    return () => {
      levend = false;
      kaart.current?.remove();
      kaart.current = null;
      cirkel.current = null;
      speld.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- opzet is: één keer opbouwen, daarna bijstellen

  // Vertrekpunt of straal veranderd → cirkel en speld verplaatsen, kaart meebewegen.
  useEffect(() => {
    if (!kaart.current || !cirkel.current || !speld.current) return;
    cirkel.current.setLatLng([punt.lat, punt.lon]);
    cirkel.current.setRadius(straalKm * 1000);
    speld.current.setLatLng([punt.lat, punt.lon]);
    kaart.current.fitBounds(cirkel.current.getBounds(), { padding: [12, 12] });
  }, [punt.lat, punt.lon, straalKm]);

  const binnen = STEDEN.filter(
    (s) => landen.includes(s.land) && afstandKm(punt, s) <= straalKm
  );

  return (
    <div>
      <div
        ref={vak}
        style={{
          width: "100%",
          height: 260,
          backgroundColor: "#f6f7f9",
          border: `1px solid ${T.line2}`,
          zIndex: 0, // houdt de kaart onder de zwevende takenbalk
        }}
        role="img"
        aria-label={`Kaart met een actieradius van ${straalKm} kilometer rond ${punt.naam}`}
      />

      <p className="mt-2" style={body(11.5, T.ink(0.5))}>
        {binnen.length > 0 ? (
          <>
            Binnen bereik:{" "}
            <strong style={{ color: T.navy }}>
              {binnen
                .map((s) => s.naam)
                .slice(0, 8)
                .join(", ")}
              {binnen.length > 8 ? ` en ${binnen.length - 8} meer` : ""}
            </strong>
          </>
        ) : (
          "Geen van de referentiesteden valt binnen deze straal — kies een grotere afstand."
        )}
      </p>
    </div>
  );
}

export default function VerkopersCriteria({
  onFout,
  onGewijzigd,
}: {
  onFout: (s: string) => void;
  /** Meldt de geldende grenzen aan het zoekpaneel, zodat dat de samenvatting kan tonen. */
  onGewijzigd?: (c: Criteria) => void;
}) {
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [opgeslagen, setOpgeslagen] = useState<string>("");
  const [bezig, setBezig] = useState(false);

  // Zoeken naar een vertrekpunt
  const [plaatsZoek, setPlaatsZoek] = useState("");
  const [plaatsen, setPlaatsen] = useState<{ naam: string; lat: number; lon: number }[]>([]);
  const [zoekt, setZoekt] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Via een ref, zodat het ophalen bij het opstarten niet opnieuw draait als de
  // ouder een nieuwe functie doorgeeft.
  const onGewijzigdRef = useRef(onGewijzigd);
  onGewijzigdRef.current = onGewijzigd;

  useEffect(() => {
    fetch("/api/admin/verkopers/criteria")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.criteria) return;
        setCriteria(d.criteria);
        setOpgeslagen(JSON.stringify(d.criteria));
        onGewijzigdRef.current?.(d.criteria);
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
      onGewijzigdRef.current?.(d.criteria);
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

        {/* Land ligt vast; geen keuze om per ongeluk om te zetten. */}
        <div className="flex items-start gap-2" style={{ ...body(11.5, T.ink(0.5)), lineHeight: 1.6 }}>
          <Globe size={12} color={T.ink(0.35)} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Alleen <strong style={{ color: T.navy }}>Nederland</strong>. Advertenties uit België en
            Duitsland vallen af, ook als ze dichterbij liggen dan een Nederlandse.
          </span>
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

            <StraalKaart punt={criteria.vertrekpunt} straalKm={criteria.straalKm} landen={LANDEN} />
          </div>
        </div>
      </div>

      <PanelVoet>
        Dit ís de zoekopdracht — meer hoef je niet in te vullen. Merk en model blijven bewust vrij:
        alle merken doen mee, zolang het maar een particulier is die zijn auto verkoopt.
      </PanelVoet>
    </Panel>
  );
}
