import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { executionAttempts } from "@/db/schema";
import { getOddsChangePct } from "@/domain/odds";
import { createId } from "@/server/actions/ids";

const createExecutionAttemptSchema = z.object({
  betIntentId: z.string().min(1),
  executionMethod: z.enum(["user_manual", "chrome", "computer_use", "browser_capture"]),
  platformAccountId: z.string().optional(),
  intendedOdds: z.number().positive(),
  observedOdds: z.number().positive().optional(),
  oddsTolerancePct: z.number().positive().default(0.06),
  status: z.string().default("pending"),
  notes: z.string().optional(),
});

const markExecutionAttemptSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["running", "succeeded", "failed", "cancelled"]),
  observedOdds: z.number().positive().optional(),
  failureReason: z.string().optional(),
  notes: z.string().optional(),
});

export async function createExecutionAttempt(input: z.input<typeof createExecutionAttemptSchema>) {
  const data = createExecutionAttemptSchema.parse(input);
  const oddsChangePct =
    data.observedOdds == null ? undefined : getOddsChangePct(data.intendedOdds, data.observedOdds);
  const row = {
    id: createId("attempt"),
    ...data,
    oddsChangePct,
    startedAt: new Date().toISOString(),
  };

  getDb().insert(executionAttempts).values(row).run();

  return row;
}

export async function markExecutionAttempt(input: z.input<typeof markExecutionAttemptSchema>) {
  const data = markExecutionAttemptSchema.parse(input);
  const db = getDb();
  const attempt = db
    .select()
    .from(executionAttempts)
    .where(eq(executionAttempts.id, data.id))
    .get();

  if (!attempt) throw new Error(`execution attempt not found: ${data.id}`);

  const oddsChangePct =
    data.observedOdds == null
      ? attempt.oddsChangePct
      : getOddsChangePct(attempt.intendedOdds, data.observedOdds);

  db.update(executionAttempts)
    .set({
      status: data.status,
      observedOdds: data.observedOdds ?? attempt.observedOdds,
      oddsChangePct,
      failureReason: data.failureReason,
      notes: data.notes ?? attempt.notes,
      finishedAt: ["succeeded", "failed", "cancelled"].includes(data.status)
        ? new Date().toISOString()
        : attempt.finishedAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(executionAttempts.id, data.id))
    .run();

  return { ...attempt, ...data, oddsChangePct };
}
