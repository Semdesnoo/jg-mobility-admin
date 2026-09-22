export type VerkoopBoeking = {
  id: string;
  status: string;
  datum: string;
  vervaldatum: string;
  bruto: number;
  btwType: string;
  inkoop: number;
  inkoopBekend: boolean;
};

export type InkoopBoeking = {
  id: string;
  status: string;
  datum: string;
  vervaldatum: string;
  bedragIncl: number;
  btwBedrag: number;
  categorie: string;
};

export type ConsignatieBoeking = {
  id: string;
  status: string;
  vraagprijs: number;
  feePercentage: number;
  feeVast: number;
};

const rond = (waarde: number) => Math.round((waarde + Number.EPSILON) * 100) / 100;
const definitief = (status: string) => ["verzonden", "betaald"].includes(status.toLowerCase());

export function berekenBoekhouding({
  verkopen,
  inkopen,
  consignaties,
}: {
  verkopen: VerkoopBoeking[];
  inkopen: InkoopBoeking[];
  consignaties: ConsignatieBoeking[];
}) {
  const definitieveVerkopen = verkopen.filter((verkoop) => definitief(verkoop.status));

  let omzetInclBtw = 0;
  let omzetExclBtw = 0;
  let verschuldigdeBtw = 0;
  let kostprijsAutos = 0;
  let openVerkoop = 0;
  let betaaldVerkoop = 0;

  for (const verkoop of definitieveVerkopen) {
    const bruto = Number(verkoop.bruto) || 0;
    const inkoop = verkoop.inkoopBekend ? Number(verkoop.inkoop) || 0 : 0;
    const btw =
      verkoop.btwType === "21"
        ? rond((bruto * 21) / 121)
        : inkoop > 0
          ? rond((Math.max(bruto - inkoop, 0) * 21) / 121)
          : 0;

    omzetInclBtw += bruto;
    omzetExclBtw += bruto - btw;
    verschuldigdeBtw += btw;
    kostprijsAutos += inkoop;
    if (verkoop.status.toLowerCase() === "betaald") betaaldVerkoop += bruto;
    else openVerkoop += bruto;
  }

  let inkoopInclBtw = 0;
  let bedrijfskostenExclBtw = 0;
  let autoInkoopInclBtw = 0;
  let voorbelasting = 0;
  let openInkoop = 0;
  let betaaldInkoop = 0;

  for (const inkoop of inkopen) {
    const inclusief = Number(inkoop.bedragIncl) || 0;
    const btw = Math.max(Number(inkoop.btwBedrag) || 0, 0);
    const isAutoInkoop = inkoop.categorie.trim().toLowerCase() === "auto-inkoop";

    inkoopInclBtw += inclusief;
    voorbelasting += btw;
    if (isAutoInkoop) autoInkoopInclBtw += inclusief;
    else bedrijfskostenExclBtw += Math.max(inclusief - btw, 0);

    if (inkoop.status.toLowerCase() === "betaald") betaaldInkoop += inclusief;
    else openInkoop += inclusief;
  }

  const lopendeConsignaties = consignaties.filter((item) => item.status === "lopend");
  const vraagprijsInVerkoop = lopendeConsignaties.reduce((som, item) => som + (Number(item.vraagprijs) || 0), 0);
  const verwachteVergoeding = lopendeConsignaties.reduce((som, item) => {
    const vraagprijs = Number(item.vraagprijs) || 0;
    const vast = Number(item.feeVast) || 0;
    const percentage = Number(item.feePercentage) || 0;
    return som + vast + (vraagprijs * percentage) / 100;
  }, 0);

  const brutowinst = omzetExclBtw - kostprijsAutos;
  const nettowinst = brutowinst - bedrijfskostenExclBtw;

  return {
    resultaat: {
      omzetExclBtw: rond(omzetExclBtw),
      kostprijsAutos: rond(kostprijsAutos),
      brutowinst: rond(brutowinst),
      bedrijfskostenExclBtw: rond(bedrijfskostenExclBtw),
      nettowinst: rond(nettowinst),
    },
    verkoop: {
      definitiefAantal: definitieveVerkopen.length,
      conceptAantal: verkopen.length - definitieveVerkopen.length,
      omzetInclBtw: rond(omzetInclBtw),
      omzetExclBtw: rond(omzetExclBtw),
      openstaand: rond(openVerkoop),
      betaald: rond(betaaldVerkoop),
    },
    inkoop: {
      aantal: inkopen.length,
      totaalInclBtw: rond(inkoopInclBtw),
      bedrijfskostenExclBtw: rond(bedrijfskostenExclBtw),
      autoInkoopInclBtw: rond(autoInkoopInclBtw),
      openstaand: rond(openInkoop),
      betaald: rond(betaaldInkoop),
    },
    btw: {
      verschuldigd: rond(verschuldigdeBtw),
      voorbelasting: rond(voorbelasting),
      saldo: rond(verschuldigdeBtw - voorbelasting),
    },
    consignatie: {
      nieuw: consignaties.filter((item) => item.status === "nieuw").length,
      teContracteren: consignaties.filter((item) => item.status === "geaccepteerd").length,
      inVerkoop: lopendeConsignaties.length,
      vraagprijsInVerkoop: rond(vraagprijsInVerkoop),
      verwachteVergoeding: rond(verwachteVergoeding),
    },
  };
}
