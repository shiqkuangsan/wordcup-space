import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { betIntentLegs, betIntents, betSlips } from "@/db/schema";
import { createId } from "@/server/actions/ids";

const createBetIntentSchema = z.object({
  portfolioId: z.enum(["user", "codex"]),
  decisionBy: z.enum(["user", "codex"]),
  mode: z.enum(["single", "parlay"]),
  market: z.string().optional(),
  intendedStakeCents: z.number().int().positive(),
  intendedTotalOdds: z.number().positive(),
  riskTier: z.string().min(1),
  confidence: z.string().min(1),
  modelProbability: z.number().min(0).max(1).optional(),
  expectedValue: z.number().optional(),
  status: z.string().default("proposed"),
  approvalMode: z.string().default("auto"),
  rationale: z.string().min(1),
  expiresAt: z.string().optional(),
});

const addBetIntentLegSchema = z.object({
  betIntentId: z.string().min(1),
  matchId: z.string().min(1),
  market: z.string().min(1),
  selection: z.string().min(1),
  line: z.string().optional(),
  intendedOdds: z.number().positive(),
  legOrder: z.number().int().positive(),
  notes: z.string().optional(),
});

const closeBetIntentSchema = z.object({
  id: z.string().min(1),
  closedReason: z.enum(["expired_not_adopted", "user_cancelled", "execution_failed", "superseded"]),
  closedNote: z.string().optional(),
  supersededByIntentId: z.string().min(1).optional(),
});

export async function createBetIntent(input: z.input<typeof createBetIntentSchema>) {
  const data = createBetIntentSchema.parse(input);
  const row = { id: createId("intent"), ...data };

  getDb().insert(betIntents).values(row).run();

  return row;
}

export async function closeBetIntent(input: z.input<typeof closeBetIntentSchema>) {
  const data = closeBetIntentSchema.parse(input);
  const db = getDb();
  const intent = db.select().from(betIntents).where(eq(betIntents.id, data.id)).get();
  if (!intent) throw new Error(`bet intent not found: ${data.id}`);
  if (intent.status === "executed") throw new Error("executed bet intent cannot be closed without slip workflow");

  const slip = db.select().from(betSlips).where(eq(betSlips.betIntentId, data.id)).get();
  if (slip) throw new Error("bet intent already has a slip");

  const closedAt = new Date().toISOString();
  const status = data.closedReason === "expired_not_adopted" ? "expired" : "cancelled";
  const closedNote = data.closedNote?.trim();

  db.update(betIntents)
    .set({
      status,
      closedAt,
      closedReason: data.closedReason,
      closedNote: closedNote || undefined,
      supersededByIntentId: data.supersededByIntentId,
      updatedAt: closedAt,
    })
    .where(eq(betIntents.id, data.id))
    .run();

  return {
    ...intent,
    status,
    closedAt,
    closedReason: data.closedReason,
    closedNote: closedNote || undefined,
    supersededByIntentId: data.supersededByIntentId,
    updatedAt: closedAt,
  };
}

export async function addBetIntentLeg(input: z.input<typeof addBetIntentLegSchema>) {
  const data = addBetIntentLegSchema.parse(input);
  const row = { id: createId("intent-leg"), ...data };

  getDb().insert(betIntentLegs).values(row).run();

  return row;
}
