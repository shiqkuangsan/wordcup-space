import { z } from "zod";

export const matchStageSchema = z.enum([
  "group_stage",
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
  "unknown",
]);

export const matchStatusSchema = z.enum([
  "scheduled",
  "live",
  "finished",
  "postponed",
  "cancelled",
]);

export type MatchStage = z.infer<typeof matchStageSchema>;
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const MATCH_STAGE_OPTIONS: Array<{ value: MatchStage; label: string }> = [
  { value: "group_stage", label: "小组赛" },
  { value: "round_of_32", label: "32 强" },
  { value: "round_of_16", label: "16 强" },
  { value: "quarter_final", label: "8 强" },
  { value: "semi_final", label: "半决赛" },
  { value: "third_place", label: "三四名决赛" },
  { value: "final", label: "决赛" },
  { value: "unknown", label: "未知阶段" },
];

export const MATCH_STATUS_OPTIONS: Array<{ value: MatchStatus; label: string }> = [
  { value: "scheduled", label: "未开赛" },
  { value: "live", label: "比赛中" },
  { value: "finished", label: "已完结" },
  { value: "postponed", label: "延期" },
  { value: "cancelled", label: "取消" },
];

const stageAliases: Record<string, MatchStage> = {
  group: "group_stage",
  "group stage": "group_stage",
  group_stage: "group_stage",
  "小组赛": "group_stage",
  "32": "round_of_32",
  "round of 32": "round_of_32",
  round_of_32: "round_of_32",
  "32 强": "round_of_32",
  "32强": "round_of_32",
  "16": "round_of_16",
  "round of 16": "round_of_16",
  round_of_16: "round_of_16",
  "16 强": "round_of_16",
  "16强": "round_of_16",
  "quarter-finals": "quarter_final",
  "quarter finals": "quarter_final",
  "quarter-final": "quarter_final",
  "quarter final": "quarter_final",
  quarter_final: "quarter_final",
  quarterfinals: "quarter_final",
  "8 强": "quarter_final",
  "8强": "quarter_final",
  "半决赛": "semi_final",
  "semi-finals": "semi_final",
  "semi finals": "semi_final",
  "semi-final": "semi_final",
  "semi final": "semi_final",
  semi_final: "semi_final",
  "third place": "third_place",
  "third-place": "third_place",
  third_place: "third_place",
  "三四名决赛": "third_place",
  final: "final",
  "决赛": "final",
};

const statusAliases: Record<string, MatchStatus> = {
  scheduled: "scheduled",
  "not started": "scheduled",
  upcoming: "scheduled",
  "未开赛": "scheduled",
  live: "live",
  in_play: "live",
  "in play": "live",
  "比赛中": "live",
  finished: "finished",
  complete: "finished",
  completed: "finished",
  "full time": "finished",
  "已完结": "finished",
  "已结束": "finished",
  postponed: "postponed",
  "延期": "postponed",
  cancelled: "cancelled",
  canceled: "cancelled",
  "取消": "cancelled",
};

export const normalizedMatchSchema = z.object({
  externalId: z.string().min(1),
  competition: z.string().default("世界杯"),
  season: z.string().default("2026"),
  matchNumber: z.number().int().positive().optional(),
  stage: z.union([matchStageSchema, z.string().min(1)]).transform(normalizeMatchStage),
  groupName: z.string().optional(),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  kickoffAt: z.string().min(1),
  venue: z.string().optional(),
  status: z.union([matchStatusSchema, z.string().min(1)]).default("scheduled").transform(normalizeMatchStatus),
  sourceUrl: z.string().url().optional(),
});

export const syncMatchesPayloadSchema = z.object({
  sourceName: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  fetchedAt: z.string().default(() => new Date().toISOString()),
  matches: z.array(normalizedMatchSchema).min(1),
});

export type NormalizedMatch = z.output<typeof normalizedMatchSchema>;
export type SyncMatchesPayload = z.output<typeof syncMatchesPayloadSchema>;

export function normalizeMatchStage(value: string): MatchStage {
  const key = value.trim().toLowerCase();
  return stageAliases[key] ?? "unknown";
}

export function normalizeMatchStatus(value: string): MatchStatus {
  const key = value.trim().toLowerCase();
  return statusAliases[key] ?? "scheduled";
}

export function formatMatchStage(stage: string): string {
  return MATCH_STAGE_OPTIONS.find((option) => option.value === normalizeMatchStage(stage))?.label ?? stage;
}

export function formatMatchStatus(status: string): string {
  return MATCH_STATUS_OPTIONS.find((option) => option.value === normalizeMatchStatus(status))?.label ?? status;
}
