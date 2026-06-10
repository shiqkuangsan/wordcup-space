import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toCents } from "@/domain/money";
import { adjustPortfolioAllocation } from "@/server/actions/portfolios";

export function AllocationForm() {
  async function action(formData: FormData) {
    "use server";
    await adjustPortfolioAllocation({
      portfolioId: String(formData.get("portfolioId")) as "user" | "codex",
      entryType: String(formData.get("entryType")) as "allocation_top_up" | "allocation_withdrawal" | "adjustment",
      amountCents: toCents(Number(formData.get("amount"))),
      isRealMoney: formData.get("isRealMoney") !== "false",
      sourceActor: "user",
      notes: String(formData.get("notes")),
    });
    revalidatePath("/bankroll");
    revalidatePath("/");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>额度调整</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <Select name="portfolioId" defaultValue="codex">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="codex">Codex</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
          <Select name="entryType" defaultValue="allocation_top_up">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="allocation_top_up">追加额度</SelectItem>
              <SelectItem value="allocation_withdrawal">提取额度</SelectItem>
              <SelectItem value="adjustment">手工修正</SelectItem>
            </SelectContent>
          </Select>
          <Input name="amount" type="number" step="0.01" placeholder="金额" required />
          <Select name="isRealMoney" defaultValue="true">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">真实资金</SelectItem>
              <SelectItem value="false">模拟记录</SelectItem>
            </SelectContent>
          </Select>
          <Input name="notes" placeholder="备注" required />
          <Button type="submit" className="w-full">记录调整</Button>
        </form>
      </CardContent>
    </Card>
  );
}
