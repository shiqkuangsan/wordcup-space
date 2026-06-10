import { expect, test } from "@playwright/test";

test("phase 1 happy path records and settles a Codex bet", async ({ page }) => {
  const runId = Date.now();
  const rationale = `E2E Codex 测试下注 ${runId}`;
  const ticket = `e2e-ticket-${runId}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "总览 Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "比赛中心" }).click();
  await expect(page.getByText("未完结赛程", { exact: true })).toBeVisible();
  await expect(page.getByText("已完结比赛", { exact: true })).toBeVisible();
  await expect(page.getByText("新增比赛")).toHaveCount(0);

  await page.getByRole("link", { name: "决策队列" }).click();
  const matchSelect = page.locator('select[name="matchId"]');
  const firstMatchValue = await matchSelect.locator("option").nth(1).getAttribute("value");
  expect(firstMatchValue).toBeTruthy();
  await matchSelect.selectOption(firstMatchValue ?? "");
  await page.locator('select[name="period"]').selectOption("full_time");
  await page.locator('select[name="market"]').selectOption("moneyline");
  await page.getByPlaceholder("选择，例如 阿根廷胜 / 大 2.5 / 第 1 球巴西").fill("主胜");
  await page.getByPlaceholder("预期金额").fill("10");
  await page.getByPlaceholder("预期总赔率").fill("1.9");
  await page.getByPlaceholder("决策理由").fill(rationale);
  await page.getByRole("button", { name: "保存 intent" }).click();
  await expect(page.getByText(rationale)).toBeVisible();

  await page.getByPlaceholder("平台注单号/确认备注").first().fill(ticket);
  await page.getByRole("button", { name: "标记执行成功并生成注单" }).first().click();
  await expect(page.getByText("已成交").first()).toBeVisible();

  await page.getByRole("link", { name: "注单中心" }).click();
  await expect(page.getByRole("cell", { name: ticket })).toBeVisible();
  const slipValue = await page
    .locator('select[name="betSlipId"] option')
    .filter({ hasText: ticket })
    .getAttribute("value");
  await page.locator('select[name="betSlipId"]').selectOption(slipValue ?? "");
  await page.getByPlaceholder("结算依据，例如 平台已结算/截图/比分来源").fill("E2E 结算");
  await page.getByRole("button", { name: "结算" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`赢.*${ticket}|${ticket}.*赢`) })).toBeVisible();

  await page.getByRole("link", { name: "资金账本" }).click();
  await expect(page.getByRole("cell", { name: "赢单结算" }).first()).toBeVisible();
});
