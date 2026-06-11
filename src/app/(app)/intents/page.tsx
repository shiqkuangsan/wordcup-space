import { desc, eq } from "drizzle-orm";
import { IntentCard } from "@/components/intents/intent-card";
import { IntentForm } from "@/components/intents/intent-form";
import { getDb } from "@/db/client";
import { betIntentLegs, betIntents, matches, platformAccounts } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function IntentsPage({
  searchParams,
}: {
  searchParams: Promise<{ matchId?: string }>;
}) {
  const { matchId } = await searchParams;
  const db = getDb();
  const allMatches = db.select().from(matches).orderBy(desc(matches.kickoffAt)).all();
  const allIntents = db.select().from(betIntents).orderBy(desc(betIntents.createdAt)).all();
  const allIntentLegs = db.select().from(betIntentLegs).all();
  const activePlatformAccounts = db.select().from(platformAccounts).where(eq(platformAccounts.isActive, true)).all();
  const intentIdsForMatch = matchId
    ? new Set(allIntentLegs.filter((leg) => leg.matchId === matchId).map((leg) => leg.betIntentId))
    : undefined;
  const intents = intentIdsForMatch
    ? allIntents.filter((intent) => intentIdsForMatch.has(intent.id))
    : allIntents;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-normal">决策队列</h2>
        {intents.map((intent) => (
          <IntentCard
            key={intent.id}
            intent={intent}
            legs={allIntentLegs.filter((leg) => leg.betIntentId === intent.id)}
            platformAccounts={activePlatformAccounts}
          />
        ))}
        {intents.length === 0 ? <p className="text-sm text-muted-foreground">暂无 intent。</p> : null}
      </div>
      <IntentForm matches={allMatches} />
    </div>
  );
}
