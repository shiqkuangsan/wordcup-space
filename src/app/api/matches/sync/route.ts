import { syncMatches } from "@/server/actions/match-sync";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const result = await syncMatches(await request.json());
    return apiOk(result);
  } catch (error) {
    return apiError(error);
  }
}
