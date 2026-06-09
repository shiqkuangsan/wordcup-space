import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCny } from "@/domain/money";

type PortfolioSummaryProps = {
  title: string;
  balanceCents: number;
  subtitle: string;
};

export function PortfolioSummary({ title, balanceCents, subtitle }: PortfolioSummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-2xl font-semibold">{formatCny(balanceCents)}</div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
