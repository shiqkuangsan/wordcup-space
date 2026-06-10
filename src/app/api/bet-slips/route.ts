import { createBetSlipFromAttempt } from "@/server/actions/bet-slips";
import { createExecutionAttempt, markExecutionAttempt } from "@/server/actions/execution-attempts";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const observedOdds = Number(body.observedOdds ?? body.finalOdds);
    const attempt = await createExecutionAttempt({
      betIntentId: body.betIntentId,
      executionMethod: body.executionMethod ?? "user_manual",
      platformAccountId: body.platformAccountId,
      intendedOdds: Number(body.intendedOdds ?? body.finalOdds),
      observedOdds,
      status: "pending",
      notes: body.executionNotes ?? "",
    });

    await markExecutionAttempt({
      id: attempt.id,
      status: "succeeded",
      observedOdds,
      notes: body.executionNotes ?? "API 记录：已执行成功。",
    });

    const stakeCents = body.stakeCents ?? Math.round(Number(body.stake) * 100);
    const slip = await createBetSlipFromAttempt({
      executionAttemptId: attempt.id,
      platformAccountId: body.platformAccountId,
      stakeCents,
      finalOdds: Number(body.finalOdds),
      confirmationRef: body.confirmationRef,
      confirmationScreenshotPath: body.confirmationScreenshotPath,
      isRealMoney: body.isRealMoney !== false,
      placedAt: body.placedAt,
    });

    return apiOk({ attempt, slip }, 201);
  } catch (error) {
    return apiError(error);
  }
}
