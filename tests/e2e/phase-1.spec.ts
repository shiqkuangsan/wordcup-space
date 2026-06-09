import { expect, test } from "@playwright/test";

test("phase 1 happy path records and settles a Codex bet", async ({ page }) => {
  const runId = Date.now();
  const homeTeam = `Argentina ${runId}`;
  const awayTeam = `Japan ${runId}`;
  const rationale = `E2E Codex 测试下注 ${runId}`;
  const ticket = `e2e-ticket-${runId}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "总览 Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "比赛中心" }).click();
  await page.getByPlaceholder("阶段，例如 group").fill("group");
  await page.getByPlaceholder("开球时间 ISO").fill("2026-06-12T20:00:00+08:00");
  await page.getByPlaceholder("主队").fill(homeTeam);
  await page.getByPlaceholder("客队").fill(awayTeam);
  await page.getByRole("button", { name: "保存比赛" }).click();
  await expect(page.getByRole("link", { name: `${homeTeam} vs ${awayTeam}` })).toBeVisible();

  await page.getByRole("link", { name: "决策队列" }).click();
  await page.getByPlaceholder("市场，例如 1X2").fill("1X2");
  await page.getByPlaceholder("选择，例如 Argentina").fill(homeTeam);
  await page.getByPlaceholder("预期金额").fill("10");
  await page.getByPlaceholder("预期总赔率").fill("1.9");
  await page.getByPlaceholder("决策理由").fill(rationale);
  await page.getByRole("button", { name: "保存 intent" }).click();
  await expect(page.getByText(rationale)).toBeVisible();

  await page.getByPlaceholder("平台注单号/确认备注").first().fill(ticket);
  await page.getByRole("button", { name: "标记执行成功并生成注单" }).first().click();
  await expect(page.getByText("executed").first()).toBeVisible();

  await page.getByRole("link", { name: "注单中心" }).click();
  await expect(page.getByRole("cell", { name: ticket })).toBeVisible();
  const slipValue = await page
    .locator('select[name="betSlipId"] option')
    .filter({ hasText: ticket })
    .getAttribute("value");
  await page.locator('select[name="betSlipId"]').selectOption(slipValue ?? "");
  await page.getByPlaceholder("赛果/结算来源").fill("E2E 结算");
  await page.getByRole("button", { name: "结算" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`won.*${ticket}|${ticket}.*won`) })).toBeVisible();

  await page.getByRole("link", { name: "资金账本" }).click();
  await expect(page.getByRole("cell", { name: "settlement_win" }).first()).toBeVisible();
});
