import { revalidatePath } from "next/cache";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { syncReferenceOdds } from "@/server/actions/odds-sync";

export function OddsSyncPanel() {
  async function action() {
    "use server";
    await syncReferenceOdds();
    revalidatePath("/matches");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>赔率同步</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>同步 FanDuel / bet365 参考盘口；已开赛比赛会自动跳过。</span>
        <form action={action}>
          <Button type="submit" variant="outline" size="sm">
            <RefreshCw />
            同步赔率
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
