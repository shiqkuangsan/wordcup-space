import { createBetSlipFromAttempt } from "@/server/actions/bet-slips";
import { createExecutionAttempt, markExecutionAttempt } from "@/server/actions/execution-attempts";
import { buildBetSlipPreview, isDryRunRequest } from "@/server/api/previews";
import { apiError, apiOk } from "@/server/api/responses";
import { normalizeOddsFormat, toDecimalOdds } from "@/domain/odds";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (isDryRunRequest(body)) {
      return apiOk(buildBetSlipPreview(body));
    }

    const oddsFormat = normalizeOddsFormat(body.oddsFormat);
    const rawOdds = Number(body.rawOdds ?? body.finalOdds);
    const finalOdds = toDecimalOdds(rawOdds, oddsFormat);
    const rawObservedOdds = Number(body.rawObservedOdds ?? body.observedOdds ?? rawOdds);
    const observedOdds = toDecimalOdds(rawObservedOdds, oddsFormat);
    const attempt = await createExecutionAttempt({
      betIntentId: body.betIntentId,
      executionMethod: body.executionMethod ?? "user_manual",
      platformAccountId: body.platformAccountId,
      intendedOdds: Number(body.intendedOdds ?? finalOdds),
      observedOdds,
      oddsFormat,
      rawObservedOdds,
      status: "pending",
      notes: body.executionNotes ?? "",
    });

    await markExecutionAttempt({
      id: attempt.id,
      status: "succeeded",
      observedOdds,
      oddsFormat,
      rawObservedOdds,
      notes: body.executionNotes ?? "API 记录：已执行成功。",
    });

    const stakeCents = body.stakeCents ?? Math.round(Number(body.stake) * 100);
    const slip = await createBetSlipFromAttempt({
      executionAttemptId: attempt.id,
      platformAccountId: body.platformAccountId,
      stakeCents,
      finalOdds,
      oddsFormat,
      rawOdds,
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
