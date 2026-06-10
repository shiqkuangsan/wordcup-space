import { syncWorldCup2026ApiMatches } from "@/server/actions/worldcup2026-api-sync";

async function main() {
  const result = await syncWorldCup2026ApiMatches();

  console.log(
    JSON.stringify(
      {
        sourceName: result.sourceName,
        created: result.created,
        updated: result.updated,
        total: result.matchIds.length,
        resultSnapshots: result.results.length,
        warnings: result.warnings,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
