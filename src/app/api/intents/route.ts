import { addBetIntentLeg, createBetIntent } from "@/server/actions/intents";
import { buildIntentPreview, isDryRunRequest } from "@/server/api/previews";
import { apiError, apiOk } from "@/server/api/responses";

type IntentLegInput = {
  matchId: string;
  market: string;
  selection: string;
  line?: string;
  intendedOdds: number;
  legOrder?: number;
  notes?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown> & { legs?: IntentLegInput[] };
    if (isDryRunRequest(body)) {
      return apiOk(buildIntentPreview(body));
    }

    const { legs = [] } = body;
    const intendedStakeCents =
      typeof body.intendedStakeCents === "number"
        ? body.intendedStakeCents
        : Math.round(Number(body.stake) * 100);
    const intent = await createBetIntent({
      portfolioId: String(body.portfolioId) as "user" | "codex",
      decisionBy: String(body.decisionBy) as "user" | "codex",
      mode: String(body.mode) as "single" | "parlay",
      market: typeof body.market === "string" ? body.market : undefined,
      intendedStakeCents,
      intendedTotalOdds: Number(body.intendedTotalOdds ?? body.odds),
      riskTier: String(body.riskTier),
      confidence: String(body.confidence),
      modelProbability: typeof body.modelProbability === "number" ? body.modelProbability : undefined,
      expectedValue: typeof body.expectedValue === "number" ? body.expectedValue : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      approvalMode: typeof body.approvalMode === "string" ? body.approvalMode : undefined,
      rationale: String(body.rationale),
      expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
    });
    const createdLegs = [];

    for (const [index, leg] of legs.entries()) {
      createdLegs.push(
        await addBetIntentLeg({
          ...leg,
          betIntentId: intent.id,
          legOrder: leg.legOrder ?? index + 1,
        }),
      );
    }

    return apiOk({ intent, legs: createdLegs }, 201);
  } catch (error) {
    return apiError(error);
  }
}
