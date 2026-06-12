import { z } from "zod";
import {
  americanToDecimalOdds,
  roundDecimalOdds,
  syncedOddsBookmakerSchema,
  type SyncedOddsMarket,
} from "@/domain/odds-source-sync";

const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36";

const matchNumberSchema = z.number().int().positive();

const espnDraftKingsFixtureSchema = z.object({
  kind: z.literal("espn-draftkings"),
  matchNumber: matchNumberSchema,
  eventId: z.number().int().positive(),
});

const htmlAmericanFixtureSchema = z.object({
  kind: z.literal("html-american"),
  matchNumber: matchNumberSchema,
  bookmaker: syncedOddsBookmakerSchema,
  sourceLabel: z.string().min(1),
  sourceUrl: z.string().url(),
  selections: z.object({
    home: z.string().min(1),
    away: z.string().min(1),
    draw: z.string().min(1),
  }),
});

const htmlDecimalFixtureSchema = z.object({
  kind: z.literal("html-decimal"),
  matchNumber: matchNumberSchema,
  bookmaker: syncedOddsBookmakerSchema,
  sourceLabel: z.string().min(1),
  sourceUrl: z.string().url(),
  selections: z.object({
    home: z.string().min(1),
    away: z.string().min(1),
  }),
});

const fixtureSourceSchema = z.discriminatedUnion("kind", [
  espnDraftKingsFixtureSchema,
  htmlAmericanFixtureSchema,
  htmlDecimalFixtureSchema,
]);

export type OddsSourceFixture = z.infer<typeof fixtureSourceSchema>;

const betwayWorldCupMatchesUrl = "https://betway.com/g/en/sports/grp/soccer/world-cup-2026/matches";

const fallbackFixtures: OddsSourceFixture[] = [
  { kind: "espn-draftkings", matchNumber: 1, eventId: 760414 },
  { kind: "espn-draftkings", matchNumber: 2, eventId: 760415 },
  { kind: "espn-draftkings", matchNumber: 3, eventId: 760416 },
  { kind: "espn-draftkings", matchNumber: 4, eventId: 760417 },
  { kind: "espn-draftkings", matchNumber: 5, eventId: 760418 },
  { kind: "espn-draftkings", matchNumber: 7, eventId: 760419 },
  { kind: "espn-draftkings", matchNumber: 8, eventId: 760420 },
  { kind: "espn-draftkings", matchNumber: 6, eventId: 760421 },
  { kind: "espn-draftkings", matchNumber: 10, eventId: 760422 },
  { kind: "espn-draftkings", matchNumber: 9, eventId: 760423 },
  { kind: "espn-draftkings", matchNumber: 12, eventId: 760424 },
  { kind: "espn-draftkings", matchNumber: 11, eventId: 760425 },
  {
    kind: "html-american",
    matchNumber: 3,
    bookmaker: "bet365",
    sourceLabel: "bet365 News US",
    sourceUrl: "https://news.bet365.com/en-us/article/world-cup-canada-bosnia-herzegovina-prediction-best-bets-odds/2026061107101467993",
    selections: { home: "Canada", away: "Bosnia", draw: "Tie" },
  },
  {
    kind: "html-american",
    matchNumber: 4,
    bookmaker: "bet365",
    sourceLabel: "bet365 News US",
    sourceUrl: "https://news.bet365.com/en-us/article/world-cup-usa-paraguay-prediction-best-bets-odds/2026060914420141815",
    selections: { home: "USA", away: "Paraguay", draw: "Tie" },
  },
  {
    kind: "html-decimal",
    matchNumber: 3,
    bookmaker: "Betway",
    sourceLabel: "Betway World Cup matches",
    sourceUrl: betwayWorldCupMatchesUrl,
    selections: { home: "Canada", away: "Bosnia and Herzegovina" },
  },
  {
    kind: "html-decimal",
    matchNumber: 4,
    bookmaker: "Betway",
    sourceLabel: "Betway World Cup matches",
    sourceUrl: betwayWorldCupMatchesUrl,
    selections: { home: "USA", away: "Paraguay" },
  },
  {
    kind: "html-decimal",
    matchNumber: 8,
    bookmaker: "Betway",
    sourceLabel: "Betway World Cup matches",
    sourceUrl: betwayWorldCupMatchesUrl,
    selections: { home: "Qatar", away: "Switzerland" },
  },
  {
    kind: "html-decimal",
    matchNumber: 7,
    bookmaker: "Betway",
    sourceLabel: "Betway World Cup matches",
    sourceUrl: betwayWorldCupMatchesUrl,
    selections: { home: "Brazil", away: "Morocco" },
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
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
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

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAmericanOdds(text: string, label: string) {
  const escaped = escapePattern(label);
  const patterns = [
    new RegExp(`${escaped}\\s+([+-]\\d{2,4})`, "gi"),
    new RegExp(`${escaped}[^.]{0,120}?\\bat\\s+([+-]\\d{2,4})`, "gi"),
  ];
  const matches = patterns.flatMap((pattern) => Array.from(text.matchAll(pattern), (match) => match[1]));
  const match = matches.at(-1);
  if (!match) throw new Error(`missing American odds for ${label}`);
  return americanToDecimalOdds(Number(match));
}

function findDecimalMatchOdds(text: string, homeLabel: string, awayLabel: string) {
  const home = escapePattern(homeLabel);
  const away = escapePattern(awayLabel);
  const decimal = "(\\d{1,2}\\.\\d{2})";
  const patterns = [
    new RegExp(`${home}\\s+${away}\\s+${decimal}\\s+${decimal}\\s+${decimal}`, "i"),
    new RegExp(`${home}[\\s\\S]{0,180}?${away}[\\s\\S]{0,180}?${decimal}\\s+${decimal}\\s+${decimal}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        home: Number(match[1]),
        draw: Number(match[2]),
        away: Number(match[3]),
      };
    }
  }

  throw new Error(`missing decimal 1X2 odds for ${homeLabel} vs ${awayLabel}`);
}

function decimalFromEspnTeamOdds(value: unknown) {
  const odds = value as { current?: { moneyLine?: { decimal?: number } }; moneyLine?: number } | undefined;
  if (typeof odds?.current?.moneyLine?.decimal === "number") {
    return odds.current.moneyLine.decimal;
  }
  if (typeof odds?.moneyLine === "number") {
    return americanToDecimalOdds(odds.moneyLine);
  }
  throw new Error("missing ESPN team moneyline odds");
}

async function fetchEspnDraftKingsFixture(fixture: z.infer<typeof espnDraftKingsFixtureSchema>, capturedAt: string): Promise<SyncedOddsMarket> {
  const sourceUrl = `https://www.espn.com/soccer/odds/_/gameId/${fixture.eventId}`;
  const apiUrl = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/events/${fixture.eventId}/competitions/${fixture.eventId}/odds?lang=en&region=us`;
  const response = await fetch(apiUrl, { headers: { accept: "application/json", "user-agent": userAgent } });
  if (!response.ok) {
    throw new Error(`fetch ${apiUrl} failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    items?: Array<{
      provider?: { name?: string };
      homeTeamOdds?: unknown;
      awayTeamOdds?: unknown;
      drawOdds?: { moneyLine?: number };
    }>;
  };
  const item = payload.items?.find((candidate) => candidate.provider?.name === "DraftKings") ?? payload.items?.[0];
  if (!item) throw new Error(`missing ESPN odds item for ${fixture.eventId}`);
  if (item.provider?.name && item.provider.name !== "DraftKings") {
    throw new Error(`expected DraftKings odds, got ${item.provider.name}`);
  }
  if (typeof item.drawOdds?.moneyLine !== "number") {
    throw new Error("missing ESPN draw moneyline odds");
  }

  return {
    bookmaker: "DraftKings",
    market: "full_time:moneyline",
    capturedAt,
    sourceUrl,
    sourceLabel: "ESPN odds API",
    selections: [
      { selection: "主胜", decimalOdds: roundDecimalOdds(decimalFromEspnTeamOdds(item.homeTeamOdds)) },
      { selection: "和局", decimalOdds: roundDecimalOdds(americanToDecimalOdds(item.drawOdds.moneyLine)) },
      { selection: "客胜", decimalOdds: roundDecimalOdds(decimalFromEspnTeamOdds(item.awayTeamOdds)) },
    ],
  };
}

async function fetchHtmlAmericanFixture(fixture: z.infer<typeof htmlAmericanFixtureSchema>, capturedAt: string): Promise<SyncedOddsMarket> {
  const text = stripHtml(await fetchSourceText(fixture.sourceUrl));

  return {
    bookmaker: fixture.bookmaker,
    market: "full_time:moneyline",
    capturedAt,
    sourceUrl: fixture.sourceUrl,
    sourceLabel: fixture.sourceLabel,
    selections: [
      { selection: "主胜", decimalOdds: roundDecimalOdds(findAmericanOdds(text, fixture.selections.home)) },
      { selection: "和局", decimalOdds: roundDecimalOdds(findAmericanOdds(text, fixture.selections.draw)) },
      { selection: "客胜", decimalOdds: roundDecimalOdds(findAmericanOdds(text, fixture.selections.away)) },
    ],
  };
}

async function fetchHtmlDecimalFixture(fixture: z.infer<typeof htmlDecimalFixtureSchema>, capturedAt: string): Promise<SyncedOddsMarket> {
  const text = stripHtml(await fetchSourceText(fixture.sourceUrl));
  const odds = findDecimalMatchOdds(text, fixture.selections.home, fixture.selections.away);

  return {
    bookmaker: fixture.bookmaker,
    market: "full_time:moneyline",
    capturedAt,
    sourceUrl: fixture.sourceUrl,
    sourceLabel: fixture.sourceLabel,
    selections: [
      { selection: "主胜", decimalOdds: roundDecimalOdds(odds.home) },
      { selection: "和局", decimalOdds: roundDecimalOdds(odds.draw) },
      { selection: "客胜", decimalOdds: roundDecimalOdds(odds.away) },
    ],
  };
}

export async function fetchOddsSourceFixture(fixture: OddsSourceFixture, capturedAt = new Date().toISOString()): Promise<SyncedOddsMarket> {
  if (fixture.kind === "espn-draftkings") return fetchEspnDraftKingsFixture(fixture, capturedAt);
  if (fixture.kind === "html-american") return fetchHtmlAmericanFixture(fixture, capturedAt);
  return fetchHtmlDecimalFixture(fixture, capturedAt);
}

export function getOddsSourceBookmaker(fixture: OddsSourceFixture) {
  return fixture.kind === "espn-draftkings" ? "DraftKings" : fixture.bookmaker;
}
