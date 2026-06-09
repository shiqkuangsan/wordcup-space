import { desc } from "drizzle-orm";
import { AllocationForm } from "@/components/bankroll/allocation-form";
import { LedgerTable } from "@/components/bankroll/ledger-table";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { portfolioLedgerEntries, portfolios } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function BankrollPage() {
  const db = getDb();
  const allPortfolios = db.select().from(portfolios).all();
  const entries = db.select().from(portfolioLedgerEntries).orderBy(desc(portfolioLedgerEntries.createdAt)).all();
  const user = allPortfolios.find((portfolio) => portfolio.id === "user");
  const codex = allPortfolios.find((portfolio) => portfolio.id === "codex");

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <PortfolioSummary title="User" balanceCents={user?.allocatedBalanceCents ?? 0} subtitle="用户逻辑账本" />
          <PortfolioSummary title="Codex" balanceCents={codex?.allocatedBalanceCents ?? 0} subtitle="Codex 独立额度" />
        </div>
        <Card>
          <CardHeader><CardTitle>资金流水</CardTitle></CardHeader>
          <CardContent><LedgerTable entries={entries} /></CardContent>
        </Card>
      </div>
      <AllocationForm />
    </div>
  );
}
