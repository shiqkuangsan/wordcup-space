import { syncWorldCup2026Matches } from "@/server/actions/worldcup-sync";

async function main() {
  const result = await syncWorldCup2026Matches();

  console.log(
    JSON.stringify(
      {
        sourceName: result.sourceName,
        created: result.created,
        updated: result.updated,
        total: result.matchIds.length,
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
