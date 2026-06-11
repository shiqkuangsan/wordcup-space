import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betIntents, betSlipLegs, betSlips, executionAttempts, matches, oddsSnapshots, portfolioLedgerEntries, portfolios, settlements } from "@/db/schema";
import { localDateKey } from "@/domain/dates";
import { summarizeReviewByDecision } from "@/domain/review-metrics";
import { formatMatchTitle } from "@/domain/team-names";

export async function getDashboardSummary() {
  const db = getDb();
  const allMatches = db.select().from(matches).all();
  const allBetSlips = db.select().from(betSlips).all();
  const settlementRows = db.select().from(settlements).all();
  const attemptRows = db.select().from(executionAttempts).all();
  const slipLegRows = db.select().from(betSlipLegs).all();
  const oddsRows = db.select().from(oddsSnapshots).all();
  const pendingIntentRows = db
    .select()
    .from(betIntents)
    .where(eq(betIntents.status, "proposed"))
    .all();
  const settlementsBySlip = new Map(settlementRows.map((settlement) => [settlement.betSlipId, settlement]));
  const attemptsById = new Map(attemptRows.map((attempt) => [attempt.id, attempt]));
  const slipsById = new Map(allBetSlips.map((slip) => [slip.id, slip]));
  const matchesById = new Map(allMatches.map((match) => [match.id, match]));
  const oddsCountByMatch = new Map<string, number>();
  const marketBreakdown = new Map<string, {
    market: string;
    slipCount: number;
    openExposureCents: number;
    settledStakeCents: number;
    profitLossCents: number;
  }>();
  const todayKey = localDateKey(new Date());
  const upcomingMatches = allMatches
    .filter((match) => ["scheduled", "live"].includes(match.status))
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  const todayMatches = upcomingMatches.filter((match) => localDateKey(match.kickoffAt) === todayKey);
  const focusMatches = (todayMatches.length ? todayMatches : upcomingMatches).slice(0, 8);

  for (const odds of oddsRows) {
    oddsCountByMatch.set(odds.matchId, (oddsCountByMatch.get(odds.matchId) ?? 0) + 1);
  }

  for (const leg of slipLegRows) {
    const slip = slipsById.get(leg.betSlipId);
    if (!slip) continue;

    const existing = marketBreakdown.get(leg.market) ?? {
      market: leg.market,
      slipCount: 0,
      openExposureCents: 0,
      settledStakeCents: 0,
      profitLossCents: 0,
    };
    const settlement = settlementsBySlip.get(slip.id);

    existing.slipCount += 1;
    if (slip.status === "open") {
      existing.openExposureCents += slip.stakeCents;
    } else {
      existing.settledStakeCents += slip.stakeCents;
      existing.profitLossCents += settlement?.profitLossCents ?? 0;
    }
    marketBreakdown.set(leg.market, existing);
  }

  return {
    portfolios: db.select().from(portfolios).all(),
    openBetSlips: allBetSlips.filter((slip) => slip.status === "open"),
    pendingIntents: pendingIntentRows,
    recentLedgerEntries: db
      .select()
      .from(portfolioLedgerEntries)
      .orderBy(desc(portfolioLedgerEntries.createdAt))
      .limit(10)
      .all(),
    recentBetSlips: db.select().from(betSlips).orderBy(desc(betSlips.createdAt)).limit(10).all(),
    commandCenter: {
      dateKey: todayKey,
      focusLabel: todayMatches.length ? "今日比赛" : "下一批比赛",
      focusMatches: focusMatches.map((match) => ({
        id: match.id,
        href: `/matches/${match.id}`,
        title: formatMatchTitle(match.homeTeam, match.awayTeam),
        kickoffAt: match.kickoffAt,
        status: match.status,
        oddsCount: oddsCountByMatch.get(match.id) ?? 0,
      })),
      missingOdds: upcomingMatches
        .filter((match) => (oddsCountByMatch.get(match.id) ?? 0) === 0)
        .slice(0, 8)
        .map((match) => ({
          id: match.id,
          href: `/matches/${match.id}`,
          title: formatMatchTitle(match.homeTeam, match.awayTeam),
          kickoffAt: match.kickoffAt,
        })),
      pendingIntents: pendingIntentRows.slice(0, 8).map((intent) => ({
        id: intent.id,
        decisionBy: intent.decisionBy,
        stakeCents: intent.intendedStakeCents,
        odds: intent.intendedTotalOdds,
        status: intent.status,
      })),
      settlementQueue: slipLegRows
        .map((leg) => {
          const slip = slipsById.get(leg.betSlipId);
          const match = leg.matchId ? matchesById.get(leg.matchId) : undefined;
          if (!slip || slip.status !== "open" || match?.status !== "finished") return null;
          return {
            slipId: slip.id,
            href: `/bets?matchId=${encodeURIComponent(match.id)}`,
            matchTitle: formatMatchTitle(match.homeTeam, match.awayTeam),
            stakeCents: slip.stakeCents,
            finalOdds: slip.finalOdds,
          };
        })
        .filter((row) => row !== null)
        .slice(0, 8),
    },
    review: {
      byDecision: summarizeReviewByDecision(
        allBetSlips.map((slip) => ({
          decisionBy: slip.decisionBy,
          status: slip.status,
          stakeCents: slip.stakeCents,
          finalOdds: slip.finalOdds,
          profitLossCents: settlementsBySlip.get(slip.id)?.profitLossCents,
          oddsChangePct: attemptsById.get(slip.executionAttemptId)?.oddsChangePct,
        })),
      ),
      byMarket: Array.from(marketBreakdown.values()).sort(
        (a, b) =>
          b.openExposureCents + Math.abs(b.profitLossCents) -
          (a.openExposureCents + Math.abs(a.profitLossCents)),
      ),
    },
  };
}
