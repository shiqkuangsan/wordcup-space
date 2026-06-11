import { z } from "zod";
import {
  americanToDecimalOdds,
  fractionalToDecimalOdds,
  roundDecimalOdds,
  type SyncedOddsMarket,
} from "@/domain/odds-source-sync";

const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

const fixtureSourceSchema = z.object({
  matchNumber: z.number().int().positive(),
  bookmaker: z.enum(["FanDuel", "bet365"]),
  sourceLabel: z.string().min(1),
  sourceUrl: z.string().url(),
  selections: z.object({
    home: z.string().min(1),
    away: z.string().min(1),
    draw: z.string().min(1),
  }),
});

export type OddsSourceFixture = z.infer<typeof fixtureSourceSchema>;

const fallbackFixtures: OddsSourceFixture[] = [
  {
    matchNumber: 1,
    bookmaker: "FanDuel",
    sourceLabel: "CBS Sports citing FanDuel",
    sourceUrl: "https://www.cbssports.com/soccer/news/mexico-south-africa-odds-prediction-time-2026-world-cup-picks-best-bets/",
    selections: { home: "Mexico", away: "South Africa", draw: "Draw" },
  },
  {
    matchNumber: 1,
    bookmaker: "bet365",
    sourceLabel: "Racing Post citing bet365",
    sourceUrl:
      "https://www.racingpost.com/sport/football-tips/world-cup-2026/mexico-vs-south-africa-world-cup-prediction-team-news-odds-betting-tips-and-bet-builder-alRa60K95Anc/",
    selections: { home: "Mexico", away: "South Africa", draw: "Draw" },
  },
  {
    matchNumber: 2,
    bookmaker: "FanDuel",
    sourceLabel: "SportsLine citing FanDuel",
    sourceUrl: "https://www.sportsline.com/insiders/south-korea-vs-czechia-odds-predictions-2026-world-cup-picks-from-elite-soccer-expert/",
    selections: { home: "Koreans", away: "Czechia", draw: "draw" },
  },
  {
    matchNumber: 2,
    bookmaker: "bet365",
    sourceLabel: "Racing Post citing bet365",
    sourceUrl:
      "https://www.racingpost.com/sport/football-tips/world-cup-2026/south-korea-czech-republic-world-cup-prediction-team-news-odds-betting-tips-and-bet-builder-aLfLg0I6etoI/",
    selections: { home: "South Korea", away: "Czech Republic", draw: "Draw" },
  },
];

export function getConfiguredOddsSources() {
  const custom = process.env.ODDS_SOURCE_FIXTURES_JSON;
  if (!custom) return fallbackFixtures;

  return z.array(fixtureSourceSchema).parse(JSON.parse(custom));
}

async function fetchSourceText(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`fetch ${url} failed: ${response.status}`);
  }

  return response.text();
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function findAmericanOdds(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escaped}\\s+(?:at\\s+)?([+-]\\d{2,4})`, "gi"),
    new RegExp(`${escaped}[^.]{0,80}?\\bat\\s+([+-]\\d{2,4})`, "gi"),
  ];
  const matches = patterns.flatMap((pattern) => Array.from(text.matchAll(pattern), (match) => match[1]));
  const match = matches.at(-1);
  if (!match) throw new Error(`missing American odds for ${label}`);
  return americanToDecimalOdds(Number(match));
}

function findFractionalOddsFromTable(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tableRow = html.match(new RegExp(`<tr[^>]*>[\\s\\S]*?<td[^>]*>\\s*${escaped}\\s*<\\/td>[\\s\\S]*?<td[^>]*>\\s*(\\d+[-/]\\d+)\\s*<\\/td>[\\s\\S]*?<\\/tr>`, "i"));
  if (tableRow) return fractionalToDecimalOdds(tableRow[1]);

  const text = stripHtml(html);
  const loose = text.match(new RegExp(`${escaped}\\s+(\\d+[-/]\\d+)`, "i"));
  if (!loose) throw new Error(`missing fractional odds for ${label}`);
  return fractionalToDecimalOdds(loose[1]);
}

export async function fetchOddsSourceFixture(fixture: OddsSourceFixture, capturedAt = new Date().toISOString()): Promise<SyncedOddsMarket> {
  const html = await fetchSourceText(fixture.sourceUrl);
  const text = stripHtml(html);
  const parseOdds = fixture.bookmaker === "FanDuel" ? findAmericanOdds : findFractionalOddsFromTable;

  return {
    bookmaker: fixture.bookmaker,
    market: "full_time:moneyline",
    capturedAt,
    sourceUrl: fixture.sourceUrl,
    sourceLabel: fixture.sourceLabel,
    selections: [
      { selection: "主胜", decimalOdds: roundDecimalOdds(parseOdds(fixture.bookmaker === "FanDuel" ? text : html, fixture.selections.home)) },
      { selection: "客胜", decimalOdds: roundDecimalOdds(parseOdds(fixture.bookmaker === "FanDuel" ? text : html, fixture.selections.away)) },
      { selection: "和局", decimalOdds: roundDecimalOdds(parseOdds(fixture.bookmaker === "FanDuel" ? text : html, fixture.selections.draw)) },
    ],
  };
}
