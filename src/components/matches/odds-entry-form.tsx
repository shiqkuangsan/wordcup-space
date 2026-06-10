import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addOddsSnapshot } from "@/server/actions/odds";

export function OddsEntryForm({ matchId }: { matchId: string }) {
  async function action(formData: FormData) {
    "use server";
    await addOddsSnapshot({
      matchId,
      bookmaker: String(formData.get("bookmaker")),
      market: String(formData.get("market")),
      selection: String(formData.get("selection")),
      line: String(formData.get("line") || ""),
      decimalOdds: Number(formData.get("decimalOdds")),
      capturedAt: String(formData.get("capturedAt") || new Date().toISOString()),
      createdBy: "user",
      sourceActor: "user",
      sourceType: "manual",
      sourceNote: String(formData.get("sourceNote") || ""),
    });
    revalidatePath(`/matches/${matchId}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>录入赔率</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 md:grid-cols-2">
          <Input name="bookmaker" placeholder="bookmaker，例如 bet365" required />
          <Input name="market" placeholder="市场，例如 1X2" required />
          <Input name="selection" placeholder="选择，例如 阿根廷胜 / 日本 +0.5" required />
          <Input name="line" placeholder="盘口线，可空" />
          <Input name="decimalOdds" type="number" step="0.01" placeholder="十进制赔率" required />
          <Input name="capturedAt" placeholder="捕获时间，默认当前" />
          <Input name="sourceNote" placeholder="来源备注" className="md:col-span-2" />
          <Button type="submit" className="md:col-span-2">
            保存赔率
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
