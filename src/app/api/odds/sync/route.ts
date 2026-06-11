import { syncReferenceOdds } from "@/server/actions/odds-sync";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST() {
  try {
    return apiOk(await syncReferenceOdds());
  } catch (error) {
    return apiError(error);
  }
}
