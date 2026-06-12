import { upsertCodexPrediction } from "@/server/actions/codex-predictions";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prediction = await upsertCodexPrediction(body);
    return apiOk({ prediction }, 201);
  } catch (error) {
    return apiError(error);
  }
}
