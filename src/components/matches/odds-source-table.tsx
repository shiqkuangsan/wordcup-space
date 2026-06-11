import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocalMinute } from "@/domain/dates";
import { formatTeamName } from "@/domain/team-names";
import type { oddsSnapshots } from "@/db/schema";

type OddsSnapshot = typeof oddsSnapshots.$inferSelect;

const bookmakerRank: Record<string, number> = {
  Betway: 0,
  betway: 0,
  FanDuel: 1,
  bet365: 2,
};

function includesAny(value: string, candidates: string[]) {
  const normalized = value.toLowerCase();
  return candidates.some((candidate) => normalized.includes(candidate.toLowerCase()));
}

function findOutcome(group: OddsSnapshot[], outcome: "1" | "X" | "2", homeTeam: string, awayTeam: string) {
  const homeNames = [homeTeam, formatTeamName(homeTeam), "主胜", "主队", "home", "1"];
  const awayNames = [awayTeam, formatTeamName(awayTeam), "客胜", "客队", "away", "2"];
  const drawNames = ["和局", "平局", "平", "draw", "x"];

  return group.find((snapshot) => {
    if (outcome === "1") return includesAny(snapshot.selection, homeNames);
    if (outcome === "2") return includesAny(snapshot.selection, awayNames);
    return includesAny(snapshot.selection, drawNames);
  });
}

export function get1X2OddsCells(group: OddsSnapshot[], homeTeam: string, awayTeam: string) {
  const home = findOutcome(group, "1", homeTeam, awayTeam);
  const draw = findOutcome(group, "X", homeTeam, awayTeam);
  const away = findOutcome(group, "2", homeTeam, awayTeam);

  return {
    home: home?.decimalOdds.toFixed(2) ?? "--",
    draw: draw?.decimalOdds.toFixed(2) ?? "--",
    away: away?.decimalOdds.toFixed(2) ?? "--",
  };
}

export function format1X2OddsText(group: OddsSnapshot[], homeTeam: string, awayTeam: string) {
  const odds = get1X2OddsCells(group, homeTeam, awayTeam);

  return `1 ${odds.home} · X ${odds.draw} · 2 ${odds.away}`;
}

export function sortOddsGroups(groups: OddsSnapshot[][]) {
  return groups.slice().sort((a, b) => {
    const rankA = bookmakerRank[a[0]?.bookmaker ?? ""] ?? 99;
    const rankB = bookmakerRank[b[0]?.bookmaker ?? ""] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return (a[0]?.bookmaker ?? "").localeCompare(b[0]?.bookmaker ?? "");
  });
}

export function OddsSourceTable({
  groups,
  homeTeam,
  awayTeam,
}: {
  groups: OddsSnapshot[][];
  homeTeam: string;
  awayTeam: string;
}) {
  const sortedGroups = sortOddsGroups(groups);

  if (sortedGroups.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无来源盘口。</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>平台</TableHead>
          <TableHead>1 {formatTeamName(homeTeam)}</TableHead>
          <TableHead>X 和局</TableHead>
          <TableHead>2 {formatTeamName(awayTeam)}</TableHead>
          <TableHead>时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedGroups.map((group) => {
          const first = group[0];
          const home = findOutcome(group, "1", homeTeam, awayTeam);
          const draw = findOutcome(group, "X", homeTeam, awayTeam);
          const away = findOutcome(group, "2", homeTeam, awayTeam);

          return (
            <TableRow key={`${first.bookmaker}-${first.market}`}>
              <TableCell className="font-medium">{first.bookmaker}</TableCell>
              <TableCell className="font-mono tabular-nums">{home?.decimalOdds.toFixed(2) ?? "--"}</TableCell>
              <TableCell className="font-mono tabular-nums">{draw?.decimalOdds.toFixed(2) ?? "--"}</TableCell>
              <TableCell className="font-mono tabular-nums">{away?.decimalOdds.toFixed(2) ?? "--"}</TableCell>
              <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatLocalMinute(first.capturedAt)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function OddsSourceMiniMatrix({
  groups,
  homeTeam,
  awayTeam,
}: {
  groups: OddsSnapshot[][];
  homeTeam: string;
  awayTeam: string;
}) {
  const sortedGroups = sortOddsGroups(groups).slice(0, 3);

  if (sortedGroups.length === 0) return null;

  return (
    <div className="space-y-1 text-xs">
      {sortedGroups.map((group) => {
        const first = group[0];
        const odds = get1X2OddsCells(group, homeTeam, awayTeam);

        return (
          <div
            key={`${first.bookmaker}-${first.market}`}
            className="grid grid-cols-[74px_minmax(58px,1fr)_48px_minmax(58px,1fr)] items-center gap-2 rounded border bg-background px-2 py-1 text-muted-foreground sm:grid-cols-[84px_minmax(80px,1fr)_56px_minmax(80px,1fr)]"
          >
            <span className="truncate font-medium">{first.bookmaker}</span>
            <span className="font-mono tabular-nums">{odds.home}</span>
            <span className="text-center font-mono tabular-nums">{odds.draw}</span>
            <span className="text-right font-mono tabular-nums">{odds.away}</span>
          </div>
        );
      })}
    </div>
  );
}
