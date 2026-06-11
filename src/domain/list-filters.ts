import { localDateKey } from "@/domain/dates";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function getSearchParam(params: SearchParamsRecord | undefined, key: string) {
  const value = params?.[key];
  return cleanFilterValue(Array.isArray(value) ? value[0] : value);
}

export function cleanFilterValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function countActiveFilters(filters: Record<string, string | undefined>) {
  return Object.values(filters).filter((value) => cleanFilterValue(value).length > 0).length;
}

export function normalizeFilterText(value: string | number | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function matchesText(query: string, values: Array<string | number | null | undefined>) {
  const normalizedQuery = normalizeFilterText(query);
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeFilterText(value).includes(normalizedQuery));
}

export function matchesDateRange(input: string, from: string, to: string) {
  const dateKey = localDateKey(input);
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}
