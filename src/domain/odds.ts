export type OddsFormat = "decimal" | "hong_kong";

export function normalizeOddsFormat(value: unknown): OddsFormat {
  switch (String(value ?? "decimal")) {
    case "hong_kong":
    case "hk":
    case "港盘":
      return "hong_kong";
    case "decimal":
    case "european":
    case "euro":
    case "欧洲盘":
    default:
      return "decimal";
  }
}

export function toDecimalOdds(rawOdds: number, oddsFormat: OddsFormat) {
  if (!Number.isFinite(rawOdds) || rawOdds <= 0) {
    throw new Error("odds must be a positive number");
  }

  return oddsFormat === "hong_kong" ? rawOdds + 1 : rawOdds;
}

export function formatOddsWithFormat(decimalOdds: number, rawOdds?: number | null, oddsFormat?: string | null) {
  const format = normalizeOddsFormat(oddsFormat);
  const displayRawOdds = rawOdds ?? (format === "hong_kong" ? decimalOdds - 1 : decimalOdds);
  const label = format === "hong_kong" ? "港盘" : "欧盘";

  return `${displayRawOdds.toFixed(2)} ${label}`;
}

export function getOddsChangePct(intendedOdds: number, observedOdds: number) {
  if (intendedOdds <= 0) {
    throw new Error("intendedOdds must be greater than 0");
  }

  return Math.abs(observedOdds - intendedOdds) / intendedOdds;
}

export function isWithinOddsTolerance(
  intendedOdds: number,
  observedOdds: number,
  tolerance = 0.06,
) {
  return getOddsChangePct(intendedOdds, observedOdds) < tolerance;
}
