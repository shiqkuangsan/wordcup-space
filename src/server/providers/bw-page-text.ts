import { formatTeamName } from "@/domain/team-names";

const MARKET_HINTS = [
  "全场让球",
  "全场大小",
  "全场独赢",
  "全场胜平负",
  "独赢盘",
  "1X2",
  "波胆",
  "总进球",
  "上半场让球",
  "上半场大小",
  "上半场独赢",
  "上半场波胆",
  "双方球队皆进球",
];

const BW_TEAM_ALIASES: Record<string, string[]> = {
  科特迪瓦: ["象牙海岸"],
  突尼斯: ["突尼西亚"],
  沙特阿拉伯: ["沙地阿拉伯"],
  新西兰: ["纽西兰"],
  乌兹别克斯坦: ["乌兹别克"],
};

export type BwPageTextValidation = {
  ok: boolean;
  textLength: number;
  lineCount: number;
  homeMatched: boolean;
  awayMatched: boolean;
  marketHintCount: number;
  marketHints: string[];
  warnings: string[];
};

function compact(value: string) {
  return value.replace(/\s/g, "").toLowerCase();
}

function teamTerms(teamName: string) {
  const normalized = formatTeamName(teamName);
  return [teamName, normalized, ...(BW_TEAM_ALIASES[normalized] ?? [])]
    .map(compact)
    .filter(Boolean);
}

function includesAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function validateBwPageTextForMatch(input: {
  text: string;
  homeTeam: string;
  awayTeam: string;
}): BwPageTextValidation {
  const text = input.text.trim();
  const compactText = compact(text);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const marketHints = MARKET_HINTS.filter((hint) => text.includes(hint));
  const homeMatched = includesAnyTerm(compactText, teamTerms(input.homeTeam));
  const awayMatched = includesAnyTerm(compactText, teamTerms(input.awayTeam));
  const warnings: string[] = [];

  if (text.length < 100) warnings.push("复制到的页面文本过短，可能没有选中比赛详情内容。");
  if (!homeMatched) warnings.push(`页面文本没有匹配主队：${formatTeamName(input.homeTeam)}。`);
  if (!awayMatched) warnings.push(`页面文本没有匹配客队：${formatTeamName(input.awayTeam)}。`);
  if (marketHints.length < 2) warnings.push("页面文本中的盘口分类过少，可能不是比赛详情全盘口页。");

  return {
    ok: warnings.length === 0,
    textLength: text.length,
    lineCount: lines.length,
    homeMatched,
    awayMatched,
    marketHintCount: marketHints.length,
    marketHints,
    warnings,
  };
}
