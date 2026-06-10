import { revalidatePath } from "next/cache";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db/client";
import { appSettings, platformAccounts, riskProfiles } from "@/db/schema";
import { updateAppSetting, updateRiskProfile, upsertPlatformAccount } from "@/server/actions/settings";

export const dynamic = "force-dynamic";

function percentValue(value: number) {
  return Number((value * 100).toFixed(2));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default async function SettingsPage() {
  const db = getDb();
  const accounts = db.select().from(platformAccounts).all();
  const risks = db.select().from(riskProfiles).all();
  const settings = db.select().from(appSettings).all();

  async function platformAction(formData: FormData) {
    "use server";
    await upsertPlatformAccount({
      id: String(formData.get("id")),
      name: String(formData.get("name")),
      provider: String(formData.get("provider")),
      accountLabel: String(formData.get("accountLabel")),
      currency: String(formData.get("currency") || "CNY"),
      notes: String(formData.get("notes") || ""),
    });
    revalidatePath("/settings");
  }

  async function riskAction(formData: FormData) {
    "use server";
    await updateRiskProfile({
      id: String(formData.get("id")),
      singleStakeLimitPct: Number(formData.get("singleStakeLimitPct")) / 100,
      highConfidenceStakeLimitPct: Number(formData.get("highConfidenceStakeLimitPct")) / 100,
      parlayStakeLimitPct: Number(formData.get("parlayStakeLimitPct")) / 100,
      maxParlayLegs: Number(formData.get("maxParlayLegs")),
      dailyLossLimitPct: Number(formData.get("dailyLossLimitPct")) / 100,
    });
    revalidatePath("/settings");
  }

  async function settingAction(formData: FormData) {
    "use server";
    const key = String(formData.get("key"));
    const rawValue =
      key === "odds_tolerance_pct"
        ? String(Number(formData.get("value")) / 100)
        : String(formData.get("value"));

    await updateAppSetting({
      key,
      value: rawValue,
    });
    revalidatePath("/settings");
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>平台账户</CardTitle></CardHeader>
        <CardContent>
          <form action={platformAction} className="mb-4 grid gap-3 md:grid-cols-3">
            <Field label="账户 ID">
              <Input name="id" defaultValue="bet365-main" placeholder="例如 bet365-main" required />
            </Field>
            <Field label="展示名称">
              <Input name="name" defaultValue="Bet365 主账户" placeholder="例如 Bet365 主账户" required />
            </Field>
            <Field label="平台">
              <Input name="provider" defaultValue="bet365" placeholder="例如 bet365" required />
            </Field>
            <Field label="平台账号标签">
              <Input name="accountLabel" defaultValue="bet365-main" placeholder="例如 bet365-main" required />
            </Field>
            <Field label="币种">
              <Input name="currency" defaultValue="CNY" placeholder="CNY" required />
            </Field>
            <Field label="备注">
              <Input name="notes" placeholder="可空" />
            </Field>
            <Button type="submit" className="md:col-span-3">保存平台账户</Button>
          </form>
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>名称</TableHead><TableHead>平台</TableHead><TableHead>币种</TableHead><TableHead>备注</TableHead></TableRow></TableHeader>
            <TableBody>{accounts.map((account) => <TableRow key={account.id}><TableCell>{account.id}</TableCell><TableCell>{account.name}</TableCell><TableCell>{account.provider}</TableCell><TableCell>{account.currency}</TableCell><TableCell>{account.notes}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Codex 风控</CardTitle></CardHeader>
        <CardContent>
          {risks.map((risk) => (
            <form key={risk.id} action={riskAction} className="mb-4 grid gap-3 md:grid-cols-6">
              <input type="hidden" name="id" value={risk.id} />
              <Field label="单场上限 %">
                <Input name="singleStakeLimitPct" type="number" step="0.1" defaultValue={percentValue(risk.singleStakeLimitPct)} />
              </Field>
              <Field label="高信心上限 %">
                <Input name="highConfidenceStakeLimitPct" type="number" step="0.1" defaultValue={percentValue(risk.highConfidenceStakeLimitPct)} />
              </Field>
              <Field label="串关上限 %">
                <Input name="parlayStakeLimitPct" type="number" step="0.1" defaultValue={percentValue(risk.parlayStakeLimitPct)} />
              </Field>
              <Field label="最大串关腿数">
                <Input name="maxParlayLegs" type="number" step="1" defaultValue={risk.maxParlayLegs} />
              </Field>
              <Field label="单日最大亏损 %">
                <Input name="dailyLossLimitPct" type="number" step="0.1" defaultValue={percentValue(risk.dailyLossLimitPct)} />
              </Field>
              <div className="flex items-end">
                <Button type="submit" className="w-full">保存风控</Button>
              </div>
            </form>
          ))}
          <Table>
            <TableHeader><TableRow><TableHead>主体</TableHead><TableHead>单场</TableHead><TableHead>高信心</TableHead><TableHead>串关</TableHead><TableHead>legs</TableHead><TableHead>单日亏损</TableHead></TableRow></TableHeader>
            <TableBody>{risks.map((risk) => <TableRow key={risk.id}><TableCell>{risk.ownerActor}</TableCell><TableCell>{percentValue(risk.singleStakeLimitPct)}%</TableCell><TableCell>{percentValue(risk.highConfidenceStakeLimitPct)}%</TableCell><TableCell>{percentValue(risk.parlayStakeLimitPct)}%</TableCell><TableCell>{risk.maxParlayLegs}</TableCell><TableCell>{percentValue(risk.dailyLossLimitPct)}%</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>系统设置</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Key</TableHead><TableHead>Value</TableHead><TableHead>备注</TableHead></TableRow></TableHeader>
            <TableBody>{settings.map((setting) => {
              const isPercent = setting.key === "odds_tolerance_pct";
              const displayValue = isPercent ? percentValue(Number(setting.value)) : setting.value;

              return (
                <TableRow key={setting.key}>
                  <TableCell>{setting.key}</TableCell>
                  <TableCell>
                    <form action={settingAction} className="flex gap-2">
                      <input type="hidden" name="key" value={setting.key} />
                      <Input name="value" type={isPercent ? "number" : "text"} step={isPercent ? "0.1" : undefined} defaultValue={displayValue} aria-label={setting.key} />
                      {isPercent ? <span className="self-center text-sm text-muted-foreground">%</span> : null}
                      <Button type="submit">保存</Button>
                    </form>
                  </TableCell>
                  <TableCell>{setting.notes}</TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
          <p className="mt-3 text-sm text-muted-foreground">
            User/Codex 预算调整请走资金账本，确保每次追加或提取都有资金流水。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
