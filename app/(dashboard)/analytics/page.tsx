import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AnalyticsDashboard } from "./analytics-dashboard";

export default async function AnalyticsPage() {
  const user = await requireUser();

  const userPlugins = await db.query.plugins.findMany({
    where: eq(plugins.creatorId, user.id),
    columns: { id: true, name: true },
  });

  return (
    <AnalyticsDashboard
      plugins={userPlugins.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
