import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { appSettings, platformAccounts, riskProfiles } from "@/db/schema";

const updateRiskProfileSchema = z.object({
  id: z.string().min(1),
  singleStakeLimitPct: z.number().min(0).max(1),
  highConfidenceStakeLimitPct: z.number().min(0).max(1),
  parlayStakeLimitPct: z.number().min(0).max(1),
  maxParlayLegs: z.number().int().min(1).max(20),
  dailyLossLimitPct: z.number().min(0).max(1),
});

export async function updateRiskProfile(input: z.input<typeof updateRiskProfileSchema>) {
  const data = updateRiskProfileSchema.parse(input);
  getDb()
    .update(riskProfiles)
    .set({
      singleStakeLimitPct: data.singleStakeLimitPct,
      highConfidenceStakeLimitPct: data.highConfidenceStakeLimitPct,
      parlayStakeLimitPct: data.parlayStakeLimitPct,
      maxParlayLegs: data.maxParlayLegs,
      dailyLossLimitPct: data.dailyLossLimitPct,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(riskProfiles.id, data.id))
    .run();
}

const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export async function updateAppSetting(input: z.input<typeof updateSettingSchema>) {
  const data = updateSettingSchema.parse(input);
  getDb()
    .update(appSettings)
    .set({
      value: data.value,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(appSettings.key, data.key))
    .run();
}

const upsertPlatformAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  accountLabel: z.string().min(1),
  currency: z.string().min(1).default("CNY"),
  notes: z.string().optional(),
});

export async function upsertPlatformAccount(input: z.input<typeof upsertPlatformAccountSchema>) {
  const data = upsertPlatformAccountSchema.parse(input);
  getDb()
    .insert(platformAccounts)
    .values({
      ...data,
      isActive: true,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: platformAccounts.id,
      set: {
        name: data.name,
        provider: data.provider,
        accountLabel: data.accountLabel,
        currency: data.currency,
        notes: data.notes,
        isActive: true,
        updatedAt: new Date().toISOString(),
      },
    })
    .run();
}
