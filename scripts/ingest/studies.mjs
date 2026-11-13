// Reading a checkout of alexarchpublic/case-studies: the studies, their
// scenarios, each scenario's source screenshots (TR2) and its hash (TR4).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fingerprintInput, sourceKind } from "../../lib/pipeline.bundle.js";

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function loadStudies(root) {
  const dir = join(root, "content");
  return readdirSync(dir)
    .filter((slug) => existsSync(join(dir, slug, "case-study.json")))
    .sort()
    .map((slug) => ({ dir: join(dir, slug), study: JSON.parse(readFileSync(join(dir, slug, "case-study.json"), "utf8")) }));
}

/** content/<slug>/sources/<key>/: { kind: { file, path, sha256, bytes } }, unknown files listed apart. */
export function scenarioSources(studyDir, key) {
  const dir = join(studyDir, "sources", key);
  const files = {};
  const unknown = [];
  if (!key || !existsSync(dir) || !statSync(dir).isDirectory()) return { dir, files, unknown };
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (!statSync(path).isFile() || name.startsWith(".")) continue;
    const kind = sourceKind(name);
    if (!kind) {
      unknown.push(name);
      continue;
    }
    const buf = readFileSync(path);
    files[kind] = { file: name, path, sha256: sha256(buf), bytes: buf.length };
  }
  return { dir, files, unknown };
}

export function scenarioHash(scenario, files) {
  const hashes = Object.fromEntries(Object.entries(files).map(([kind, f]) => [kind, f.sha256]));
  return sha256(fingerprintInput(scenario, hashes));
}

/** Slugs whose content changed between two commits (TR1's push fallback). */
export function changedSlugs(root, since, until = "HEAD") {
  const out = execFileSync("git", ["-C", root, "diff", "--name-only", since, until, "--", "content/"], { encoding: "utf8" });
  return [...new Set(out.split("\n").map((l) => l.split("/")[1]).filter(Boolean))];
}

export function headCommit(root) {
  try {
    return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "uncommitted";
  }
}
