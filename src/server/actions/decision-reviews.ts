import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { betIntents, betSlips, decisionReviews } from "@/db/schema";
import { createId } from "@/server/actions/ids";

const recordDecisionReviewSchema = z.object({
  betSlipId: z.string().min(1).optional(),
  betIntentId: z.string().min(1).optional(),
  reviewer: z.enum(["user", "codex"]).default("user"),
  rating: z.string().optional(),
  reviewNote: z.string().min(1),
}).superRefine((data, ctx) => {
  if (!data.betSlipId && !data.betIntentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "betSlipId or betIntentId is required",
      path: ["betSlipId"],
    });
  }
});

export async function recordDecisionReview(input: z.input<typeof recordDecisionReviewSchema>) {
  const data = recordDecisionReviewSchema.parse(input);
  const db = getDb();

  if (data.betSlipId) {
    const slip = db.select().from(betSlips).where(eq(betSlips.id, data.betSlipId)).get();
    if (!slip) throw new Error(`bet slip not found: ${data.betSlipId}`);
  }

  if (data.betIntentId) {
    const intent = db.select().from(betIntents).where(eq(betIntents.id, data.betIntentId)).get();
    if (!intent) throw new Error(`bet intent not found: ${data.betIntentId}`);
  }

  const row = {
    id: createId("review"),
    ...data,
  };

  db.insert(decisionReviews).values(row).run();

  return row;
}
