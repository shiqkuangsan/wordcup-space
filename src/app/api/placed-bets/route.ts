import { buildPlacedBetPreview, createPlacedBetFromDraft } from "@/server/api/placed-bets";
import { isDryRunRequest } from "@/server/api/previews";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (isDryRunRequest(body)) {
      return apiOk(buildPlacedBetPreview(body));
    }

    return apiOk(createPlacedBetFromDraft(body), 201);
  } catch (error) {
    return apiError(error);
  }
}
