import { syncWorldCup2026Matches } from "@/server/actions/worldcup-sync";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST() {
  try {
    return apiOk(await syncWorldCup2026Matches());
  } catch (error) {
    return apiError(error);
  }
}
