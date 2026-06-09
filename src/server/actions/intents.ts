import { z } from "zod";
import { getDb } from "@/db/client";
import { betIntentLegs, betIntents } from "@/db/schema";
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

export async function createBetIntent(input: z.input<typeof createBetIntentSchema>) {
  const data = createBetIntentSchema.parse(input);
  const row = { id: createId("intent"), ...data };

  getDb().insert(betIntents).values(row).run();

  return row;
}

export async function addBetIntentLeg(input: z.input<typeof addBetIntentLegSchema>) {
  const data = addBetIntentLegSchema.parse(input);
  const row = { id: createId("intent-leg"), ...data };

  getDb().insert(betIntentLegs).values(row).run();

  return row;
}
