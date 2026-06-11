import { desc } from "drizzle-orm";
import { AllocationForm } from "@/components/bankroll/allocation-form";
import { LedgerTable } from "@/components/bankroll/ledger-table";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { ListFilterForm } from "@/components/filters/list-filter-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db/client";
import { portfolioLedgerEntries, portfolios } from "@/db/schema";
import { countActiveFilters, getSearchParam, matchesDateRange, matchesText, type SearchParamsRecord } from "@/domain/list-filters";
import { LEDGER_ENTRY_TYPE_LABELS } from "@/domain/ledger";

export const dynamic = "force-dynamic";

export default async function BankrollPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamsRecord>;
}) {
  const params = await searchParams;
  const portfolioId = getSearchParam(params, "portfolioId");
  const entryType = getSearchParam(params, "entryType");
  const isRealMoney = getSearchParam(params, "isRealMoney");
  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const q = getSearchParam(params, "q");
  const db = getDb();
  const allPortfolios = db.select().from(portfolios).all();
  const entries = db
    .select()
    .from(portfolioLedgerEntries)
    .orderBy(desc(portfolioLedgerEntries.createdAt))
    .all()
    .filter((entry) => {
      if (portfolioId && entry.portfolioId !== portfolioId) return false;
      if (entryType && entry.entryType !== entryType) return false;
      if (isRealMoney === "true" && !entry.isRealMoney) return false;
      if (isRealMoney === "false" && entry.isRealMoney) return false;
      if (!matchesDateRange(entry.createdAt, dateFrom, dateTo)) return false;
      return matchesText(q, [
        entry.id,
        entry.portfolioId,
        entry.entryType,
        entry.betSlipId,
        entry.sourceActor,
        entry.notes,
      ]);
    });
  const user = allPortfolios.find((portfolio) => portfolio.id === "user");
  const codex = allPortfolios.find((portfolio) => portfolio.id === "codex");
  const activeFilterCount = countActiveFilters({
    portfolioId,
    entryType,
    isRealMoney,
    dateFrom,
    dateTo,
    q,
  });

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <PortfolioSummary title="User" balanceCents={user?.allocatedBalanceCents ?? 0} subtitle="用户逻辑账本" />
          <PortfolioSummary title="Codex" balanceCents={codex?.allocatedBalanceCents ?? 0} subtitle="Codex 独立额度" />
        </div>
        <ListFilterForm
          action="/bankroll"
          activeCount={activeFilterCount}
          fields={[
            { name: "q", label: "搜索", value: q, placeholder: "备注 / 注单号 / ledger" },
            {
              name: "portfolioId",
              label: "账本",
              type: "select",
              value: portfolioId,
              options: [
                { value: "user", label: "User" },
                { value: "codex", label: "Codex" },
              ],
            },
            {
              name: "entryType",
              label: "类型",
              type: "select",
              value: entryType,
              options: Object.entries(LEDGER_ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            },
            {
              name: "isRealMoney",
              label: "真实资金",
              type: "select",
              value: isRealMoney,
              options: [
                { value: "true", label: "是" },
                { value: "false", label: "否" },
              ],
            },
            { name: "dateFrom", label: "开始日期", type: "date", value: dateFrom },
            { name: "dateTo", label: "结束日期", type: "date", value: dateTo },
          ]}
        />
        <Card>
          <CardHeader><CardTitle>资金流水 · {entries.length}</CardTitle></CardHeader>
          <CardContent><LedgerTable entries={entries} /></CardContent>
        </Card>
      </div>
      <AllocationForm />
    </div>
  );
}
