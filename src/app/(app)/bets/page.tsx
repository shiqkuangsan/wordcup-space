import { desc } from "drizzle-orm";
import { BetsTable } from "@/components/bets/bets-table";
import { QuickRecordPanel } from "@/components/bets/quick-record-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { betIntents, matches, platformAccounts } from "@/db/schema";
import { listBetSlips } from "@/server/queries/bets";

export const dynamic = "force-dynamic";

export default async function BetsPage({
  searchParams,
}: {
  searchParams: Promise<{ matchId?: string }>;
}) {
  const { matchId } = await searchParams;
  const db = getDb();
  const slips = await listBetSlips({ matchId });
  const openSlips = slips.filter((slip) => slip.status === "open");
  const settledSlips = slips.filter((slip) => slip.status !== "open");
  const intents = db.select().from(betIntents).orderBy(desc(betIntents.createdAt)).all();
  const executableIntents = intents.filter((intent) => !["executed", "cancelled", "expired"].includes(intent.status));
  const accounts = db.select().from(platformAccounts).orderBy(desc(platformAccounts.createdAt)).all();
  const allMatches = db.select().from(matches).orderBy(desc(matches.kickoffAt)).all();

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>未结算注单</CardTitle></CardHeader>
          <CardContent><BetsTable slips={openSlips} emptyText="暂无未结算注单。" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>已结算注单</CardTitle></CardHeader>
          <CardContent><BetsTable slips={settledSlips} emptyText="暂无已结算注单。" /></CardContent>
        </Card>
      </div>
      <QuickRecordPanel
        executableIntents={executableIntents}
        openSlips={openSlips}
        platformAccounts={accounts}
        matches={allMatches}
      />
    </div>
  );
}
