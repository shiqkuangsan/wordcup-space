import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betSlipLegs, betSlips, matches } from "@/db/schema";
import { formatMatchTitle } from "@/domain/team-names";

export async function listBetSlips(filters: { matchId?: string } = {}) {
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
    if (!filters.matchId) return true;
    return (legsBySlip.get(slip.id) ?? []).some((leg) => leg.matchId === filters.matchId);
  });
}
