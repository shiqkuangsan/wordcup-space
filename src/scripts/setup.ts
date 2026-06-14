import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const skipSync = args.has("--skip-sync");

function readEnvDatabaseUrl() {
  const envPath = path.join(repoRoot, ".env");
  if (!existsSync(envPath)) return process.env.DATABASE_URL ?? "local.db";
  const envText = readFileSync(envPath, "utf8");
  const match = envText.match(/^DATABASE_URL=(.+)$/m);
  return match?.[1]?.trim() || process.env.DATABASE_URL || "local.db";
}

function localDatabasePath() {
  const databaseUrl = readEnvDatabaseUrl();
  const filePath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
  return path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
}

function logStep(message: string) {
  console.log(`\n==> ${message}`);
}

function run(command: string, commandArgs: string[]) {
  console.log(`$ ${[command, ...commandArgs].join(" ")}`);
  if (dryRun) return;
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureEnv() {
  const envPath = path.join(repoRoot, ".env");
  const examplePath = path.join(repoRoot, ".env.example");
  if (existsSync(envPath)) {
    console.log(".env exists, skip copy.");
    return;
  }
  console.log("create .env from .env.example");
  if (!dryRun) copyFileSync(examplePath, envPath);
}

function main() {
  logStep("Prepare environment");
  ensureEnv();

  const dbPath = localDatabasePath();
  const hadDatabase = existsSync(dbPath);

  logStep("Run database migrations");
  run("pnpm", ["db:migrate"]);

  logStep("Seed default portfolios, platform account, risk profile, and app settings");
  if (hadDatabase && !force) {
    console.log(`database ${path.relative(repoRoot, dbPath)} already exists; seed is idempotent, running normally. Use --force only for future destructive setup modes.`);
  }
  run("pnpm", ["db:seed"]);

  if (!skipSync) {
    logStep("Sync World Cup fixtures");
    run("pnpm", ["sync:worldcup2026"]);
  }

  logStep("Verify repo-local Codex skills");
  run("pnpm", ["verify:skills"]);

  logStep("Done");
  console.log("Next commands:");
  console.log("- pnpm dev      # development server on 3107");
  console.log("- pnpm run run  # build and start local usage server on 3108");
}

main();
