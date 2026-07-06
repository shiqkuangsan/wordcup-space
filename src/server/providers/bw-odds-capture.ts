import { getDb } from "@/db/client";
import { oddsSnapshots } from "@/db/schema";
import { createId } from "@/server/actions/ids";

export type BwOddsCaptureInput = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  text: string;
  bookmaker?: string;
  capturedAt?: string;
};

export type BwOddsRow = {
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

export type BwOddsCaptureResult = {
  capturedAt: string;
  bookmaker: string;
  parsed: BwOddsRow[];
  skippedSections: string[];
};

type SectionKind =
  | "full_time:handicap"
  | "full_time:total"
  | "full_time:moneyline"
  | "full_time:correct_score"
  | "half_time:handicap"
  | "half_time:total"
  | "half_time:moneyline"
  | "half_time:correct_score"
  | "second_half:correct_score"
  | "full_time:half_full"
  | "full_time:total_goals"
  | "full_time:odd_even"
  | "full_time:btts_three_way"
  | "full_time:double_chance"
  | "full_time:clean_sheet"
  | "full_time:clean_sheet_winner"
  | "full_time:come_from_behind"
  | "full_time:winning_margin"
  | "full_time:first_last_goal";

const SECTION_PATTERNS: Array<[RegExp, SectionKind]> = [
  [/^全场让球$/, "full_time:handicap"],
  [/^全场大\/小$|^全场大小$/, "full_time:total"],
  [/^(全场独赢|独赢|1X2|全场胜平负)$/, "full_time:moneyline"],
  [/^(波胆|全场波胆)$/, "full_time:correct_score"],
  [/^上半场让球$/, "half_time:handicap"],
  [/^上半场大\/小$|^上半场大小$/, "half_time:total"],
  [/^(上半场独赢|上半场1X2|上半场胜平负)$/, "half_time:moneyline"],
  [/^上半场波胆$/, "half_time:correct_score"],
  [/^下半场波胆$/, "second_half:correct_score"],
  [/^半场 \/ 全场$|^半场\/全场$/, "full_time:half_full"],
  [/^总进球$/, "full_time:total_goals"],
  [/^全场单\/双$/, "full_time:odd_even"],
  [/^双方\/一方\/两者皆不得分$/, "full_time:btts_three_way"],
  [/^双重机会$/, "full_time:double_chance"],
  [/^零失球$/, "full_time:clean_sheet"],
  [/^零失球的胜方$/, "full_time:clean_sheet_winner"],
  [/^落后反超获胜的球队$/, "full_time:come_from_behind"],
  [/^淨胜比分$|^净胜比分$/, "full_time:winning_margin"],
  [/^最先进球\/最后进球$/, "full_time:first_last_goal"],
];

const UNKNOWN_SECTION_HINTS = [
  "特别投注",
  "角球",
  "时段",
  "比分让球盘",
  "比分大小盘",
  "半场/全场准确总进球",
  "上半场/全场波胆",
  "单/双",
  "半场/全场",
  "球队进球",
  "先进球",
  "净胜球",
];

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function findSectionKind(line: string): SectionKind | undefined {
  return SECTION_PATTERNS.find(([pattern]) => pattern.test(line))?.[1];
}

function isKnownOrUnknownSection(line: string) {
  return Boolean(findSectionKind(line)) || UNKNOWN_SECTION_HINTS.some((hint) => line.includes(hint));
}

function numbersFromLine(line: string) {
  return Array.from(line.matchAll(/[+-]?\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?/g)).map((match) => match[0]);
}

function isNumberLikeToken(value: string) {
  return /^[+-]?\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?$/.test(value);
}

function isOddsToken(value: string) {
  return /^@?[+-]?\d+(?:\.\d+)?$/.test(value);
}

function isScoreToken(value: string) {
  return /^\d+\s*-\s*\d+$/.test(value);
}

function normalizeLineValue(value: string) {
  return value.replace(/\s/g, "");
}

function parseNumber(value: string) {
  return Number(value.replace("@", "").replace("+", ""));
}

function tokenLines(lines: string[]) {
  return lines.flatMap((line) => line.split(/\s+/).map((token) => token.trim()).filter(Boolean));
}

function numberLikeTokens(lines: string[]) {
  return tokenLines(lines).filter(isNumberLikeToken);
}

function oddsLabelLines(lines: string[]) {
  return lines
    .map((line) => line.replace(/^@/, "").trim())
    .filter((line) => line && !isKnownOrUnknownSection(line));
}

function toDecimalOdds(rawOdds: number, market: string) {
  if (rawOdds <= 0) {
    return { decimalOdds: Number((1 + 1 / Math.abs(rawOdds)).toFixed(4)), rawFormat: "malay" as const };
  }
  if ((market.includes("handicap") || market.includes("total")) && rawOdds < 1.5) {
    return { decimalOdds: Number((rawOdds + 1).toFixed(4)), rawFormat: "hong_kong" as const };
  }
  return { decimalOdds: Number(rawOdds.toFixed(4)), rawFormat: "decimal" as const };
}

function makeRow(input: {
  matchId: string;
  bookmaker: string;
  capturedAt: string;
  market: string;
  selection: string;
  line?: string;
  rawOdds: number;
  rawText: string;
}) {
  const odds = toDecimalOdds(input.rawOdds, input.market);
  return {
    matchId: input.matchId,
    bookmaker: input.bookmaker,
    market: input.market,
    selection: input.selection,
    line: input.line,
    rawOdds: input.rawOdds,
    rawFormat: odds.rawFormat,
    decimalOdds: odds.decimalOdds,
    capturedAt: input.capturedAt,
    sourceNote: `BW raw: ${input.rawText}; rawOdds=${input.rawOdds}; inferredFormat=${odds.rawFormat}`,
  };
}

function parseAsianPairSection(input: {
  lines: string[];
  matchId: string;
  bookmaker: string;
  capturedAt: string;
  market: SectionKind;
  homeTeam: string;
  awayTeam: string;
}) {
  const rows: BwOddsRow[] = [];
  const isTotal = input.market.includes("total");
  for (const line of input.lines) {
    if (isKnownOrUnknownSection(line)) break;
    const values = numbersFromLine(line);
    if (values.length < 4) continue;
    const leftLine = normalizeLineValue(values[0]);
    const leftOdds = parseNumber(values[1]);
    const rightLine = normalizeLineValue(values[2]);
    const rightOdds = parseNumber(values[3]);
    if (!Number.isFinite(leftOdds) || !Number.isFinite(rightOdds)) continue;

    if (isTotal) {
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: "大",
        line: leftLine,
        rawOdds: leftOdds,
        rawText: line,
      }));
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: "小",
        line: rightLine,
        rawOdds: rightOdds,
        rawText: line,
      }));
      continue;
    }

    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: input.homeTeam,
      line: leftLine,
      rawOdds: leftOdds,
      rawText: line,
    }));
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: input.awayTeam,
      line: rightLine,
      rawOdds: rightOdds,
      rawText: line,
    }));
  }
  if (rows.length > 0) return rows;

  const values = numberLikeTokens(input.lines);
  const chunkSize = isTotal ? 3 : 4;
  for (let index = 0; index + chunkSize - 1 < values.length; index += chunkSize) {
    if (isTotal) {
      const [line, overRaw, underRaw] = values.slice(index, index + chunkSize);
      const overOdds = parseNumber(overRaw);
      const underOdds = parseNumber(underRaw);
      if (!Number.isFinite(overOdds) || !Number.isFinite(underOdds)) continue;
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: "大",
        line: normalizeLineValue(line),
        rawOdds: overOdds,
        rawText: values.slice(index, index + chunkSize).join(" "),
      }));
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: "小",
        line: normalizeLineValue(line),
        rawOdds: underOdds,
        rawText: values.slice(index, index + chunkSize).join(" "),
      }));
      continue;
    }

    const [leftLine, leftRaw, rightLine, rightRaw] = values.slice(index, index + chunkSize);
    const leftOdds = parseNumber(leftRaw);
    const rightOdds = parseNumber(rightRaw);
    if (!Number.isFinite(leftOdds) || !Number.isFinite(rightOdds)) continue;
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: input.homeTeam,
      line: normalizeLineValue(leftLine),
      rawOdds: leftOdds,
      rawText: values.slice(index, index + chunkSize).join(" "),
    }));
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: input.awayTeam,
      line: normalizeLineValue(rightLine),
      rawOdds: rightOdds,
      rawText: values.slice(index, index + chunkSize).join(" "),
    }));
  }
  return rows;
}

function parseMoneylineSection(input: {
  lines: string[];
  matchId: string;
  bookmaker: string;
  capturedAt: string;
  market: SectionKind;
  homeTeam: string;
  awayTeam: string;
}) {
  const rows: BwOddsRow[] = [];
  for (const line of input.lines) {
    if (isKnownOrUnknownSection(line)) break;
    const values = numbersFromLine(line).map(parseNumber).filter(Number.isFinite);
    if (values.length < 3) continue;
    const [homeOdds, drawOdds, awayOdds] = values.slice(-3);
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: input.homeTeam,
      rawOdds: homeOdds,
      rawText: line,
    }));
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: "和局",
      rawOdds: drawOdds,
      rawText: line,
    }));
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: input.awayTeam,
      rawOdds: awayOdds,
      rawText: line,
    }));
    break;
  }
  if (rows.length > 0) return rows;

  const values = oddsLabelLines(input.lines).filter(isOddsToken).map(parseNumber).filter(Number.isFinite);
  if (values.length >= 3) {
    const [homeOdds, drawOdds, awayOdds] = values.slice(0, 3);
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: input.homeTeam,
      rawOdds: homeOdds,
      rawText: input.lines.join(" | "),
    }));
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: "和局",
      rawOdds: drawOdds,
      rawText: input.lines.join(" | "),
    }));
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection: input.awayTeam,
      rawOdds: awayOdds,
      rawText: input.lines.join(" | "),
    }));
  }
  return rows;
}

function parseCorrectScoreSection(input: {
  lines: string[];
  matchId: string;
  bookmaker: string;
  capturedAt: string;
  market: SectionKind;
}) {
  const rows: BwOddsRow[] = [];
  for (const line of input.lines) {
    if (isKnownOrUnknownSection(line)) break;
    const pairs = Array.from(line.matchAll(/(\d+\s*-\s*\d+)\s+([+-]?\d+(?:\.\d+)?)/g));
    for (const pair of pairs) {
      const selection = pair[1].replace(/\s/g, "");
      const rawOdds = Number(pair[2]);
      if (!isScoreToken(selection) || !Number.isFinite(rawOdds)) continue;
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection,
        rawOdds,
        rawText: line,
      }));
    }
  }
  if (rows.length > 0) return rows;

  const values = tokenLines(input.lines);
  for (let index = 0; index + 1 < values.length; index += 1) {
    const selection = values[index].replace(/\s/g, "");
    const rawOdds = parseNumber(values[index + 1]);
    if (!isScoreToken(selection) || !Number.isFinite(rawOdds)) continue;
    rows.push(makeRow({
      matchId: input.matchId,
      bookmaker: input.bookmaker,
      capturedAt: input.capturedAt,
      market: input.market,
      selection,
      rawOdds,
      rawText: `${values[index]} ${values[index + 1]}`,
    }));
    index += 1;
  }
  return rows;
}

function parseQueuedLabelOddsSection(input: {
  lines: string[];
  matchId: string;
  bookmaker: string;
  capturedAt: string;
  market: SectionKind;
  skipLabels?: string[];
}) {
  const rows: BwOddsRow[] = [];
  const labels: string[] = [];
  const skipLabels = new Set(input.skipLabels ?? []);
  for (const line of oddsLabelLines(input.lines)) {
    if (isOddsToken(line)) {
      const rawOdds = parseNumber(line);
      const selection = labels.shift();
      if (selection && Number.isFinite(rawOdds)) {
        rows.push(makeRow({
          matchId: input.matchId,
          bookmaker: input.bookmaker,
          capturedAt: input.capturedAt,
          market: input.market,
          selection,
          rawOdds,
          rawText: `${selection} ${line}`,
        }));
      }
      continue;
    }
    if (!skipLabels.has(line) && !isNumberLikeToken(line)) labels.push(line);
  }
  return rows;
}

function parseFirstLastGoalSection(input: {
  lines: string[];
  matchId: string;
  bookmaker: string;
  capturedAt: string;
  market: SectionKind;
  homeTeam: string;
  awayTeam: string;
}) {
  const rows: BwOddsRow[] = [];
  const lines = oddsLabelLines(input.lines);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line !== "先进球" && line !== "后进球") continue;
    const homeOdds = parseNumber(lines[index + 1] ?? "");
    const awayOdds = parseNumber(lines[index + 2] ?? "");
    if (Number.isFinite(homeOdds)) {
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: `${input.homeTeam}:${line}`,
        rawOdds: homeOdds,
        rawText: `${line} ${input.homeTeam} ${lines[index + 1]}`,
      }));
    }
    if (Number.isFinite(awayOdds)) {
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: `${input.awayTeam}:${line}`,
        rawOdds: awayOdds,
        rawText: `${line} ${input.awayTeam} ${lines[index + 2]}`,
      }));
    }
  }
  const noGoalIndex = lines.indexOf("无进球");
  if (noGoalIndex >= 0) {
    const noGoalOdds = parseNumber(lines[noGoalIndex + 1] ?? "");
    if (Number.isFinite(noGoalOdds)) {
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: "无进球",
        rawOdds: noGoalOdds,
        rawText: `无进球 ${lines[noGoalIndex + 1]}`,
      }));
    }
  }
  return rows;
}

function parseWinningMarginSection(input: {
  lines: string[];
  matchId: string;
  bookmaker: string;
  capturedAt: string;
  market: SectionKind;
  homeTeam: string;
  awayTeam: string;
}) {
  const rows: BwOddsRow[] = [];
  const lines = oddsLabelLines(input.lines);
  for (let index = 0; index < lines.length; index += 1) {
    const label = lines[index];
    if (!/^(?:1个入球|2个入球|3\+)$/.test(label)) continue;
    const homeOdds = parseNumber(lines[index + 1] ?? "");
    const awayOdds = parseNumber(lines[index + 2] ?? "");
    if (Number.isFinite(homeOdds)) {
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: `${input.homeTeam}:${label}`,
        rawOdds: homeOdds,
        rawText: `${label} ${input.homeTeam} ${lines[index + 1]}`,
      }));
    }
    if (Number.isFinite(awayOdds)) {
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: `${input.awayTeam}:${label}`,
        rawOdds: awayOdds,
        rawText: `${label} ${input.awayTeam} ${lines[index + 2]}`,
      }));
    }
  }
  const drawIndex = lines.findIndex((line) => line.includes("任何比数的平局"));
  if (drawIndex >= 0) {
    const drawOdds = parseNumber(lines[drawIndex + 1] ?? "");
    if (Number.isFinite(drawOdds)) {
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: "任何比数的平局(不包含0-0)",
        rawOdds: drawOdds,
        rawText: `${lines[drawIndex]} ${lines[drawIndex + 1]}`,
      }));
    }
  }
  const noGoalIndex = lines.indexOf("无进球");
  if (noGoalIndex >= 0) {
    const noGoalOdds = parseNumber(lines[noGoalIndex + 1] ?? "");
    if (Number.isFinite(noGoalOdds)) {
      rows.push(makeRow({
        matchId: input.matchId,
        bookmaker: input.bookmaker,
        capturedAt: input.capturedAt,
        market: input.market,
        selection: "无进球",
        rawOdds: noGoalOdds,
        rawText: `无进球 ${lines[noGoalIndex + 1]}`,
      }));
    }
  }
  return rows;
}

function nextSectionLines(lines: string[], start: number) {
  const sectionLines: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isKnownOrUnknownSection(line)) break;
    sectionLines.push(line);
  }
  return sectionLines;
}

export function parseBwOddsText(input: BwOddsCaptureInput): BwOddsCaptureResult {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const bookmaker = input.bookmaker ?? "bw-shameng";
  const lines = normalizeText(input.text);
  const parsed: BwOddsRow[] = [];
  const skippedSections = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const kind = findSectionKind(line);
    if (!kind) {
      if (UNKNOWN_SECTION_HINTS.some((hint) => line.includes(hint))) skippedSections.add(line);
      continue;
    }
    const sectionLines = nextSectionLines(lines, index);
    if (kind.includes("handicap") || kind.includes("total")) {
      parsed.push(...parseAsianPairSection({ ...input, bookmaker, capturedAt, market: kind, lines: sectionLines }));
    } else if (kind.includes("moneyline")) {
      parsed.push(...parseMoneylineSection({ ...input, bookmaker, capturedAt, market: kind, lines: sectionLines }));
    } else if (kind.includes("correct_score")) {
      parsed.push(...parseCorrectScoreSection({ ...input, bookmaker, capturedAt, market: kind, lines: sectionLines }));
    } else if (kind === "full_time:first_last_goal") {
      parsed.push(...parseFirstLastGoalSection({ ...input, bookmaker, capturedAt, market: kind, lines: sectionLines }));
    } else if (kind === "full_time:winning_margin") {
      parsed.push(...parseWinningMarginSection({ ...input, bookmaker, capturedAt, market: kind, lines: sectionLines }));
    } else {
      parsed.push(...parseQueuedLabelOddsSection({
        ...input,
        bookmaker,
        capturedAt,
        market: kind,
        lines: sectionLines,
        skipLabels: [input.homeTeam, input.awayTeam, "主队", "客队", "主队 客队"],
      }));
    }
  }

  const deduped = new Map<string, BwOddsRow>();
  for (const row of parsed) {
    const key = [row.market, row.selection, row.line ?? "", row.decimalOdds].join("|");
    deduped.set(key, row);
  }

  return { capturedAt, bookmaker, parsed: Array.from(deduped.values()), skippedSections: Array.from(skippedSections) };
}

export function writeBwOddsRows(rows: BwOddsRow[]) {
  if (rows.length === 0) return 0;
  const values = rows.map((row) => ({
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
    sourceType: "bw_text_capture",
    sourceNote: row.sourceNote,
  }));
  getDb().insert(oddsSnapshots).values(values).run();
  return values.length;
}
