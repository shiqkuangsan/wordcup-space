import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/db/client";
import { matches } from "@/db/schema";
import { validateBwPageTextForMatch } from "@/server/providers/bw-page-text";

type CaptureMethod = "auto" | "clipboard" | "applescript";

function readFlag(name: string) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1];
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function requireFlag(name: string) {
  const value = readFlag(name);
  if (!value) throw new Error(`missing required flag: ${name}`);
  return value;
}

function readMethod(): CaptureMethod {
  const value = readFlag("--method") ?? "auto";
  if (value !== "auto" && value !== "clipboard" && value !== "applescript") {
    throw new Error("--method must be auto, clipboard, or applescript");
  }
  return value;
}

function getMatch(matchId: string) {
  const match = getDb().select().from(matches).all().find((row) => row.id === matchId || String(row.matchNumber) === matchId);
  if (!match) throw new Error(`match not found: ${matchId}`);
  return match;
}

function localDateFromIso(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureViaClipboard(options: { keepClipboard: boolean }) {
  const originalClipboard = execFileSync("pbpaste", { encoding: "utf8" });
  execFileSync("osascript", [
    "-e",
    "tell application \"Google Chrome\" to activate",
    "-e",
    "delay 0.15",
    "-e",
    "tell application \"System Events\" to keystroke \"a\" using command down",
    "-e",
    "delay 0.15",
    "-e",
    "tell application \"System Events\" to keystroke \"c\" using command down",
  ], { stdio: "pipe" });
  await sleep(350);
  const text = execFileSync("pbpaste", { encoding: "utf8" });
  if (!options.keepClipboard) execFileSync("pbcopy", { input: originalClipboard });
  return text;
}

function captureViaAppleScript() {
  const javascript = `
    (() => {
      const title = document.title || "";
      const body = document.body ? document.body.innerText : "";
      return [title, body].filter(Boolean).join("\\n");
    })();
  `;
  const script = `tell application "Google Chrome" to execute active tab of front window javascript ${JSON.stringify(javascript)}`;
  return execFileSync("osascript", ["-e", script], { encoding: "utf8", stdio: "pipe" });
}

async function captureText(input: {
  method: CaptureMethod;
  homeTeam: string;
  awayTeam: string;
  allowUnmatched: boolean;
  keepClipboard: boolean;
}) {
  const attempts: Array<{ method: Exclude<CaptureMethod, "auto">; text?: string; error?: string }> = [];
  const orderedMethods = input.method === "auto" ? (["clipboard", "applescript"] as const) : ([input.method] as const);

  for (const method of orderedMethods) {
    try {
      const text = method === "clipboard"
        ? await captureViaClipboard({ keepClipboard: input.keepClipboard })
        : captureViaAppleScript();
      const validation = validateBwPageTextForMatch({ text, homeTeam: input.homeTeam, awayTeam: input.awayTeam });
      attempts.push({ method, text });
      if (validation.ok || input.allowUnmatched) return { method, text, validation, attempts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ method, error: message });
    }
  }

  const lastText = attempts.findLast((attempt) => attempt.text)?.text ?? "";
  const validation = validateBwPageTextForMatch({ text: lastText, homeTeam: input.homeTeam, awayTeam: input.awayTeam });
  const attemptSummary = attempts.map((attempt) => ({
    method: attempt.method,
    ok: Boolean(attempt.text),
    error: attempt.error ? sanitizeError(attempt.error) : undefined,
  }));
  const help = [
    "Chrome 当前页文本不像目标比赛详情页，已拒绝写入 fallback 文件。",
    "请确认 Chrome 激活页已经点进目标比赛详情页，并在盘口内容区域内点一下，再重跑命令。",
    "如果 clipboard 方式被系统拦截，请给 Terminal/Codex 授予辅助功能权限。",
    "如果要用 applescript 方式，需要在 Chrome 菜单：查看 > 开发者 > 允许 Apple 事件中的 JavaScript。",
  ].join("\n");
  throw new Error(`${help}\nvalidation=${JSON.stringify(validation)}\nattempts=${JSON.stringify(attemptSummary)}`);
}

function sanitizeError(message: string) {
  return message
    .replace(/https?:\/\/\S+/g, "[url-redacted]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[token-redacted]");
}

async function main() {
  const matchId = requireFlag("--match-id");
  const method = readMethod();
  const allowUnmatched = process.argv.includes("--allow-unmatched");
  const keepClipboard = process.argv.includes("--keep-clipboard");
  const match = getMatch(matchId);
  const localDate = readFlag("--date") ?? localDateFromIso(match.kickoffAt);
  const outputDir = readFlag("--output-dir") ?? join("tmp", "bw-odds", localDate);
  const fileName = readFlag("--file-name") ?? `${match.matchNumber ?? match.id}.txt`;

  const captured = await captureText({
    method,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    allowUnmatched,
    keepClipboard,
  });
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, fileName);
  writeFileSync(outputPath, captured.text, "utf8");

  console.log(JSON.stringify({
    match: {
      id: match.id,
      matchNumber: match.matchNumber,
      title: `${match.homeTeam} vs ${match.awayTeam}`,
      kickoffAt: match.kickoffAt,
    },
    method: captured.method,
    outputPath,
    validation: captured.validation,
    nextDryRun: `pnpm sync:match-odds -- --date ${localDate} --scope common --fallback-text-dir ${outputDir}`,
    nextWrite: `pnpm sync:match-odds -- --date ${localDate} --scope common --fallback-text-dir ${outputDir} --write`,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(sanitizeError(message));
  process.exit(1);
});
