import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const venvDir = path.join(repoRoot, ".agents", "sports-skills-venv");
const python = process.env.PYTHON ?? "python3";
const dryRun = process.argv.includes("--dry-run");

function run(command: string, args: string[], allowFailure = false) {
  console.log(`$ ${[command, ...args].join(" ")}`);
  if (dryRun) return 0;
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (!allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result.status ?? 0;
}

function venvBinary(name: string) {
  if (process.platform === "win32") return path.join(venvDir, "Scripts", `${name}.exe`);
  return path.join(venvDir, "bin", name);
}

function main() {
  if (!existsSync(venvDir)) {
    console.log("Create local sports-skills virtualenv.");
    run(python, ["-m", "venv", venvDir]);
  } else {
    console.log(".agents/sports-skills-venv already exists, reuse it.");
  }

  const pip = venvBinary("pip");
  const sportsSkills = venvBinary("sports-skills");

  console.log("Install sports-skills.");
  const pypiStatus = run(pip, ["install", "sports-skills"], true);
  if (pypiStatus !== 0) {
    console.log("PyPI install failed; fallback to GitHub.");
    run(pip, ["install", "git+https://github.com/machina-sports/sports-skills.git"]);
  }

  console.log("Verify sports-skills CLI.");
  run(sportsSkills, ["--help"]);
}

main();
