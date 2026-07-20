export const dynamic = "force-dynamic";

// Anthropic Admin API — verbruik & kosten van Claude Code.
// Let op: er bestaat GEEN endpoint voor het resterende tegoed. Alleen wat er
// verbruikt is, is opvraagbaar; het saldo staat enkel in de Console.
//
// Vereist ANTHROPIC_ADMIN_KEY (een sk-ant-admin... sleutel uit de Console,
// Settings → Admin keys). Deze route draait server-side; de sleutel bereikt
// de browser nooit.

const API = "https://api.anthropic.com/v1/organizations";

// Vercel Hobby kapt functies af op 60s — geef onszelf ruime marge.
const TIMEOUT_MS = 20_000;

type CostResultaat = {
  amount: string;
  currency: string;
  model: string | null;
  cost_type: string | null;
  description: string | null;
};

type UsageResultaat = {
  uncached_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  cache_creation?: {
    ephemeral_1h_input_tokens?: number;
    ephemeral_5m_input_tokens?: number;
  };
};

type Bucket<T> = { starting_at: string; ending_at: string; results: T[] };

async function haal<T>(
  pad: string,
  params: URLSearchParams,
  sleutel: string
): Promise<Bucket<T>[]> {
  const res = await fetch(`${API}/${pad}?${params}`, {
    headers: {
      "x-api-key": sleutel,
      "anthropic-version": "2023-06-01",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const tekst = await res.text().catch(() => "");
    throw new Error(`${pad} gaf ${res.status}${tekst ? `: ${tekst.slice(0, 200)}` : ""}`);
  }
  const data = await res.json();
  return (data?.data ?? []) as Bucket<T>[];
}

export async function GET() {
  const sleutel = process.env.ANTHROPIC_ADMIN_KEY;
  if (!sleutel) {
    return Response.json(
      { error: "ANTHROPIC_ADMIN_KEY is niet ingesteld", ontbrekendeSleutel: true },
      { status: 200 } // 200 zodat de widget netjes uitlegt wat er mist
    );
  }

  // Vanaf de 1e van deze maand, in hele dagen.
  const nu = new Date();
  const startMaand = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1));
  const startISO = startMaand.toISOString();

  try {
    const [kostenBuckets, tokenBuckets] = await Promise.all([
      haal<CostResultaat>(
        "cost_report",
        new URLSearchParams({
          starting_at: startISO,
          bucket_width: "1d",
          limit: "31",
          "group_by[]": "description",
        }),
        sleutel
      ),
      haal<UsageResultaat>(
        "usage_report/messages",
        new URLSearchParams({
          starting_at: startISO,
          bucket_width: "1d",
          limit: "31",
        }),
        sleutel
      ),
    ]);

    // `amount` staat in de kleinste eenheid (centen) als decimale string:
    // "123.45" in USD = $1,23. Daarom delen door 100.
    const centenNaarDollar = (s: string) => (parseFloat(s) || 0) / 100;

    let totaalUSD = 0;
    const perDag: { datum: string; usd: number }[] = [];
    const perModel = new Map<string, number>();

    for (const bucket of kostenBuckets) {
      let dagTotaal = 0;
      for (const r of bucket.results) {
        const bedrag = centenNaarDollar(r.amount);
        dagTotaal += bedrag;
        totaalUSD += bedrag;
        // Niet-token kosten (web search, code execution) hebben geen model.
        const label = r.model ?? (r.cost_type ? `Overig — ${r.cost_type}` : "Overig");
        perModel.set(label, (perModel.get(label) ?? 0) + bedrag);
      }
      perDag.push({ datum: bucket.starting_at.slice(0, 10), usd: dagTotaal });
    }

    let invoerTokens = 0;
    let uitvoerTokens = 0;
    let cacheTokens = 0;
    for (const bucket of tokenBuckets) {
      for (const r of bucket.results) {
        invoerTokens += r.uncached_input_tokens ?? 0;
        uitvoerTokens += r.output_tokens ?? 0;
        cacheTokens +=
          (r.cache_read_input_tokens ?? 0) +
          (r.cache_creation?.ephemeral_1h_input_tokens ?? 0) +
          (r.cache_creation?.ephemeral_5m_input_tokens ?? 0);
      }
    }

    // Verwachte maandkosten op basis van het tempo tot nu toe.
    const dagVanMaand = nu.getUTCDate();
    const dagenInMaand = new Date(
      Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const prognoseUSD = dagVanMaand > 0 ? (totaalUSD / dagVanMaand) * dagenInMaand : 0;

    return Response.json({
      valuta: "USD",
      totaalUSD,
      prognoseUSD,
      perDag,
      perModel: [...perModel.entries()]
        .map(([model, usd]) => ({ model, usd }))
        .sort((a, b) => b.usd - a.usd),
      tokens: { invoer: invoerTokens, uitvoer: uitvoerTokens, cache: cacheTokens },
      periode: { van: startISO.slice(0, 10), tot: nu.toISOString().slice(0, 10) },
    });
  } catch (err) {
    const bericht = err instanceof Error ? err.message : String(err);
    return Response.json({ error: bericht }, { status: 200 });
  }
}
