import { buildCodexAnalysisPreview } from "@/server/api/codex-analysis";
import { apiError, apiOk } from "@/server/api/responses";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return apiOk(buildCodexAnalysisPreview(body));
  } catch (error) {
    return apiError(error);
  }
}
