import { recordMatchResult } from "@/server/actions/match-results";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    return apiOk(await recordMatchResult({ ...body, matchId: id }), 201);
  } catch (error) {
    return apiError(error);
  }
}
