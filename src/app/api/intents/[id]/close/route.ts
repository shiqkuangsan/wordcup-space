import { closeBetIntent } from "@/server/actions/intents";
import { apiError, apiOk } from "@/server/api/responses";

const closeReasons = ["expired_not_adopted", "user_cancelled", "execution_failed", "superseded"] as const;

function isCloseReason(value: unknown): value is (typeof closeReasons)[number] {
  return typeof value === "string" && closeReasons.includes(value as (typeof closeReasons)[number]);
}

function parseCloseReason(value: unknown): (typeof closeReasons)[number] {
  return isCloseReason(value) ? value : "expired_not_adopted";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const intent = await closeBetIntent({
      id,
      closedReason: parseCloseReason(body.closedReason),
      closedNote: typeof body.closedNote === "string" ? body.closedNote : undefined,
      supersededByIntentId: typeof body.supersededByIntentId === "string" ? body.supersededByIntentId : undefined,
    });

    return apiOk({ intent });
  } catch (error) {
    return apiError(error);
  }
}
