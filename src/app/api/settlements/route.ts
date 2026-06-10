import { settleBetSlip } from "@/server/actions/settlements";
import { buildSettlementPreview, isDryRunRequest } from "@/server/api/previews";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (isDryRunRequest(body)) {
      return apiOk(buildSettlementPreview(body));
    }

    const settlement = await settleBetSlip(body);
    return apiOk(settlement, 201);
  } catch (error) {
    return apiError(error);
  }
}
