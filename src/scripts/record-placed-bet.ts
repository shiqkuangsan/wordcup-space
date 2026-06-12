import { readFileSync } from "node:fs";
import { buildPlacedBetPreview, createPlacedBetFromDraft } from "@/server/api/placed-bets";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readPayloadText() {
  const inputPath = readFlag("--input");
  const jsonArg = readFlag("--json");

  if (inputPath) return readFileSync(inputPath, "utf8");
  if (jsonArg) return jsonArg;
  if (!process.stdin.isTTY) return readFileSync(0, "utf8");

  throw new Error(
    "Provide a placed bet payload with --input <file>, --json '<json>', or stdin.",
  );
}

function printUsage() {
  console.log(`Usage:
  pnpm record:placed-bet -- --input payload.json
  pnpm record:placed-bet -- --input payload.json --write
  pnpm record:placed-bet -- --json '{"portfolioId":"user",...}'

Default mode is dry-run. Use --write only after the user confirms the preview.`);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const payload = JSON.parse(readPayloadText()) as Record<string, unknown>;
  const shouldWrite = process.argv.includes("--write");
  const result = shouldWrite
    ? createPlacedBetFromDraft({ ...payload, dryRun: false })
    : buildPlacedBetPreview({ ...payload, dryRun: true });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
