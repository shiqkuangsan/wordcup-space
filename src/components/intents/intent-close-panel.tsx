"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const closeReasons = [
  { value: "expired_not_adopted", label: "过期未采纳" },
  { value: "user_cancelled", label: "取消，不再执行" },
  { value: "execution_failed", label: "执行失败" },
];

export function IntentClosePanel({
  intentId,
  defaultReason = "expired_not_adopted",
}: {
  intentId: string;
  defaultReason?: "expired_not_adopted" | "user_cancelled" | "execution_failed";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/intents/${encodeURIComponent(intentId)}/close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          closedReason: String(formData.get("closedReason") || defaultReason),
          closedNote: String(formData.get("closedNote") || "").trim(),
        }),
      });
      const json = await response.json();
      if (!json.ok) throw new Error(json.error || "关闭 intent 失败");
      router.refresh();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : String(closeError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">收口处理</div>
          <div className="text-xs text-muted-foreground">不会扣款，也不会创建注单；只把这条 intent 从待处理移出。</div>
        </div>
        <select name="closedReason" defaultValue={defaultReason} className="h-8 rounded-md border bg-background px-2 text-xs">
          {closeReasons.map((reason) => (
            <option key={reason.value} value={reason.value}>{reason.label}</option>
          ))}
        </select>
      </div>
      <Textarea name="closedNote" placeholder="备注，例如：赔率过期未执行 / 临场盘口变化，先不采纳" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="secondary" disabled={loading}>
          {loading ? "处理中..." : "标记未采纳"}
        </Button>
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </form>
  );
}
