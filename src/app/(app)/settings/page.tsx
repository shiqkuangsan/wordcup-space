import { revalidatePath } from "next/cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db/client";
import { appSettings, platformAccounts, riskProfiles } from "@/db/schema";
import { updateAppSetting, updateRiskProfile, upsertPlatformAccount } from "@/server/actions/settings";

export const dynamic = "force-dynamic";

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
      singleStakeLimitPct: Number(formData.get("singleStakeLimitPct")),
      highConfidenceStakeLimitPct: Number(formData.get("highConfidenceStakeLimitPct")),
      parlayStakeLimitPct: Number(formData.get("parlayStakeLimitPct")),
      maxParlayLegs: Number(formData.get("maxParlayLegs")),
      dailyLossLimitPct: Number(formData.get("dailyLossLimitPct")),
    });
    revalidatePath("/settings");
  }

  async function settingAction(formData: FormData) {
    "use server";
    await updateAppSetting({
      key: String(formData.get("key")),
      value: String(formData.get("value")),
    });
    revalidatePath("/settings");
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>平台账户</CardTitle></CardHeader>
        <CardContent>
          <form action={platformAction} className="mb-4 grid gap-3 md:grid-cols-3">
            <Input name="id" defaultValue="bet365-main" placeholder="账户 ID，例如 bet365-main" required />
            <Input name="name" defaultValue="Bet365 主账户" placeholder="展示名称" required />
            <Input name="provider" defaultValue="bet365" placeholder="平台，例如 bet365" required />
            <Input name="accountLabel" defaultValue="bet365-main" placeholder="平台账号标签" required />
            <Input name="currency" defaultValue="CNY" placeholder="币种" required />
            <Input name="notes" placeholder="备注" />
            <Button type="submit" className="md:col-span-3">保存平台账户</Button>
          </form>
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Provider</TableHead><TableHead>币种</TableHead></TableRow></TableHeader>
            <TableBody>{accounts.map((account) => <TableRow key={account.id}><TableCell>{account.id}</TableCell><TableCell>{account.provider}</TableCell><TableCell>{account.currency}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Codex 风控</CardTitle></CardHeader>
        <CardContent>
          {risks.map((risk) => (
            <form key={risk.id} action={riskAction} className="mb-4 grid gap-3 md:grid-cols-6">
              <input type="hidden" name="id" value={risk.id} />
              <Input name="singleStakeLimitPct" type="number" step="0.01" defaultValue={risk.singleStakeLimitPct} aria-label="单场上限" />
              <Input name="highConfidenceStakeLimitPct" type="number" step="0.01" defaultValue={risk.highConfidenceStakeLimitPct} aria-label="高信心上限" />
              <Input name="parlayStakeLimitPct" type="number" step="0.01" defaultValue={risk.parlayStakeLimitPct} aria-label="串关上限" />
              <Input name="maxParlayLegs" type="number" step="1" defaultValue={risk.maxParlayLegs} aria-label="最大串关腿数" />
              <Input name="dailyLossLimitPct" type="number" step="0.01" defaultValue={risk.dailyLossLimitPct} aria-label="单日最大亏损" />
              <Button type="submit">保存风控</Button>
            </form>
          ))}
          <Table>
            <TableHeader><TableRow><TableHead>主体</TableHead><TableHead>单场</TableHead><TableHead>高信心</TableHead><TableHead>串关</TableHead><TableHead>legs</TableHead><TableHead>单日亏损</TableHead></TableRow></TableHeader>
            <TableBody>{risks.map((risk) => <TableRow key={risk.id}><TableCell>{risk.ownerActor}</TableCell><TableCell>{risk.singleStakeLimitPct}</TableCell><TableCell>{risk.highConfidenceStakeLimitPct}</TableCell><TableCell>{risk.parlayStakeLimitPct}</TableCell><TableCell>{risk.maxParlayLegs}</TableCell><TableCell>{risk.dailyLossLimitPct}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>系统设置</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Key</TableHead><TableHead>Value</TableHead><TableHead>备注</TableHead></TableRow></TableHeader>
            <TableBody>{settings.map((setting) => <TableRow key={setting.key}><TableCell>{setting.key}</TableCell><TableCell><form action={settingAction} className="flex gap-2"><input type="hidden" name="key" value={setting.key} /><Input name="value" defaultValue={setting.value} aria-label={setting.key} /><Button type="submit">保存</Button></form></TableCell><TableCell>{setting.notes}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
