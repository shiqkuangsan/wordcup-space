import { desc } from "drizzle-orm";
import { IntentCard } from "@/components/intents/intent-card";
import { IntentForm } from "@/components/intents/intent-form";
import { getDb } from "@/db/client";
import { betIntents, matches } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function IntentsPage() {
  const db = getDb();
  const allMatches = db.select().from(matches).orderBy(desc(matches.kickoffAt)).all();
  const intents = db.select().from(betIntents).orderBy(desc(betIntents.createdAt)).all();

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-normal">决策队列</h2>
        {intents.map((intent) => <IntentCard key={intent.id} intent={intent} />)}
        {intents.length === 0 ? <p className="text-sm text-muted-foreground">暂无 intent。</p> : null}
      </div>
      <IntentForm matches={allMatches} />
    </div>
  );
}
