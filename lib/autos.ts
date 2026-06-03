export type Auto = {
  id: number;
  slug: string;
  merk: string;
  model: string;
  versie: string;
  bouwjaar: number;
  bodytype: string;
  prijs: number;
  km: number;
  brandstof: string;
  transmissie: string;
  vermogen: string;
  kleur: string;
  // Extra kenmerken
  apk: string;
  btw: string;
  bekleding: string;
  kleurExterieur: string;
  // Foto's (URLs of /public paden)
  fotos?: string[];
  // Status
  verkocht?: boolean;
  gereserveerd?: boolean;
  verkocht_op?: string;
  toegevoegd_op?: string; // wanneer de auto in de voorraad kwam (voor standtijd-statistiek)
  // Optionele RDW-extra's (meegestuurd door het formulier)
  kenteken?: string;
  cilinderinhoud?: string;
  aantalDeuren?: string;
  aantalCilinders?: string;
  // Omschrijving
  omschrijving: string;
  // Opties per categorie
  opties: {
    categorie: string;
    items: string[];
  }[];
};

export const autos: Auto[] = [
  {
    id: 5,
    slug: "fiat-500-lounge",
    merk: "Fiat",
    model: "500 1.2 Lounge",
    versie: "69 pk | Panoramadak | Airco | Blue&Me | PDC achter",
    bouwjaar: 2013,
    bodytype: "Hatchback",
    prijs: 4950,
    km: 171193,
    brandstof: "Benzine",
    transmissie: "Handgeschakeld",
    vermogen: "69 pk",
    kleur: "Grijs",
    apk: "Onbekend",
    btw: "Marge",
    bekleding: "Stof",
    kleurExterieur: "Grigio Campovolo",
    fotos: [
      "/autos/Fiat%20(K-576-ZJ)/01.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/03.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/02.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/07.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/05.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/08.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/09.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/04.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/06.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/10.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/11.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/12.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/13.jpeg",
      "/autos/Fiat%20(K-576-ZJ)/14.jpeg",
    ],
    omschrijving:
      "Charmante en goed verzorgde Fiat 500 1.2 Lounge uit 2013, in 2021 naar Nederland geïmporteerd. De tijdloze Fiat 500 in de gewilde Lounge-uitvoering combineert Italiaans design met praktisch stadsgebruik. De betrouwbare 1.2 viercilinder (69 pk) is zuinig, makkelijk te rijden en eenvoudig in onderhoud.\n\nHét kenmerk van de Lounge is het vaste panoramadak dat de compacte cabine heerlijk licht en ruimtelijk maakt. Ideale auto voor de stad of als tweede auto. Marge voertuig — voor particulieren komt er geen BTW meer bij.",
    opties: [
      {
        categorie: "Exterieur",
        items: [
          "Vast panoramadak met zonnescherm (kenmerk Lounge)",
          "Grigio Campovolo lak",
          "Chroompakket (bumpers, raamomlijsting, uitlaatmond)",
          "15 inch lichtmetalen velgen",
          "Mistlampen voor",
        ],
      },
      {
        categorie: "Interieur",
        items: [
          "Multifunctioneel lederen stuurwiel",
          "Airconditioning",
          "Gestoelde bekleding met 500-logo",
          "Elektrische ramen voor",
        ],
      },
      {
        categorie: "Technologie",
        items: [
          "Blue&Me infotainment (Bluetooth, handsfree bellen)",
          "USB-aansluiting voor muziek",
          "Parkeersensoren achter (PDC)",
          "Boordcomputer",
        ],
      },
      {
        categorie: "Aandrijving",
        items: [
          "1.2 viercilinder benzinemotor — 69 pk",
          "5-traps handgeschakelde versnellingsbak",
          "Zuinig en betrouwbaar stadsblok",
          "Start/stop systeem",
        ],
      },
    ],
  },
  {
    id: 4,
    slug: "volkswagen-tiguan-r-line",
    merk: "Volkswagen",
    model: "Tiguan 1.5 TSI R-Line",
    versie: "150 pk | DSG Automaat | Panoramadak | Navi | ACC | ArtVelours",
    bouwjaar: 2019,
    bodytype: "SUV",
    prijs: 21950,
    km: 167000,
    brandstof: "Benzine",
    transmissie: "Automatisch",
    vermogen: "150 pk",
    kleur: "Grijs",
    apk: "06-2027",
    btw: "Marge",
    bekleding: "ArtVelours (Alcantara)",
    kleurExterieur: "Urano Grey metallic",
    fotos: [
      "/autos/Volkswagen%20(S-127-KF)/01.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/02.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/03.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/04.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/09.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/06.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/07.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/08.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/05.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/10.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/12.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/11.jpeg",
      "/autos/Volkswagen%20(S-127-KF)/13.jpeg",
    ],
    omschrijving:
      "Rijke en sportieve Volkswagen Tiguan 1.5 TSI R-Line uit 2019 in de zeldzame Urano Grey metallic lak. Met de R-Line uitvoering rijdt u in een auto die er scherp uitziet én uitstekend is uitgerust. De 150 pk sterke 1.5 TSI benzinemotor schakelt soepel via de 7-traps DSG automaat. Het interieur is voorzien van luxe ArtVelours sportkussens, een groot panoramadak en het Discover Media 9.2 inch navigatiesysteem.\n\nMet een originele nieuwprijs van € 46.529 is dit een auto die voor een fractie van de nieuwwaarde te rijden is. APK geldig tot juni 2027. Marge voertuig — voor particulieren komt er geen BTW meer bij.",
    opties: [
      {
        categorie: "Exterieur",
        items: [
          "R-Line exterieurpakket (sportieve bumpers, diffuser en sideblades)",
          "Urano Grey metallic lak",
          "19 inch lichtmetalen R-Line velgen",
          "LED-koplampen",
          "Panoramisch elektrisch schuif-/kanteldak",
          "Privacy glass achter",
        ],
      },
      {
        categorie: "Interieur",
        items: [
          "ArtVelours sportkussens (Alcantara) voor en achter",
          "Climatronic automatische airconditioning (3 zones)",
          "Active Info Display (volledig digitaal instrumentenpaneel)",
          "Elektrisch verstelbare bestuurdersstoel",
          "Stoelverwarming voor",
          "Lederen multifunctioneel stuurwiel",
        ],
      },
      {
        categorie: "Technologie",
        items: [
          "Discover Media navigatiesysteem 9.2 inch touchscreen",
          "Apple CarPlay & Android Auto",
          "Adaptive Cruise Control (ACC)",
          "Front Assist met noodremfunctie",
          "Lane Assist rijstrookbehoud",
          "Parkeersensoren voor en achter (PDC)",
          "Achteruitrijcamera",
        ],
      },
      {
        categorie: "Aandrijving",
        items: [
          "1.5 TSI benzinemotor — 150 pk (110 kW)",
          "7-traps DSG automaat",
          "Eco-rijmodus met cilindersluiting",
          "Start/stop systeem",
        ],
      },
    ],
  },
  {
    id: 3,
    slug: "volkswagen-polo-tdi",
    merk: "Volkswagen",
    model: "Polo 1.6 TDI",
    versie: "Comfortline Business | Navi | ACC | PDC | Lichtmetalen velgen",
    bouwjaar: 2018,
    bodytype: "Hatchback",
    prijs: 6950,
    km: 271000,
    brandstof: "Diesel",
    transmissie: "Handgeschakeld",
    vermogen: "95 pk",
    kleur: "Zwart",
    apk: "Onbekend",
    btw: "Marge",
    bekleding: "Stof",
    kleurExterieur: "Deep Black Pearl metallic",
    fotos: [
      "/autos/Volkswagen%20(TH-744-B)/01.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/02.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/03.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/09.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/08.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/06.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/07.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/05.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/04.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/10.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/11.jpeg",
      "/autos/Volkswagen%20(TH-744-B)/12.jpeg",
    ],
    omschrijving:
      "Nette Volkswagen Polo 1.6 TDI uit 2018 in de Comfortline Business uitvoering. Deze zuinige diesel is ideaal voor lange afstanden dankzij het lage verbruik en de rijke uitrusting. De auto is voorzien van het Discover Media navigatiesysteem met groot touchscreen, Apple CarPlay & Android Auto, en de gewilde Adaptive Cruise Control (ACC). De zwarte metallic lak (Deep Black Pearl) geeft de auto een stijlvolle uitstraling.\n\nOriginele nieuwprijs was € 22.500. Marge voertuig — voor particulieren komt er geen BTW meer bij.",
    opties: [
      {
        categorie: "Infotainment & Techniek",
        items: [
          "Discover Media navigatiesysteem (groot touchscreen)",
          "Apple CarPlay & Android Auto",
          "Adaptive Cruise Control (ACC)",
          "Front Assist (noodremassistent)",
          "Bluetooth telefoonvoorbereiding",
        ],
      },
      {
        categorie: "Comfort & Interieur",
        items: [
          "Airconditioning",
          "Multifunctioneel lederen stuurwiel",
          "Middenarmsteun voor",
          "Comfortstoelen met stoffen bekleding",
          "Elektrische ramen voor en achter",
        ],
      },
      {
        categorie: "Exterieur & Parkeren",
        items: [
          "Deep Black Pearl metallic lak",
          "15 inch lichtmetalen velgen",
          "LED-dagrijverlichting",
          "Parkeersensoren voor en achter (PDC)",
        ],
      },
      {
        categorie: "Aandrijving",
        items: [
          "1.6 TDI dieselmotor",
          "95 pk vermogen",
          "Handgeschakelde 5-traps versnellingsbak",
          "Zuinig dieselverbruik — ideaal voor lange afstanden",
        ],
      },
    ],
  },
  {
    id: 2,
    slug: "bmw-216i-active-tourer",
    merk: "BMW",
    model: "216i Active Tourer",
    versie: "1.5 | Navigatie | PDC | Leder stuurwiel",
    bouwjaar: 2017,
    bodytype: "MPV",
    prijs: 12450,
    km: 157478,
    brandstof: "Benzine",
    transmissie: "Handgeschakeld",
    vermogen: "102 pk",
    kleur: "Zwart",
    apk: "07-2026",
    btw: "Marge",
    bekleding: "Stof",
    kleurExterieur: "Sapphire Black metallic",
    fotos: [
      "/autos/BMW%20(T-731-VT)/01.jpeg",
      "/autos/BMW%20(T-731-VT)/02.jpeg",
      "/autos/BMW%20(T-731-VT)/03.jpeg",
      "/autos/BMW%20(T-731-VT)/04.jpeg",
      "/autos/BMW%20(T-731-VT)/05.jpeg",
      "/autos/BMW%20(T-731-VT)/06.jpeg",
      "/autos/BMW%20(T-731-VT)/07.jpeg",
      "/autos/BMW%20(T-731-VT)/08.jpeg",
      "/autos/BMW%20(T-731-VT)/09.jpeg",
      "/autos/BMW%20(T-731-VT)/10.jpeg",
      "/autos/BMW%20(T-731-VT)/11.jpeg",
      "/autos/BMW%20(T-731-VT)/12.jpeg",
      "/autos/BMW%20(T-731-VT)/13.jpeg",
      "/autos/BMW%20(T-731-VT)/14.jpeg",
    ],
    omschrijving:
      "Nette en goed onderhouden BMW 216i Active Tourer uit 2017. Deze compacte MPV combineert het rijplezier van BMW met een zeer praktisch en ruim interieur. De zuinige 1.5 liter 3-cilinder motor levert 102 pk en rijdt soepel en economisch. De hogere instap, flexibele achterbank en royale bagageruimte maken deze auto ideaal voor dagelijks gebruik en gezinnen.\n\nAPK geldig tot juli 2026. Marge voertuig — voor particulieren komt er geen BTW meer bij.",
    opties: [
      {
        categorie: "Exterieur",
        items: [
          "Sapphire Black metallic lak",
          "Lichtmetalen velgen 16/17 inch",
          "Automatisch inschakelende koplampen",
          "Regensensor",
        ],
      },
      {
        categorie: "Interieur",
        items: [
          "Multifunctioneel lederen stuurwiel",
          "Airconditioning",
          "Verschuifbare achterbank",
          "Flexibel interieurconcept (Active Tourer)",
        ],
      },
      {
        categorie: "Technologie",
        items: [
          "BMW Navigatiesysteem (Business)",
          "Bluetooth telefoonvoorbereiding",
          "Kleurenscherm dashboard",
          "Parkeersensoren achter (PDC)",
        ],
      },
      {
        categorie: "Aandrijving",
        items: [
          "1.5 liter 3-cilinder benzinemotor",
          "102 pk systeemvermogen",
          "Handgeschakelde versnellingsbak",
          "Zuinig brandstofverbruik",
        ],
      },
    ],
  },
  {
    id: 1,
    slug: "volkswagen-golf-gte",
    merk: "Volkswagen",
    model: "Golf GTE",
    versie: "1.4 TSI | Automaat | Panoramadak | Navi | ACC",
    bouwjaar: 2015,
    bodytype: "Hatchback",
    prijs: 11950,
    km: 183925,
    brandstof: "Hybride (Plug-in)",
    transmissie: "Automatisch",
    vermogen: "204 pk",
    kleur: "Wit",
    apk: "12-2026",
    btw: "Marge",
    bekleding: "Leder / Stof",
    kleurExterieur: "Wit",
    fotos: [
      "/autos/Volkswagen%20GTE%20(HD-508-X)/01.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/02.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/03.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/04.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/05.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/06.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/07.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/08.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/09.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/10.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/11.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/12.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/13.jpeg",
      "/autos/Volkswagen%20GTE%20(HD-508-X)/14.jpeg",
    ],
    omschrijving:
      "Zeer nette en rijk uitgeruste Volkswagen Golf 1.4 TSI GTE uit 2015. Deze auto combineert de sportieve prestaties van een GTI met een zeer gunstig brandstofverbruik dankzij de soepele plug-in hybride aandrijving (204 pk gecombineerd). De auto rijdt fantastisch, schakelt naadloos via de automatische DSG-transmissie en verkeert in keurige staat. Gezien de zeer hoge oorspronkelijke nieuwwaarde is dit een exemplaar dat bijzonder rijk is uitgerust in vergelijking met een standaard GTE.\n\nEen ideale auto voor wie op zoek is naar comfort, sportiviteit en dagelijkse efficiëntie in één betrouwbaar pakket. APK geldig tot december 2026. Marge voertuig — voor particulieren komt er geen BTW meer bij.",
    opties: [
      {
        categorie: "Exterieur",
        items: [
          "LED-koplampen en LED-achterlichten",
          "Panoramisch elektrisch schuif-/kanteldak",
          "Lichtmetalen sportvelgen 18 inch",
          "Parkeersensoren voor en achter",
          "Achteruitrijcamera",
          "Extra getint glas achter",
        ],
      },
      {
        categorie: "Interieur",
        items: [
          "GTE sportstoelen met leder/Vienna bekleding",
          "Stoelverwarming voor",
          "Lederen sportstuurwiel met schakelflippers",
          "Automatische airconditioning 2-zones (Climate Control)",
          "Elektrische ramen voor en achter",
          "Zwarte dakhemel",
        ],
      },
      {
        categorie: "Technologie",
        items: [
          "Discover Pro navigatie- en multimediasysteem",
          "Bluetooth telefoonvoorbereiding en audiostreaming",
          "Adaptive Cruise Control (ACC)",
          "Lane Assist (rijstrookbehoud)",
          "Laadkabels inbegrepen (thuis- en openbaar laden)",
        ],
      },
      {
        categorie: "Aandrijving",
        items: [
          "1.4 TSI plug-in hybride aandrijving",
          "150 pk brandstofmotor / 204 pk systeemvermogen",
          "7-traps automaat",
          "GTE rijmodus (sportief, volledig elektrisch, hybride)",
          "Elektrisch rijbereik ca. 50 km (NEDC)",
        ],
      },
    ],
  },
];
