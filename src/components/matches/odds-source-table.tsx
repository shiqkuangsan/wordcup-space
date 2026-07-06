import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMarketLabel } from "@/domain/betting-markets";
import { formatLocalMinute } from "@/domain/dates";
import { formatTeamName } from "@/domain/team-names";
import type { oddsSnapshots } from "@/db/schema";

type OddsSnapshot = typeof oddsSnapshots.$inferSelect;

const bookmakerRank: Record<string, number> = {
  Betway: 0,
  betway: 0,
  "bw-shameng-saba": 0,
  bet365: 1,
  DraftKings: 2,
};

const marketRank: Record<string, number> = {
  "full_time:moneyline": 0,
  "full_time:handicap": 1,
  "full_time:total": 2,
  "full_time:double_chance": 3,
  "full_time:correct_score": 4,
  "full_time:total_goals_range": 5,
  "full_time:half_full": 6,
  "half_time:moneyline": 10,
  "half_time:handicap": 11,
  "half_time:total": 12,
  "half_time:correct_score": 13,
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

function formatBookmakerName(value: string) {
  if (value.toLowerCase() === "betway") return "Betway";
  if (value === "bw-shameng-saba") return "BW 沙盟";
  return value;
}

function groupByLine(group: OddsSnapshot[]) {
  const rows = new Map<string, OddsSnapshot[]>();

  for (const snapshot of group) {
    const key = snapshot.line ?? "default";
    rows.set(key, [...(rows.get(key) ?? []), snapshot]);
  }

  return Array.from(rows.entries()).sort(([lineA], [lineB]) => Number(lineA) - Number(lineB));
}

function sortSelections(a: OddsSnapshot, b: OddsSnapshot) {
  const rank = (value: OddsSnapshot) => {
    if (["主胜", "主队", "home", "1"].includes(value.selection.toLowerCase())) return 0;
    if (["和局", "平局", "平", "draw", "x"].includes(value.selection.toLowerCase())) return 1;
    if (["客胜", "客队", "away", "2"].includes(value.selection.toLowerCase())) return 2;
    if (value.selection === "大") return 0;
    if (value.selection === "小") return 1;
    return 10;
  };
  const rankDiff = rank(a) - rank(b);
  if (rankDiff !== 0) return rankDiff;
  return a.selection.localeCompare(b.selection);
}

type CorrectScoreSelection =
  | {
      type: "score";
      homeScore: number;
      awayScore: number;
    }
  | {
      type: "aos";
    }
  | {
      type: "unknown";
    };

function parseCorrectScoreSelection(selection: string): CorrectScoreSelection {
  if (selection.toLowerCase() === "aos") return { type: "aos" };
  const match = selection.match(/^(\d+)-(\d+)$/);
  if (!match) return { type: "unknown" };

  return {
    type: "score",
    homeScore: Number(match[1]),
    awayScore: Number(match[2]),
  };
}

function formatCorrectScoreLabel(selection: string) {
  return selection.toLowerCase() === "aos" ? "AOS 其他比分" : selection;
}

function compareCorrectScores(a: OddsSnapshot, b: OddsSnapshot) {
  const parsedA = parseCorrectScoreSelection(a.selection);
  const parsedB = parseCorrectScoreSelection(b.selection);

  if (parsedA.type === "aos") return 1;
  if (parsedB.type === "aos") return -1;
  if (parsedA.type !== "score" || parsedB.type !== "score") return a.selection.localeCompare(b.selection);

  if (parsedA.homeScore !== parsedB.homeScore) return parsedA.homeScore - parsedB.homeScore;
  return parsedA.awayScore - parsedB.awayScore;
}

function OddsBox({ snapshot, label }: { snapshot?: OddsSnapshot; label?: string }) {
  return (
    <div className="min-h-14 rounded-md border bg-background px-3 py-2 text-sm shadow-sm">
      <div className="truncate text-xs text-muted-foreground">{label ?? snapshot?.selection ?? "--"}</div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums">{snapshot ? snapshot.decimalOdds.toFixed(2) : "--"}</div>
    </div>
  );
}

function CorrectScoreBoard({ group, homeTeam, awayTeam }: { group: OddsSnapshot[]; homeTeam: string; awayTeam: string }) {
  const columns = {
    home: [] as OddsSnapshot[],
    draw: [] as OddsSnapshot[],
    away: [] as OddsSnapshot[],
  };

  for (const snapshot of group) {
    const parsed = parseCorrectScoreSelection(snapshot.selection);
    if (parsed.type === "aos") {
      columns.draw.push(snapshot);
      continue;
    }
    if (parsed.type !== "score") {
      columns.draw.push(snapshot);
      continue;
    }
    if (parsed.homeScore > parsed.awayScore) columns.home.push(snapshot);
    else if (parsed.homeScore < parsed.awayScore) columns.away.push(snapshot);
    else columns.draw.push(snapshot);
  }

  const correctScoreColumns = [
    { key: "home", title: `${formatTeamName(homeTeam)} 胜`, snapshots: columns.home },
    { key: "draw", title: "和局", snapshots: columns.draw },
    { key: "away", title: `${formatTeamName(awayTeam)} 胜`, snapshots: columns.away },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {correctScoreColumns.map((column) => (
        <div key={column.key} className="space-y-2">
          <div className="truncate text-center text-xs font-medium text-muted-foreground">{column.title}</div>
          {column.snapshots.slice().sort(compareCorrectScores).map((snapshot) => (
            <OddsBox key={snapshot.id} snapshot={snapshot} label={formatCorrectScoreLabel(snapshot.selection)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MarketGrid({ group, homeTeam, awayTeam }: { group: OddsSnapshot[]; homeTeam: string; awayTeam: string }) {
  const market = group[0]?.market ?? "";

  if (market.endsWith(":moneyline")) {
    const home = findOutcome(group, "1", homeTeam, awayTeam);
    const draw = findOutcome(group, "X", homeTeam, awayTeam);
    const away = findOutcome(group, "2", homeTeam, awayTeam);

    return (
      <div className="grid grid-cols-3 gap-2">
        <OddsBox snapshot={home} label={`1 ${formatTeamName(homeTeam)}`} />
        <OddsBox snapshot={draw} label="X 和局" />
        <OddsBox snapshot={away} label={`2 ${formatTeamName(awayTeam)}`} />
      </div>
    );
  }

  if (market.endsWith(":correct_score")) {
    return <CorrectScoreBoard group={group} homeTeam={homeTeam} awayTeam={awayTeam} />;
  }

  if (market.endsWith(":handicap") || market.endsWith(":total")) {
    return (
      <div className="space-y-2">
        {groupByLine(group).map(([line, snapshots]) => (
          <div key={line} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
            <div className="flex min-h-14 items-center justify-center rounded-md border bg-muted/30 px-2 font-mono text-sm tabular-nums">
              {line === "default" ? "-" : line}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {snapshots.sort(sortSelections).map((snapshot) => (
                <OddsBox key={snapshot.id} snapshot={snapshot} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {group.slice().sort(sortSelections).map((snapshot) => (
        <OddsBox
          key={snapshot.id}
          snapshot={snapshot}
          label={snapshot.line ? `${snapshot.selection} ${snapshot.line}` : snapshot.selection}
        />
      ))}
    </div>
  );
}

export function MatchOddsBoard({
  groups,
  homeTeam,
  awayTeam,
}: {
  groups: OddsSnapshot[][];
  homeTeam: string;
  awayTeam: string;
}) {
  const bookmakerGroups = new Map<string, OddsSnapshot[][]>();

  for (const group of groups) {
    const bookmaker = group[0]?.bookmaker;
    if (!bookmaker) continue;
    bookmakerGroups.set(bookmaker, [...(bookmakerGroups.get(bookmaker) ?? []), group]);
  }

  const sortedBookmakers = Array.from(bookmakerGroups.entries()).sort(([a], [b]) => {
    const rankA = bookmakerRank[a] ?? 99;
    const rankB = bookmakerRank[b] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });

  if (sortedBookmakers.length === 0) {
    return <div className="rounded-lg border bg-muted/20 p-6 text-sm text-muted-foreground">暂无盘口数据。</div>;
  }

  return (
    <div className="space-y-4">
      {sortedBookmakers.map(([bookmaker, bookmakerMarkets]) => {
        const sortedMarkets = bookmakerMarkets.slice().sort((a, b) => {
          const marketA = a[0]?.market ?? "";
          const marketB = b[0]?.market ?? "";
          const rankA = marketRank[marketA] ?? 99;
          const rankB = marketRank[marketB] ?? 99;
          if (rankA !== rankB) return rankA - rankB;
          return marketA.localeCompare(marketB);
        });
        const latestCapturedAt = sortedMarkets
          .map((group) => group[0]?.capturedAt)
          .filter(Boolean)
          .sort()
          .at(-1);

        return (
          <section key={bookmaker} className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/35 px-4 py-3">
              <div>
                <h3 className="font-semibold">{formatBookmakerName(bookmaker)}</h3>
                <p className="text-xs text-muted-foreground">
                  {sortedMarkets.length} 类盘口{latestCapturedAt ? ` · 更新 ${formatLocalMinute(latestCapturedAt)}` : ""}
                </p>
              </div>
              <div className="rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground">只读</div>
            </div>
            <div className="divide-y">
              {sortedMarkets.map((group) => {
                const first = group[0];
                return (
                  <div key={`${first.bookmaker}-${first.market}-${first.capturedAt}`} className="space-y-3 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{formatMarketLabel(first.market)}</div>
                      <div className="font-mono text-xs tabular-nums text-muted-foreground">{formatLocalMinute(first.capturedAt)}</div>
                    </div>
                    <MarketGrid group={group} homeTeam={homeTeam} awayTeam={awayTeam} />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
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
              <TableCell className="font-medium">{formatBookmakerName(first.bookmaker)}</TableCell>
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
            <span className="truncate font-medium">{formatBookmakerName(first.bookmaker)}</span>
            <span className="font-mono tabular-nums">{odds.home}</span>
            <span className="text-center font-mono tabular-nums">{odds.draw}</span>
            <span className="text-right font-mono tabular-nums">{odds.away}</span>
          </div>
        );
      })}
    </div>
  );
}
