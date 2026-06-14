import { and, gte, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { matches, oddsSnapshots } from "@/db/schema";
import { formatTeamName } from "@/domain/team-names";
import { createId } from "@/server/actions/ids";

type SabaSelection = {
  SelId: string;
  Price: number;
  Seq?: number;
  Info?: string;
};

type SabaMarket = {
  MatchId: number;
  Line?: number;
  Hdp1?: number;
  Hdp2?: number;
  Pty?: number;
  MarketId: number;
  BetTypeId: number;
  Resourceid?: string;
  Selections?: Record<string, SabaSelection>;
};

type SabaMatch = {
  MatchId: number;
  TeamId1: number;
  TeamId2: number;
  LeagueId: number;
  GameTime: string;
  IsMainMarket: boolean;
  Parentmatchid?: number;
  MarketCount?: number;
};

type SabaShowAllOddsData = {
  TeamN: Record<string, string>;
  LeagueN: Record<string, string>;
  NewMatch: SabaMatch[];
};

type SabaSession = {
  oddsApiBaseUrl: string;
  oddsToken: string;
};

export type SabaCaptureScope = "common" | "all";

export type SabaOddsRow = {
  matchId: string;
  bookmaker: string;
  market: string;
  selection: string;
  line?: string;
  decimalOdds: number;
  rawOdds: number;
  rawFormat: "decimal" | "hong_kong" | "malay";
  capturedAt: string;
  sourceNote: string;
};

export type SabaCaptureMatchSummary = {
  matchId: string;
  matchNumber: number | null;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  sabaMatchId?: number;
  sabaHomeTeam?: string;
  sabaAwayTeam?: string;
  homeAwayMismatch?: boolean;
  rows: SabaOddsRow[];
  skippedReason?: string;
};

export type SabaCaptureResult = {
  dryRun: boolean;
  write: boolean;
  bookmaker: string;
  capturedAt: string;
  scope: SabaCaptureScope;
  inserted: number;
  matches: SabaCaptureMatchSummary[];
};

const DEFAULT_SITE_API_BASE_URL = "https://m9q7mi.lczdldhn.com";
const DEFAULT_ODDS_API_BASE_URL = "https://m9q7oo.lczdldhn.com";
const DEFAULT_SERVER_GROUP = "klt1p.g112";
const DEFAULT_REQUEST_DELAY_MS = 250;

const COMMON_BET_TYPE_IDS = new Set([1, 3, 5, 6, 7, 8, 15, 16, 24, 405, 413]);

function decodeSabaName(value: string | undefined) {
  return (value ?? "").split("|")[0].trim();
}

function dateRangeUtc(localDate: string) {
  const start = new Date(`${localDate}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function normalizePair(homeTeam: string, awayTeam: string) {
  return `${formatTeamName(homeTeam)}::${formatTeamName(awayTeam)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status !== 429 || attempt >= 3) return response;
  await sleep(750 * (attempt + 1));
  return fetchWithRetry(url, init, attempt + 1);
}

async function postJson<T>(url: string, body: unknown, token?: string): Promise<T> {
  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "_mculture": "zh-CN",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`SABA request failed: ${response.status} ${url}`);
  return response.json() as Promise<T>;
}

async function postForm<T>(url: string, body: Record<string, string>, token: string): Promise<T> {
  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "_mculture": "zh-CN",
      authorization: `Bearer ${token}`,
    },
    body: new URLSearchParams(body),
  });
  if (!response.ok) throw new Error(`SABA request failed: ${response.status} ${url}`);
  return response.json() as Promise<T>;
}

export async function createSabaVisitorSession(input: {
  siteApiBaseUrl?: string;
  serverGroup?: string;
} = {}): Promise<SabaSession> {
  const siteApiBaseUrl = input.siteApiBaseUrl ?? DEFAULT_SITE_API_BASE_URL;
  const tokenResponse = await postJson<{ Success: boolean; Data?: { Token?: string } }>(
    `${siteApiBaseUrl}/api/ApiSiteLogin/ReGenerateToken`,
    {
      isBefore: true,
      isExtend: false,
      Token: "",
      Lang: "zh-CN",
      GalaxyUserServerGroup: input.serverGroup ?? DEFAULT_SERVER_GROUP,
    },
  );
  const visitorToken = tokenResponse.Data?.Token;
  if (!tokenResponse.Success || !visitorToken) throw new Error("SABA visitor token unavailable");

  const configResponse = await fetch(`${siteApiBaseUrl}/api/Config/GetBeforeOddsServerConfig`, {
    headers: {
      "_mculture": "zh-CN",
      authorization: `Bearer ${visitorToken}`,
    },
  });
  if (!configResponse.ok) throw new Error(`SABA config request failed: ${configResponse.status}`);
  const config = (await configResponse.json()) as {
    Success: boolean;
    Data?: {
      OddsServerUrl?: string;
      OddsServerToken?: string;
    };
  };
  const oddsToken = config.Data?.OddsServerToken;
  if (!config.Success || !oddsToken) throw new Error("SABA odds token unavailable");

  return {
    oddsApiBaseUrl: `https://${config.Data?.OddsServerUrl ?? DEFAULT_ODDS_API_BASE_URL.replace("https://", "")}`,
    oddsToken,
  };
}

async function fetchShowAllOdds(session: SabaSession) {
  const response = await postForm<{ ErrorCode: number; Data: SabaShowAllOddsData }>(
    `${session.oddsApiBaseUrl}/BFOdds/ShowAllOdds`,
    { GameId: "1", DateType: "t", BetTypeClass: "OU", GameType: "0" },
    session.oddsToken,
  );
  if (response.ErrorCode !== 0) throw new Error(`SABA ShowAllOdds error: ${response.ErrorCode}`);
  return response.Data;
}

async function fetchMatchMarkets(session: SabaSession, sabaMatchId: number) {
  const request = { GameId: 1, DateType: "t", BetTypeClass: "more", Matchid: sabaMatchId, GameType: 0 };
  const detail = await postJson<{ ErrorCode: number; Data?: { MoreMarkets?: { Markets?: { NewOdds?: SabaMarket[] } } } }>(
    `${session.oddsApiBaseUrl}/BFOdds/GetMatch`,
    request,
    session.oddsToken,
  );
  if (detail.ErrorCode !== 0) throw new Error(`SABA GetMatch error: ${detail.ErrorCode}`);

  const top = await postJson<{ ErrorCode: number; Data?: { NewOdds?: SabaMarket[] } }>(
    `${session.oddsApiBaseUrl}/BFOdds/GetMarket`,
    { ...request, BetTypeClass: "OU" },
    session.oddsToken,
  );
  if (top.ErrorCode !== 0) throw new Error(`SABA GetMarket error: ${top.ErrorCode}`);

  return dedupeMarkets([
    ...(top.Data?.NewOdds ?? []),
    ...(detail.Data?.MoreMarkets?.Markets?.NewOdds ?? []),
  ]);
}

function dedupeMarkets(markets: SabaMarket[]) {
  const map = new Map<string, SabaMarket>();
  for (const market of markets) {
    map.set(`${market.MarketId}:${market.BetTypeId}`, market);
  }
  return Array.from(map.values());
}

function inferOdds(rawOdds: number, market: SabaMarket) {
  if (rawOdds <= 0) {
    return { decimalOdds: Number((1 + 1 / Math.abs(rawOdds)).toFixed(4)), rawFormat: "malay" as const };
  }
  if (market.Pty === 0 && rawOdds < 1.5) {
    return { decimalOdds: Number((rawOdds + 1).toFixed(4)), rawFormat: "hong_kong" as const };
  }
  return { decimalOdds: Number(rawOdds.toFixed(4)), rawFormat: "decimal" as const };
}

function scoreSelection(value: string) {
  return value.replace(":", "-");
}

function twoDigitScoreSelection(value: string) {
  return /^\d\d$/.test(value) ? `${value[0]}-${value[1]}` : value;
}

function selectionLabel(input: {
  market: SabaMarket;
  selId: string;
  homeTeam: string;
  awayTeam: string;
}) {
  const { market, selId, homeTeam, awayTeam } = input;
  switch (market.BetTypeId) {
    case 1:
    case 7:
      return selId === "h" ? homeTeam : selId === "a" ? awayTeam : selId;
    case 3:
    case 8:
      return selId === "h" ? "大" : selId === "a" ? "小" : selId;
    case 5:
    case 15:
      return selId === "1" ? homeTeam : selId === "2" ? awayTeam : "和局";
    case 16:
      return twoDigitScoreSelection(selId);
    case 405:
    case 413:
      return scoreSelection(selId);
    case 24:
      return selId;
    default:
      if (/^\d+[:\-]\d+$/.test(selId)) return scoreSelection(selId);
      return selId;
  }
}

function marketKey(betTypeId: number, scope: SabaCaptureScope) {
  switch (betTypeId) {
    case 1:
      return "full_time:handicap";
    case 3:
      return "full_time:total";
    case 5:
      return "full_time:moneyline";
    case 6:
      return "full_time:total_goals_range";
    case 7:
      return "half_time:handicap";
    case 8:
      return "half_time:total";
    case 15:
      return "half_time:moneyline";
    case 16:
    case 405:
      return "half_time:correct_score";
    case 413:
      return "full_time:correct_score";
    case 24:
      return "full_time:double_chance";
    default:
      return scope === "all" ? `saba:${betTypeId}` : undefined;
  }
}

function marketLine(market: SabaMarket) {
  if (![1, 3, 7, 8].includes(market.BetTypeId)) return undefined;
  return market.Line && market.Line !== 0 ? String(market.Line) : undefined;
}

function normalizeMarketRows(input: {
  appMatchId: string;
  bookmaker: string;
  capturedAt: string;
  scope: SabaCaptureScope;
  homeTeam: string;
  awayTeam: string;
  sabaMatch: SabaMatch;
  markets: SabaMarket[];
}) {
  const rows: SabaOddsRow[] = [];
  for (const market of input.markets) {
    const normalizedMarket = marketKey(market.BetTypeId, input.scope);
    if (!normalizedMarket) continue;
    if (input.scope === "common" && !COMMON_BET_TYPE_IDS.has(market.BetTypeId)) continue;

    for (const [selId, selection] of Object.entries(market.Selections ?? {})) {
      if (!Number.isFinite(selection.Price) || selection.Price === 0) continue;
      const odds = inferOdds(selection.Price, market);
      rows.push({
        matchId: input.appMatchId,
        bookmaker: input.bookmaker,
        market: normalizedMarket,
        selection: selectionLabel({ market, selId, homeTeam: input.homeTeam, awayTeam: input.awayTeam }),
        line: marketLine(market),
        decimalOdds: odds.decimalOdds,
        rawOdds: selection.Price,
        rawFormat: odds.rawFormat,
        capturedAt: input.capturedAt,
        sourceNote: [
          `SABA API`,
          `sabaMatchId=${input.sabaMatch.MatchId}`,
          `parentMatchId=${input.sabaMatch.Parentmatchid ?? 0}`,
          `betTypeId=${market.BetTypeId}`,
          `marketId=${market.MarketId}`,
          `selId=${selId}`,
          `rawPrice=${selection.Price}`,
          `pty=${market.Pty ?? ""}`,
          `hdp1=${market.Hdp1 ?? ""}`,
          `hdp2=${market.Hdp2 ?? ""}`,
          `resource=${market.Resourceid ?? ""}`,
          `rawFormat=${odds.rawFormat}`,
        ].join("; "),
      });
    }
  }
  return rows;
}

function findSabaMainMatches(showAll: SabaShowAllOddsData) {
  const result = new Map<string, SabaMatch>();
  for (const match of showAll.NewMatch) {
    if (!match.IsMainMarket) continue;
    const homeTeam = decodeSabaName(showAll.TeamN[String(match.TeamId1)]);
    const awayTeam = decodeSabaName(showAll.TeamN[String(match.TeamId2)]);
    result.set(normalizePair(homeTeam, awayTeam), match);
  }
  return result;
}

function getSabaTeams(showAll: SabaShowAllOddsData, match: SabaMatch) {
  return {
    homeTeam: formatTeamName(decodeSabaName(showAll.TeamN[String(match.TeamId1)])),
    awayTeam: formatTeamName(decodeSabaName(showAll.TeamN[String(match.TeamId2)])),
  };
}

function findRelatedSabaMatches(showAll: SabaShowAllOddsData, mainMatch: SabaMatch) {
  return showAll.NewMatch.filter((match) => match.MatchId === mainMatch.MatchId || match.Parentmatchid === mainMatch.MatchId);
}

function getLocalMatchesForDate(localDate: string) {
  const db = getDb();
  const range = dateRangeUtc(localDate);
  return db
    .select()
    .from(matches)
    .where(and(gte(matches.kickoffAt, range.start), lt(matches.kickoffAt, range.end)))
    .all();
}

export async function captureSabaOdds(input: {
  localDate: string;
  scope?: SabaCaptureScope;
  bookmaker?: string;
  capturedAt?: string;
  write?: boolean;
  requestDelayMs?: number;
}): Promise<SabaCaptureResult> {
  const scope = input.scope ?? "common";
  const bookmaker = input.bookmaker ?? "bw-shameng-saba";
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const requestDelayMs = input.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;
  const localMatches = getLocalMatchesForDate(input.localDate);
  const session = await createSabaVisitorSession();
  const showAll = await fetchShowAllOdds(session);
  const sabaMainMatches = findSabaMainMatches(showAll);
  const summaries: SabaCaptureMatchSummary[] = [];

  for (const localMatch of localMatches) {
    const key = normalizePair(localMatch.homeTeam, localMatch.awayTeam);
    const reverseKey = normalizePair(localMatch.awayTeam, localMatch.homeTeam);
    const sabaMainMatch = sabaMainMatches.get(key) ?? sabaMainMatches.get(reverseKey);
    if (!sabaMainMatch) {
      summaries.push({
        matchId: localMatch.id,
        matchNumber: localMatch.matchNumber,
        homeTeam: localMatch.homeTeam,
        awayTeam: localMatch.awayTeam,
        kickoffAt: localMatch.kickoffAt,
        rows: [],
        skippedReason: "SABA match not found",
      });
      continue;
    }

    const sabaTeams = getSabaTeams(showAll, sabaMainMatch);
    const homeAwayMismatch = key !== normalizePair(sabaTeams.homeTeam, sabaTeams.awayTeam);
    const relatedSabaMatches = scope === "all" ? findRelatedSabaMatches(showAll, sabaMainMatch) : [sabaMainMatch];
    const rows: SabaOddsRow[] = [];
    try {
      for (const sabaMatch of relatedSabaMatches) {
        if (rows.length > 0) await sleep(requestDelayMs);
        const markets = await fetchMatchMarkets(session, sabaMatch.MatchId);
        rows.push(...normalizeMarketRows({
          appMatchId: localMatch.id,
          bookmaker,
          capturedAt,
          scope,
          homeTeam: sabaTeams.homeTeam,
          awayTeam: sabaTeams.awayTeam,
          sabaMatch,
          markets,
        }));
      }
    } catch (error) {
      summaries.push({
        matchId: localMatch.id,
        matchNumber: localMatch.matchNumber,
        homeTeam: localMatch.homeTeam,
        awayTeam: localMatch.awayTeam,
        kickoffAt: localMatch.kickoffAt,
        sabaMatchId: sabaMainMatch.MatchId,
        sabaHomeTeam: sabaTeams.homeTeam,
        sabaAwayTeam: sabaTeams.awayTeam,
        homeAwayMismatch,
        rows,
        skippedReason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const deduped = new Map<string, SabaOddsRow>();
    for (const row of rows) {
      deduped.set([row.market, row.selection, row.line ?? "", row.decimalOdds, row.sourceNote].join("|"), row);
    }
    summaries.push({
      matchId: localMatch.id,
      matchNumber: localMatch.matchNumber,
      homeTeam: localMatch.homeTeam,
      awayTeam: localMatch.awayTeam,
      kickoffAt: localMatch.kickoffAt,
      sabaMatchId: sabaMainMatch.MatchId,
      sabaHomeTeam: sabaTeams.homeTeam,
      sabaAwayTeam: sabaTeams.awayTeam,
      homeAwayMismatch,
      rows: Array.from(deduped.values()),
    });
  }

  let inserted = 0;
  if (input.write) {
    const values = summaries.flatMap((summary) =>
      summary.rows.map((row) => ({
        id: createId("odds"),
        matchId: row.matchId,
        bookmaker: row.bookmaker,
        market: row.market,
        selection: row.selection,
        line: row.line,
        decimalOdds: row.decimalOdds,
        capturedAt: row.capturedAt,
        createdBy: "codex" as const,
        sourceActor: "codex",
        sourceType: "saba_api",
        sourceNote: row.sourceNote,
      })),
    );
    if (values.length > 0) {
      getDb().insert(oddsSnapshots).values(values).run();
      inserted = values.length;
    }
  }

  return {
    dryRun: !input.write,
    write: Boolean(input.write),
    bookmaker,
    capturedAt,
    scope,
    inserted,
    matches: summaries,
  };
}
