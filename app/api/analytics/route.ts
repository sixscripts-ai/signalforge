import { getAnalyticsData } from "@/lib/analytics";

export async function GET() {
  const analytics = await getAnalyticsData();
  return Response.json(analytics);
}
