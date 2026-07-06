export type OddsCaptureRowLike = {
  market: string;
};

export type OddsCaptureCompletenessOptions = {
  minimumMarkets?: number;
  minimumRows?: number;
};

export type OddsCaptureCompleteness = {
  status: "complete" | "thin" | "empty";
  reason: string;
  marketCount: number;
  rowCount: number;
  markets: string[];
};

const DEFAULT_MINIMUM_MARKETS = 4;
const DEFAULT_MINIMUM_ROWS = 20;

export function assessOddsCaptureCompleteness(
  rows: OddsCaptureRowLike[],
  options: OddsCaptureCompletenessOptions = {},
): OddsCaptureCompleteness {
  const markets = Array.from(new Set(rows.map((row) => row.market))).sort();
  const marketCount = markets.length;
  const rowCount = rows.length;
  const minimumMarkets = options.minimumMarkets ?? DEFAULT_MINIMUM_MARKETS;
  const minimumRows = options.minimumRows ?? DEFAULT_MINIMUM_ROWS;

  if (rowCount === 0) {
    return {
      status: "empty",
      reason: "没有解析到任何赔率",
      marketCount,
      rowCount,
      markets,
    };
  }

  if (marketCount <= 1 && rowCount <= 4) {
    return {
      status: "thin",
      reason: "只抓到单一盘口，疑似 SABA visitor API 未返回详情盘口",
      marketCount,
      rowCount,
      markets,
    };
  }

  if (marketCount < minimumMarkets) {
    return {
      status: "thin",
      reason: `盘口类型不足 ${minimumMarkets} 类`,
      marketCount,
      rowCount,
      markets,
    };
  }

  if (rowCount < minimumRows) {
    return {
      status: "thin",
      reason: `赔率行数不足 ${minimumRows} 条`,
      marketCount,
      rowCount,
      markets,
    };
  }

  return {
    status: "complete",
    reason: "盘口覆盖满足日常分析阈值",
    marketCount,
    rowCount,
    markets,
  };
}
