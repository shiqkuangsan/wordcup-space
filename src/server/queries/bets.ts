import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betSlipLegs, betSlips, matches } from "@/db/schema";
import { matchesText } from "@/domain/list-filters";
import { formatMatchTitle } from "@/domain/team-names";

export type ListBetSlipFilters = {
  matchId?: string;
  status?: string;
  portfolioId?: string;
  decisionBy?: string;
  mode?: string;
  isRealMoney?: string;
  market?: string;
  q?: string;
};

export async function listBetSlips(filters: ListBetSlipFilters = {}) {
  const db = getDb();
  const slips = db.select().from(betSlips).orderBy(desc(betSlips.createdAt)).all();
  const legs = db.select().from(betSlipLegs).all();
  const allMatches = db.select().from(matches).all();
  const matchesById = new Map(allMatches.map((match) => [match.id, match]));
  const legsBySlip = new Map<string, typeof legs>();

  for (const leg of legs) {
    const existing = legsBySlip.get(leg.betSlipId) ?? [];
    existing.push(leg);
    legsBySlip.set(leg.betSlipId, existing);
  }

  return slips.map((slip) => {
    const slipLegs = (legsBySlip.get(slip.id) ?? []).sort((a, b) => a.legOrder - b.legOrder);
    const matchTitles = slipLegs.map((leg) => {
      if (!leg.matchId) return { title: leg.matchText ?? "未关联比赛" };
      const match = matchesById.get(leg.matchId);
      return {
        href: `/matches/${leg.matchId}`,
        title: match ? formatMatchTitle(match.homeTeam, match.awayTeam) : (leg.matchText ?? leg.matchId),
      };
    });
    const selectionSummary = slipLegs
      .map((leg) => `${leg.selection}${leg.line ? ` ${leg.line}` : ""}`)
      .join(" / ");

    return {
      ...slip,
      matchSummary: matchTitles.map((match) => match.title).join(" / ") || "未关联比赛",
      matchLinks: matchTitles,
      selectionSummary: selectionSummary || "未记录选择",
    };
  }).filter((slip) => {
    const slipLegs = legsBySlip.get(slip.id) ?? [];
    if (filters.matchId && !slipLegs.some((leg) => leg.matchId === filters.matchId)) return false;
    if (filters.status === "settled" && slip.status === "open") return false;
    if (filters.status && filters.status !== "settled" && slip.status !== filters.status) return false;
    if (filters.portfolioId && slip.portfolioId !== filters.portfolioId) return false;
    if (filters.decisionBy && slip.decisionBy !== filters.decisionBy) return false;
    if (filters.mode && slip.mode !== filters.mode) return false;
    if (filters.isRealMoney === "true" && !slip.isRealMoney) return false;
    if (filters.isRealMoney === "false" && slip.isRealMoney) return false;
    if (filters.market && !slipLegs.some((leg) => leg.market === filters.market)) return false;
    if (!matchesText(filters.q ?? "", [
      slip.id,
      slip.betIntentId,
      slip.confirmationRef,
      slip.matchSummary,
      slip.selectionSummary,
      slip.status,
      slip.portfolioId,
      slip.decisionBy,
      slip.mode,
      ...slipLegs.flatMap((leg) => {
        const match = leg.matchId ? matchesById.get(leg.matchId) : undefined;
        return [
          leg.market,
          leg.selection,
          leg.line,
          leg.notes,
          leg.matchId,
          leg.matchText,
          match?.homeTeam,
          match?.awayTeam,
          match ? formatMatchTitle(match.homeTeam, match.awayTeam) : undefined,
        ];
      }),
    ])) return false;
    return true;
  });
}
