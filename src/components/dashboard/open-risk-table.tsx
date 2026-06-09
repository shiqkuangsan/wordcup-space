import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCny } from "@/domain/money";
import type { betSlips } from "@/db/schema";

type Slip = typeof betSlips.$inferSelect;

export function OpenRiskTable({ slips }: { slips: Slip[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>未结算风险</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>归属</TableHead>
              <TableHead>决策</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>赔率</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slips.map((slip) => (
              <TableRow key={slip.id}>
                <TableCell>{slip.portfolioId}</TableCell>
                <TableCell>{slip.decisionBy}</TableCell>
                <TableCell>{formatCny(slip.stakeCents)}</TableCell>
                <TableCell>{slip.finalOdds.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{slip.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {slips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  暂无未结算注单。
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
