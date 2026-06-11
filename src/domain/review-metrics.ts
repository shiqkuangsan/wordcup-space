export type ReviewRecord = {
  decisionBy: string;
  status: string;
  stakeCents: number;
  finalOdds: number;
  profitLossCents?: number;
  oddsChangePct?: number | null;
};

export type ReviewSummary = {
  decisionBy: string;
  settledCount: number;
  wonCount: number;
  stakeCents: number;
  profitLossCents: number;
  roi: number | null;
  hitRate: number | null;
  averageOdds: number | null;
  openExposureCents: number;
  averageOddsChangePct: number | null;
};

const winningStatuses = new Set(["won", "half_won", "cashout"]);

export function summarizeReviewByDecision(records: ReviewRecord[]): ReviewSummary[] {
  const groups = new Map<string, ReviewRecord[]>();

  for (const record of records) {
    const existing = groups.get(record.decisionBy) ?? [];
    existing.push(record);
    groups.set(record.decisionBy, existing);
  }

  return Array.from(groups.entries())
    .map(([decisionBy, rows]) => {
      const settled = rows.filter((row) => row.status !== "open");
      const stakeCents = settled.reduce((sum, row) => sum + row.stakeCents, 0);
      const profitLossCents = settled.reduce((sum, row) => sum + (row.profitLossCents ?? 0), 0);
      const oddsChangeRows = rows.filter((row) => row.oddsChangePct !== null && row.oddsChangePct !== undefined);

      return {
        decisionBy,
        settledCount: settled.length,
        wonCount: settled.filter((row) => winningStatuses.has(row.status)).length,
        stakeCents,
        profitLossCents,
        roi: stakeCents > 0 ? profitLossCents / stakeCents : null,
        hitRate: settled.length > 0 ? settled.filter((row) => winningStatuses.has(row.status)).length / settled.length : null,
        averageOdds: settled.length > 0
          ? settled.reduce((sum, row) => sum + row.finalOdds, 0) / settled.length
          : null,
        openExposureCents: rows
          .filter((row) => row.status === "open")
          .reduce((sum, row) => sum + row.stakeCents, 0),
        averageOddsChangePct: oddsChangeRows.length > 0
          ? oddsChangeRows.reduce((sum, row) => sum + Number(row.oddsChangePct), 0) / oddsChangeRows.length
          : null,
      };
    })
    .sort((a, b) => a.decisionBy.localeCompare(b.decisionBy));
}
