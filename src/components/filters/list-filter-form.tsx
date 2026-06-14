import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FilterOption = {
  value: string;
  label: string;
};

type FilterField = {
  name: string;
  label: string;
  value?: string;
  type?: "text" | "date" | "select";
  placeholder?: string;
  options?: FilterOption[];
};

export function ListFilterForm({
  action,
  fields,
  activeCount,
  layout = "default",
}: {
  action: string;
  fields: FilterField[];
  activeCount: number;
  layout?: "default" | "compact";
}) {
  return (
    <form action={action} method="get" className="grid gap-3 rounded-md border bg-background/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">筛选</span>
        <span className="text-xs text-muted-foreground">{activeCount} 个条件</span>
      </div>
      <div className={cn("grid gap-3", layout === "compact" ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-4")}>
        {fields.map((field) => (
          <label key={field.name} className="grid gap-1 text-xs text-muted-foreground">
            <span>{field.label}</span>
            {field.type === "select" ? (
              <select
                name={field.name}
                defaultValue={field.value ?? ""}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">全部</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                name={field.name}
                type={field.type ?? "text"}
                defaultValue={field.value ?? ""}
                placeholder={field.placeholder}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          <Search />
          查询
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={action}>
            <RotateCcw />
            重置
          </Link>
        </Button>
      </div>
    </form>
  );
}
