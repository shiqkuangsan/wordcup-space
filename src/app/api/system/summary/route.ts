import { apiError, apiOk } from "@/server/api/responses";
import { getDashboardSummary } from "@/server/queries/dashboard";

export async function GET() {
  try {
    return apiOk(await getDashboardSummary());
  } catch (error) {
    return apiError(error, 500);
  }
}
