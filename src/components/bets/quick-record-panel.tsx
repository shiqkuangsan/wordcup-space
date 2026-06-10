"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BET_PERIOD_OPTIONS, MARKET_TYPE_OPTIONS } from "@/domain/betting-markets";
import { formatBetModeLabel, formatBetSlipStatus, formatDecisionByLabel } from "@/domain/display-labels";
import { formatCny } from "@/domain/money";
import { SETTLEMENT_RESULT_OPTIONS } from "@/domain/settlement";
import { formatMatchTitle } from "@/domain/team-names";
import type { betIntents, betSlips, matches, platformAccounts } from "@/db/schema";

type BetIntent = typeof betIntents.$inferSelect;
type BetSlip = typeof betSlips.$inferSelect;
type PlatformAccount = typeof platformAccounts.$inferSelect;
type Match = typeof matches.$inferSelect;

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type BetSlipPreview = {
  canCreate: boolean;
  slip: {
    stakeCents: number;
    finalOdds: number;
    potentialReturnCents: number;
    isRealMoney: boolean;
    balanceAfterCents: number;
  };
  attempt: {
    oddsChangePct: number;
    oddsTolerancePct: number;
  };
  warnings: string[];
};

type SettlementPreview = {
  canSettle: boolean;
  settlement: {
    result: string;
    payoutCents: number;
    profitLossCents: number;
    balanceAfterCents: number;
  };
  warnings: string[];
};

type PlacedBetPreview = {
  canCreate: boolean;
  match: {
    title: string;
    kickoffAt: string;
  };
  slip: {
    stakeCents: number;
    finalOdds: number;
    potentialReturnCents: number;
    balanceAfterCents: number;
  };
  attempt: {
    oddsChangePct: number;
    oddsTolerancePct: number;
  };
  warnings: string[];
};

type Props = {
  executableIntents: BetIntent[];
  openSlips: BetSlip[];
  platformAccounts: PlatformAccount[];
  matches: Match[];
};

const inputClass = "h-9 w-full rounded-md border bg-background px-3 text-sm";

function stableKey(payload: Record<string, unknown>) {
  return JSON.stringify(payload);
}

function yuanToCents(value: FormDataEntryValue | null) {
  return Math.round(Number(value) * 100);
}

function pct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function intentLabel(intent: BetIntent) {
  return `${formatDecisionByLabel(intent.decisionBy)} · ${formatBetModeLabel(intent.mode)} · ${formatCny(intent.intendedStakeCents)} @ ${intent.intendedTotalOdds}`;
}

function slipLabel(slip: BetSlip) {
  return `${formatDecisionByLabel(slip.decisionBy)} · ${formatBetModeLabel(slip.mode)} · ${formatCny(slip.stakeCents)} @ ${slip.finalOdds} · ${formatBetSlipStatus(slip.status)}`;
}

async function postJson<T>(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.ok) {
    throw new Error(body.error || "请求失败");
  }

  return body.data as T;
}

function PreviewAlert({
  title,
  lines,
  warnings,
}: {
  title: string;
  lines: string[];
  warnings?: string[];
}) {
  return (
    <Alert variant={warnings?.length ? "destructive" : "default"}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div className="space-y-1">
          {lines.map((line) => <p key={line}>{line}</p>)}
          {warnings?.map((warning) => <p key={warning}>警告：{warning}</p>)}
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function QuickRecordPanel({ executableIntents, openSlips, platformAccounts, matches }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [placedPreview, setPlacedPreview] = useState<PlacedBetPreview | null>(null);
  const [placedPreviewKey, setPlacedPreviewKey] = useState("");
  const [betPreview, setBetPreview] = useState<BetSlipPreview | null>(null);
  const [betPreviewKey, setBetPreviewKey] = useState("");
  const [settlementPreview, setSettlementPreview] = useState<SettlementPreview | null>(null);
  const [settlementPreviewKey, setSettlementPreviewKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const defaultIntentId = executableIntents[0]?.id ?? "";
  const defaultSlipId = openSlips[0]?.id ?? "";

  const platformOptions = useMemo(() => platformAccounts.filter((account) => account.isActive), [platformAccounts]);
  const defaultPlatformId = platformOptions[0]?.id ?? "";

  function buildMarket(formData: FormData) {
    return `${String(formData.get("period") || "full_time")}:${String(formData.get("marketType") || "moneyline")}`;
  }

  function buildPlacedPayload(formData: FormData, dryRun: boolean) {
    const finalOdds = Number(formData.get("finalOdds"));
    return {
      dryRun,
      portfolioId: String(formData.get("portfolioId") || "user"),
      decisionBy: String(formData.get("decisionBy") || "user"),
      mode: String(formData.get("mode") || "single"),
      matchId: String(formData.get("matchId") || ""),
      matchText: String(formData.get("matchText") || ""),
      market: buildMarket(formData),
      selection: String(formData.get("selection") || ""),
      line: String(formData.get("line") || ""),
      stakeCents: yuanToCents(formData.get("stake")),
      finalOdds,
      oddsFormat: String(formData.get("oddsFormat") || "decimal"),
      intendedOdds: Number(formData.get("intendedOdds") || finalOdds),
      observedOdds: Number(formData.get("observedOdds") || finalOdds),
      riskTier: String(formData.get("riskTier") || "normal"),
      confidence: String(formData.get("confidence") || "medium"),
      platformAccountId: String(formData.get("platformAccountId") || ""),
      executionMethod: String(formData.get("executionMethod") || "user_manual"),
      confirmationRef: String(formData.get("confirmationRef") || ""),
      confirmationScreenshotPath: String(formData.get("confirmationScreenshotPath") || ""),
      sourceText: String(formData.get("sourceText") || ""),
      rationale: String(formData.get("rationale") || formData.get("sourceText") || "已成交截图直录。"),
      isRealMoney: formData.get("isRealMoney") === "on",
    };
  }

  function buildBetPayload(formData: FormData, dryRun: boolean) {
    const finalOdds = Number(formData.get("finalOdds"));
    return {
      dryRun,
      betIntentId: String(formData.get("betIntentId") || ""),
      platformAccountId: String(formData.get("platformAccountId") || ""),
      executionMethod: String(formData.get("executionMethod") || "user_manual"),
      stakeCents: yuanToCents(formData.get("stake")),
      finalOdds,
      oddsFormat: String(formData.get("oddsFormat") || "decimal"),
      observedOdds: Number(formData.get("observedOdds") || finalOdds),
      confirmationRef: String(formData.get("confirmationRef") || ""),
      confirmationScreenshotPath: String(formData.get("confirmationScreenshotPath") || ""),
      executionNotes: String(formData.get("executionNotes") || ""),
      isRealMoney: formData.get("isRealMoney") === "on",
    };
  }

  function buildSettlementPayload(formData: FormData, dryRun: boolean) {
    const result = String(formData.get("result") || "won");
    const cashoutAmount = formData.get("cashoutAmount");
    return {
      dryRun,
      betSlipId: String(formData.get("betSlipId") || ""),
      result,
      cashoutAmountCents: result === "cashout" && cashoutAmount ? yuanToCents(cashoutAmount) : undefined,
      sourceNote: String(formData.get("sourceNote") || ""),
      settledBy: String(formData.get("settledBy") || "user"),
    };
  }

  function resetMessages() {
    setError("");
    setSuccess("");
  }

  function handlePlacedPreview(formData: FormData) {
    resetMessages();
    const payload = buildPlacedPayload(formData, true);
    const key = stableKey(payload);
    startTransition(async () => {
      try {
        const preview = await postJson<PlacedBetPreview>("/api/placed-bets", payload);
        setPlacedPreview(preview);
        setPlacedPreviewKey(key);
      } catch (err) {
        setPlacedPreview(null);
        setPlacedPreviewKey("");
        setError(err instanceof Error ? err.message : "预览失败");
      }
    });
  }

  function handlePlacedConfirm(formData: FormData) {
    resetMessages();
    const previewPayload = buildPlacedPayload(formData, true);
    if (stableKey(previewPayload) !== placedPreviewKey || !placedPreview?.canCreate) {
      setError("请先生成最新预览，确认无警告后再写入。");
      return;
    }

    const payload = buildPlacedPayload(formData, false);
    startTransition(async () => {
      try {
        await postJson("/api/placed-bets", payload);
        setSuccess("已成交截图已写入，系统已生成决策、执行记录、注单和资金流水。");
        setPlacedPreview(null);
        setPlacedPreviewKey("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "写入失败");
      }
    });
  }

  function getFormData(button: HTMLButtonElement) {
    if (!button.form) throw new Error("form not found");
    return new FormData(button.form);
  }

  function handleBetPreview(formData: FormData) {
    resetMessages();
    const payload = buildBetPayload(formData, true);
    const key = stableKey(payload);
    startTransition(async () => {
      try {
        const preview = await postJson<BetSlipPreview>("/api/bet-slips", payload);
        setBetPreview(preview);
        setBetPreviewKey(key);
      } catch (err) {
        setBetPreview(null);
        setBetPreviewKey("");
        setError(err instanceof Error ? err.message : "预览失败");
      }
    });
  }

  function handleBetConfirm(formData: FormData) {
    resetMessages();
    const previewPayload = buildBetPayload(formData, true);
    if (stableKey(previewPayload) !== betPreviewKey || !betPreview?.canCreate) {
      setError("请先生成最新预览，确认无警告后再写入。");
      return;
    }

    const payload = buildBetPayload(formData, false);
    startTransition(async () => {
      try {
        await postJson("/api/bet-slips", payload);
        setSuccess("成交注单已写入，资金已按 stake 扣减。");
        setBetPreview(null);
        setBetPreviewKey("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "写入失败");
      }
    });
  }

  function handleSettlementPreview(formData: FormData) {
    resetMessages();
    const payload = buildSettlementPayload(formData, true);
    const key = stableKey(payload);
    startTransition(async () => {
      try {
        const preview = await postJson<SettlementPreview>("/api/settlements", payload);
        setSettlementPreview(preview);
        setSettlementPreviewKey(key);
      } catch (err) {
        setSettlementPreview(null);
        setSettlementPreviewKey("");
        setError(err instanceof Error ? err.message : "预览失败");
      }
    });
  }

  function handleSettlementConfirm(formData: FormData) {
    resetMessages();
    const previewPayload = buildSettlementPayload(formData, true);
    if (stableKey(previewPayload) !== settlementPreviewKey || !settlementPreview?.canSettle) {
      setError("请先生成最新预览，确认资金影响后再写入。");
      return;
    }

    const payload = buildSettlementPayload(formData, false);
    startTransition(async () => {
      try {
        await postJson("/api/settlements", payload);
        setSuccess("结算已写入，资金账本已更新。");
        setSettlementPreview(null);
        setSettlementPreviewKey("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "写入失败");
      }
    });
  }

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>快速处理台</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>操作未完成</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {success ? (
          <Alert>
            <AlertTitle>已写入</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="placed-bet">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="placed-bet">直录</TabsTrigger>
            <TabsTrigger value="bet-slip">成交</TabsTrigger>
            <TabsTrigger value="settlement">结算</TabsTrigger>
          </TabsList>

          <TabsContent value="placed-bet" className="space-y-3">
            <form
              className="space-y-3"
              onChange={() => {
                setPlacedPreview(null);
                setPlacedPreviewKey("");
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                <select name="portfolioId" defaultValue="user" className={inputClass}>
                  <option value="user">User 账本</option>
                  <option value="codex">Codex 账本</option>
                </select>
                <select name="decisionBy" defaultValue="user" className={inputClass}>
                  <option value="user">User 决策</option>
                  <option value="codex">Codex 决策</option>
                </select>
              </div>
              <select name="matchId" className={inputClass}>
                <option value="">选择比赛</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>{formatMatchTitle(match.homeTeam, match.awayTeam)}</option>
                ))}
              </select>
              <Input name="matchText" placeholder="非世界杯比赛文本，例如 英超 A队 vs B队" />
              <div className="grid grid-cols-2 gap-2">
                <select name="period" defaultValue="full_time" className={inputClass}>
                  {BET_PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select name="marketType" defaultValue="highest_scoring_half" className={inputClass}>
                  {MARKET_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <select name="mode" defaultValue="single" className={inputClass}>
                <option value="single">单场</option>
                <option value="parlay">串关</option>
              </select>
              <Input name="selection" placeholder="选择，例如 下半场 / 主胜 / 大 2.5" required />
              <Input name="line" placeholder="盘口线，例如 -0.5 / 2.5 / 第1球，可空" />
              <div className="grid grid-cols-2 gap-2">
                <Input name="stake" type="number" step="0.01" min="0" placeholder="成交金额" required />
                <Input name="finalOdds" type="number" step="0.01" min="0" placeholder="成交赔率" required />
              </div>
              <select name="oddsFormat" defaultValue="decimal" className={inputClass}>
                <option value="decimal">欧盘</option>
                <option value="hong_kong">港盘</option>
              </select>
              <Input name="intendedOdds" type="number" step="0.01" min="0" placeholder="决策/观察赔率，可空" />
              <select name="platformAccountId" defaultValue={defaultPlatformId} className={inputClass} required>
                <option value="">选择平台账户</option>
                {platformOptions.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
              <select name="executionMethod" defaultValue="user_manual" className={inputClass}>
                <option value="user_manual">User 手机下单</option>
                <option value="chrome">Codex 操作 Chrome</option>
                <option value="computer_use">Codex 操作 Computer Use</option>
                <option value="browser_capture">浏览器读取后记录</option>
              </select>
              <Input name="confirmationRef" placeholder="注单号/确认号" required />
              <Input name="confirmationScreenshotPath" placeholder="截图路径，可空" />
              <Textarea name="sourceText" placeholder="原始口述或截图解析结果" />
              <Textarea name="rationale" placeholder="决策理由，可空" />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input name="isRealMoney" type="checkbox" defaultChecked className="size-4 accent-foreground" />
                真实资金
              </label>
              {placedPreview ? (
                <PreviewAlert
                  title={placedPreview.canCreate ? "直录预览可写入" : "直录预览需复核"}
                  lines={[
                    `比赛：${placedPreview.match.title}`,
                    `扣款：${formatCny(placedPreview.slip.stakeCents)}`,
                    `最高返还：${formatCny(placedPreview.slip.potentialReturnCents)}`,
                    `余额变更后：${formatCny(placedPreview.slip.balanceAfterCents)}`,
                    `赔率变化：${pct(placedPreview.attempt.oddsChangePct)} / 容忍：${pct(placedPreview.attempt.oddsTolerancePct)}`,
                  ]}
                  warnings={placedPreview.warnings}
                />
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending}
                  onClick={(event) => handlePlacedPreview(getFormData(event.currentTarget))}
                >
                  预览
                </Button>
                <Button
                  type="button"
                  disabled={isPending || !placedPreview?.canCreate}
                  onClick={(event) => handlePlacedConfirm(getFormData(event.currentTarget))}
                >
                  确认写入
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="bet-slip" className="space-y-3">
            <form
              className="space-y-3"
              onChange={() => {
                setBetPreview(null);
                setBetPreviewKey("");
              }}
            >
              <select name="betIntentId" defaultValue={defaultIntentId} className={inputClass} required>
                <option value="">选择待执行决策</option>
                {executableIntents.map((intent) => (
                  <option key={intent.id} value={intent.id}>{intentLabel(intent)}</option>
                ))}
              </select>
              <select name="platformAccountId" defaultValue={defaultPlatformId} className={inputClass} required>
                <option value="">选择平台账户</option>
                {platformOptions.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
              <select name="executionMethod" defaultValue="user_manual" className={inputClass}>
                <option value="user_manual">User 代下单</option>
                <option value="chrome">Codex 操作 Chrome</option>
                <option value="computer_use">Codex 操作 Computer Use</option>
                <option value="browser_capture">浏览器读取后记录</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Input name="stake" type="number" step="0.01" min="0" placeholder="成交金额" required />
                <Input name="finalOdds" type="number" step="0.01" min="0" placeholder="成交赔率" required />
              </div>
              <select name="oddsFormat" defaultValue="decimal" className={inputClass}>
                <option value="decimal">欧盘</option>
                <option value="hong_kong">港盘</option>
              </select>
              <Input name="observedOdds" type="number" step="0.01" min="0" placeholder="观察赔率，可空" />
              <Input name="confirmationRef" placeholder="注单号/确认号" />
              <Input name="confirmationScreenshotPath" placeholder="截图路径，可空" />
              <Textarea name="executionNotes" placeholder="原始口述或截图备注" />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input name="isRealMoney" type="checkbox" defaultChecked className="size-4 accent-foreground" />
                真实资金
              </label>
              {betPreview ? (
                <PreviewAlert
                  title={betPreview.canCreate ? "成交预览可写入" : "成交预览需复核"}
                  lines={[
                    `扣款：${formatCny(betPreview.slip.stakeCents)}`,
                    `最高返还：${formatCny(betPreview.slip.potentialReturnCents)}`,
                    `余额变更后：${formatCny(betPreview.slip.balanceAfterCents)}`,
                    `赔率变化：${pct(betPreview.attempt.oddsChangePct)} / 容忍：${pct(betPreview.attempt.oddsTolerancePct)}`,
                  ]}
                  warnings={betPreview.warnings}
                />
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending || !defaultIntentId}
                  onClick={(event) => handleBetPreview(getFormData(event.currentTarget))}
                >
                  预览
                </Button>
                <Button
                  type="button"
                  disabled={isPending || !betPreview?.canCreate}
                  onClick={(event) => handleBetConfirm(getFormData(event.currentTarget))}
                >
                  确认写入
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="settlement" className="space-y-3">
            <form
              className="space-y-3"
              onChange={() => {
                setSettlementPreview(null);
                setSettlementPreviewKey("");
              }}
            >
              <select name="betSlipId" defaultValue={defaultSlipId} className={inputClass} required>
                <option value="">选择未结算注单</option>
                {openSlips.map((slip) => (
                  <option key={slip.id} value={slip.id}>{slipLabel(slip)}</option>
                ))}
              </select>
              <select name="result" defaultValue="won" className={inputClass}>
                {SETTLEMENT_RESULT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <Input name="cashoutAmount" type="number" step="0.01" min="0" placeholder="提前兑现到账金额" />
              <select name="settledBy" defaultValue="user" className={inputClass}>
                <option value="user">User 记录</option>
                <option value="codex">Codex 记录</option>
              </select>
              <Textarea name="sourceNote" placeholder="结算依据，例如 平台已结算/截图/比分来源" required />
              {settlementPreview ? (
                <PreviewAlert
                  title="结算预览可写入"
                  lines={[
                    `返还入账：${formatCny(settlementPreview.settlement.payoutCents)}`,
                    `本单盈亏：${formatCny(settlementPreview.settlement.profitLossCents)}`,
                    `余额变更后：${formatCny(settlementPreview.settlement.balanceAfterCents)}`,
                  ]}
                  warnings={settlementPreview.warnings}
                />
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isPending || !defaultSlipId}
                  onClick={(event) => handleSettlementPreview(getFormData(event.currentTarget))}
                >
                  预览
                </Button>
                <Button
                  type="button"
                  disabled={isPending || !settlementPreview?.canSettle}
                  onClick={(event) => handleSettlementConfirm(getFormData(event.currentTarget))}
                >
                  确认写入
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
