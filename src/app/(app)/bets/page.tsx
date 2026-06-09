import { eq } from "drizzle-orm";
import { BetsTable } from "@/components/bets/bets-table";
import { SettlementDialog } from "@/components/bets/settlement-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { betSlips } from "@/db/schema";
import { listBetSlips } from "@/server/queries/bets";

export const dynamic = "force-dynamic";

export default async function BetsPage() {
  const slips = await listBetSlips();
  const openSlips = getDb().select().from(betSlips).where(eq(betSlips.status, "open")).all();

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader><CardTitle>注单中心</CardTitle></CardHeader>
        <CardContent><BetsTable slips={slips} /></CardContent>
      </Card>
      <SettlementDialog openSlips={openSlips} />
    </div>
  );
}
