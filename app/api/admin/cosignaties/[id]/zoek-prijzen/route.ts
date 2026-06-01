import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import sql from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is niet ingesteld in .env.local" },
      { status: 500 }
    );
  }

  const rows = await sql`
    SELECT merk, model, bouwjaar, km FROM cosignaties WHERE id = ${id}
  `;
  if (rows.length === 0) return Response.json({ error: "Niet gevonden" }, { status: 404 });

  const { merk, model, bouwjaar, km } = rows[0];
  const kmTxt = km ? `, circa ${parseInt(km as string).toLocaleString("nl-NL")} kilometer` : "";

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Zoek op Marktplaats.nl, NederlandMobiel.nl en AutoScout24.nl de huidige vraagprijzen van een ${merk} ${model} bouwjaar ${bouwjaar}${kmTxt}.

Zoek per platform naar vergelijkbare exemplaren en bereken de gemiddelde vraagprijs.

Geef je antwoord UITSLUITEND als dit JSON object (absoluut geen andere tekst, geen uitleg, alleen JSON):
{"marktplaats": 27500, "nederlandmobiel": 26900, "autoscout24": 28000}

Gebruik gehele getallen zonder punt of komma als scheidingsteken. Als een platform geen vergelijkbare auto heeft, laat dat veld weg.`,
      },
    ],
  });

  // Find the last text block (Claude's final answer after searches)
  const textBlock = [...response.content].reverse().find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return Response.json({ error: "AI gaf geen tekstantwoord" }, { status: 500 });
  }

  // Extract JSON from response (Claude may wrap it in markdown)
  const raw = textBlock.text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    return Response.json({ error: "Geen prijzen gevonden in AI-antwoord", raw }, { status: 422 });
  }

  try {
    const platform_prijzen = JSON.parse(jsonMatch[0]);
    // Normalise: convert all values to string for consistency with existing schema
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(platform_prijzen)) {
      normalized[k] = String(Math.round(Number(v)));
    }

    // Save directly to DB
    await sql`
      UPDATE cosignaties
      SET platform_prijzen = ${JSON.stringify(normalized)}::jsonb
      WHERE id = ${id}
    `;

    return Response.json({ platform_prijzen: normalized });
  } catch {
    return Response.json({ error: "Ongeldige JSON van AI", raw }, { status: 422 });
  }
}
