import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type SkillLock = {
  version: number;
  skills: Record<string, {
    source: string;
    sourceType: string;
    skillPath: string;
    computedHash: string;
  }>;
};

const repoRoot = process.cwd();
const lockPath = path.join(repoRoot, "skills-lock.json");

function sha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readLock() {
  return JSON.parse(readFileSync(lockPath, "utf8")) as SkillLock;
}

function referencedFiles(skillFilePath: string) {
  const skillDir = path.dirname(skillFilePath);
  const content = readFileSync(skillFilePath, "utf8");
  return Array.from(content.matchAll(/`(references\/[^`]+)`/g))
    .map((match) => path.join(skillDir, match[1]));
}

function main() {
  const lock = readLock();
  const failures: string[] = [];

  for (const [name, skill] of Object.entries(lock.skills)) {
    const skillFilePath = path.join(repoRoot, skill.skillPath);
    if (!existsSync(skillFilePath)) {
      failures.push(`${name}: missing skill file ${skill.skillPath}`);
      continue;
    }

    const actualHash = sha256(skillFilePath);
    if (actualHash !== skill.computedHash) {
      failures.push(`${name}: hash mismatch ${actualHash} != ${skill.computedHash}`);
    }

    for (const referencePath of referencedFiles(skillFilePath)) {
      if (!existsSync(referencePath)) {
        failures.push(`${name}: missing referenced file ${path.relative(repoRoot, referencePath)}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error("Codex skill verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`Verified ${Object.keys(lock.skills).length} Codex skills.`);
}

main();
