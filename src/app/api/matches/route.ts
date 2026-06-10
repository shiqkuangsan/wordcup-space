import { createMatch } from "@/server/actions/matches";
import { apiError, apiOk } from "@/server/api/responses";
import { listMatches } from "@/server/queries/matches";

export async function GET() {
  try {
    return apiOk(await listMatches());
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const match = await createMatch(await request.json());
    return apiOk(match, 201);
  } catch (error) {
    return apiError(error);
  }
}
