import { settleBetSlip } from "@/server/actions/settlements";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const settlement = await settleBetSlip(await request.json());
    return apiOk(settlement, 201);
  } catch (error) {
    return apiError(error);
  }
}
