import { syncWorldCup2026ApiMatches } from "@/server/actions/worldcup2026-api-sync";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST() {
  try {
    return apiOk(await syncWorldCup2026ApiMatches());
  } catch (error) {
    return apiError(error);
  }
}
