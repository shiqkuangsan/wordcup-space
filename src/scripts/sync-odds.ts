import { setTimeout as sleep } from "node:timers/promises";
import { syncReferenceOdds } from "@/server/actions/odds-sync";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runOnce() {
  const result = await syncReferenceOdds();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  const watch = process.argv.includes("--watch");
  const intervalMinutes = Number(readFlag("--interval-minutes") ?? "30");
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  if (!watch) {
    await runOnce();
    return;
  }

  while (true) {
    await runOnce();
    await sleep(intervalMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
