"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCny } from "@/domain/money";
import type { betIntents, platformAccounts } from "@/db/schema";

type Intent = typeof betIntents.$inferSelect;
type PlatformAccount = typeof platformAccounts.$inferSelect;

type BetSlipPreview = {
  dryRun: boolean;
  writes: boolean;
  canCreate: boolean;
  slip: {
    stakeCents: number;
    finalOdds: number;
    potentialReturnCents: number;
    balanceAfterCents: number;
    isRealMoney: boolean;
    confirmationRef?: string;
  };
  attempt: {
    oddsChangePct: number;
    oddsTolerancePct: number;
  };
  warnings: string[];
};

type CreatedSlip = {
  slip: {
    id: string;
    stakeCents: number;
    finalOdds: number;
    confirmationRef?: string;
  };
};

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function IntentExecutionPanel({
  intent,
  platformAccounts,
}: {
  intent: Intent;
  platformAccounts: PlatformAccount[];
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<BetSlipPreview | null>(null);
  const [created, setCreated] = useState<CreatedSlip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"preview" | "create" | null>(null);
  const hasAccounts = platformAccounts.length > 0;
  const isExecutable = !["executed", "cancelled", "expired"].includes(intent.status);

  function payloadFromForm(form: HTMLFormElement, dryRun: boolean) {
    const formData = new FormData(form);
    const finalOdds = Number(formData.get("finalOdds"));
    const stake = Number(formData.get("stake"));
    const confirmationRef = String(formData.get("confirmationRef") || "").trim();

    return {
      dryRun,
      betIntentId: intent.id,
      platformAccountId: String(formData.get("platformAccountId") || ""),
      stake: Number.isFinite(stake) ? stake : intent.intendedStakeCents / 100,
      finalOdds: Number.isFinite(finalOdds) ? finalOdds : intent.intendedTotalOdds,
      observedOdds: Number.isFinite(finalOdds) ? finalOdds : intent.intendedTotalOdds,
      intendedOdds: intent.intendedTotalOdds,
      rawOdds: Number.isFinite(finalOdds) ? finalOdds : intent.intendedTotalOdds,
      oddsFormat: "decimal",
      executionMethod: "user_manual",
      confirmationRef,
      isRealMoney: formData.get("isRealMoney") !== "false",
      executionNotes: String(formData.get("executionNotes") || ""),
    };
  }

  async function submit(form: HTMLFormElement, action: "preview" | "create") {
    setLoadingAction(action);
    setError(null);
    setCreated(null);

    const payload = payloadFromForm(form, action === "preview");
    if (action === "create" && !payload.confirmationRef) {
      setLoadingAction(null);
      setError("确认创建 slip 前必须填写注单号/确认号。");
      return;
    }

    try {
      const response = await fetch("/api/bet-slips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!json.ok) throw new Error(json.error || "执行请求失败");

      if (action === "preview") {
        setPreview(json.data);
      } else {
        setPreview(null);
        setCreated(json.data);
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setLoadingAction(null);
    }
  }

  function onPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(event.currentTarget, "preview");
  }

  if (!isExecutable) {
    return <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">该 intent 已结束，不再显示执行入口。</div>;
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">执行预览</div>
        <Badge variant="outline">成交才扣款</Badge>
      </div>

      <form onSubmit={onPreview} className="grid gap-3 md:grid-cols-2">
        <select
          name="platformAccountId"
          disabled={!hasAccounts}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          {platformAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {account.provider}
            </option>
          ))}
          {!hasAccounts ? <option value="">先在设置里添加平台账户</option> : null}
        </select>
        <select name="isRealMoney" defaultValue="true" className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="true">真实资金</option>
          <option value="false">模拟记录</option>
        </select>
        <Input name="stake" type="number" step="0.01" defaultValue={(intent.intendedStakeCents / 100).toFixed(2)} placeholder="成交金额" />
        <Input name="finalOdds" type="number" step="0.01" defaultValue={intent.intendedTotalOdds.toFixed(2)} placeholder="最终赔率" />
        <Input name="confirmationRef" placeholder="注单号 / 确认号" className="md:col-span-2" />
        <Textarea name="executionNotes" placeholder="执行备注，可粘贴截图解析摘要" className="md:col-span-2" />
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" disabled={!hasAccounts || loadingAction !== null}>
            {loadingAction === "preview" ? "预览中..." : "预览执行"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!hasAccounts || loadingAction !== null}
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) void submit(form, "create");
            }}
          >
            {loadingAction === "create" ? "创建中..." : "确认创建 slip"}
          </Button>
        </div>
      </form>

      {error ? <div className="rounded border border-destructive/40 bg-background px-3 py-2 text-sm text-destructive">{error}</div> : null}

      {preview ? (
        <div className="space-y-2 rounded border bg-background px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{preview.canCreate ? "可创建 slip" : "需要复核"}</span>
            <span className="font-mono text-xs text-muted-foreground">writes {String(preview.writes)}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <div>金额：{formatCny(preview.slip.stakeCents)}</div>
            <div>赔率：{preview.slip.finalOdds.toFixed(2)}</div>
            <div>潜在返还：{formatCny(preview.slip.potentialReturnCents)}</div>
            <div>赔率变化：{pct(preview.attempt.oddsChangePct)}</div>
          </div>
          <div className="text-xs text-muted-foreground">成交后余额：{formatCny(preview.slip.balanceAfterCents)}</div>
          {preview.warnings.length ? (
            <div className="rounded border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
              {preview.warnings.join(" ")}
            </div>
          ) : null}
        </div>
      ) : null}

      {created ? (
        <div className="rounded border bg-background px-3 py-2 text-sm">
          已创建 slip：<span className="font-mono">{created.slip.id}</span>
        </div>
      ) : null}
    </div>
  );
}
