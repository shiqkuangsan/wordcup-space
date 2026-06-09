import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/db/client";
import { appSettings, platformAccounts, riskProfiles } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = getDb();
  const accounts = db.select().from(platformAccounts).all();
  const risks = db.select().from(riskProfiles).all();
  const settings = db.select().from(appSettings).all();

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>平台账户</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Provider</TableHead><TableHead>币种</TableHead></TableRow></TableHeader>
            <TableBody>{accounts.map((account) => <TableRow key={account.id}><TableCell>{account.id}</TableCell><TableCell>{account.provider}</TableCell><TableCell>{account.currency}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Codex 风控</CardTitle></CardHeader>
        <CardContent>
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
            <TableBody>{settings.map((setting) => <TableRow key={setting.key}><TableCell>{setting.key}</TableCell><TableCell>{setting.value}</TableCell><TableCell>{setting.notes}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
