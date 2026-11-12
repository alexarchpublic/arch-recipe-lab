#!/usr/bin/env node
// The case study pipeline (auto-ingestion PRD, Phase 3: dry run). Four steps,
// each its own command so the workflow can give each one only the secrets it
// needs (EX3):
//
//   plan    which scenarios to read, from a case-studies checkout and the store
//           (STORE_URL, STORE_ANON_KEY; PIPELINE_* to read stored hashes)
//   read    Claude reads the screenshots and writes the names. No store
//           credentials: everything it needs is in the run folder.
//   write   saves drafts to staging as the pipeline account. No Claude token.
//   report  the run report (GR4), as Markdown, plus the settings comparison
//           that is Phase 3's acceptance test.
//
//   node scripts/ingest/run.mjs plan --case-studies ../case-studies --out runs/x [--slug msft,aapl] [--since <sha>] [--keys msft/full-cycle,...] [--compare] [--state]
//   node scripts/ingest/run.mjs read --run runs/x [--parallel 2] [--keys slug/key,...] [--redo | --naming-only]
//   node scripts/ingest/run.mjs write --run runs/x
//   node scripts/ingest/run.mjs report --run runs/x
//
// Nothing here publishes. Publishing and the number write-back are Phase 4.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  NAMING_JSON_SCHEMA,
  NAMING_PROMPT_VERSION,
  PIPELINE_VERSION,
  PROMPT_VERSION,
  RECIPE_SCREENSHOT_EXTRACTION_PROMPT,
  SOURCE_FILES,
  buildRecipeFromExtraction,
  checkScenario,
  compareSettings,
  draftFields,
  fallbackTitle,
  holds,
  namingProblems,
  namingPrompt,
  plainAssetName,
  planScenario,
  scenarioFigures,
  settingsSummary,
  validateExtractionShape,
} from "../../lib/pipeline.bundle.js";
import { DEFAULT_MODEL, answeringModel, jsonFromText, runClaude, withRetry } from "./claude.mjs";
import { changedSlugs, headCommit, loadStudies, scenarioHash, scenarioSources } from "./studies.mjs";

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[k] = true;
      else (out[k] = next), i++;
    } else out._.push(a);
  }
  return out;
}

const log = (...m) => console.error(new Date().toISOString().slice(11, 19), ...m);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const itemFile = (run, it) => join(run, "scenarios", `${it.slug}__${it.key}.json`);
const list = (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

// ---------------------------------------------------------------------------
async function plan(a) {
  const root = resolve(a["case-studies"] ?? "../case-studies");
  const run = resolve(a.out ?? `runs/${new Date().toISOString().replace(/[:.]/g, "-")}`);
  mkdirSync(join(run, "scenarios"), { recursive: true });

  let slugs = list(a.slug);
  if (a.since) slugs = [...new Set([...slugs, ...changedSlugs(root, a.since)])];
  const keys = new Set(list(a.keys));
  const studies = loadStudies(root).filter(({ study }) => !slugs.length || slugs.includes(study.slug));

  let live = [];
  if (process.env.STORE_URL && process.env.STORE_ANON_KEY) {
    const { liveStrategies } = await import("./store.mjs");
    live = await liveStrategies();
  } else log("STORE_URL/STORE_ANON_KEY not set: no live titles for the uniqueness rule, no comparison.");

  let stateClient = null;
  if (a.state) {
    const { pipelineClient } = await import("./store.mjs");
    stateClient = await pipelineClient();
  }

  const items = [];
  for (const { dir, study } of studies) {
    let state = {};
    if (stateClient) {
      const { scenarioState } = await import("./store.mjs");
      state = await scenarioState(stateClient, study.slug);
    }
    for (const scenario of study.scenarios ?? []) {
      if (keys.size && !keys.has(`${study.slug}/${scenario.key}`)) continue;
      const src = scenarioSources(dir, scenario.key);
      const hash = scenarioHash(scenario, src.files);
      const stored = state[scenario.key] ?? {};
      const p = planScenario({
        study, scenario, hash,
        storedHash: stored.draft_hash ?? stored.ref_hash ?? null,
        hasSources: Object.keys(src.files).length > 0,
      });
      items.push({
        ...p,
        hash,
        sourceDir: src.dir,
        sources: src.files,
        unknownFiles: src.unknown,
        studyDir: dir,
      });
    }
  }
  const runInfo = {
    pipelineVersion: PIPELINE_VERSION,
    promptVersion: PROMPT_VERSION,
    namingPromptVersion: NAMING_PROMPT_VERSION,
    model: DEFAULT_MODEL,
    caseStudies: root,
    commit: a.commit ?? headCommit(root),
    createdAt: new Date().toISOString(),
    mode: "dry-run",
    compare: !!a.compare,
    liveTitles: live.map((s) => ({ number: s.display_number, title: s.title })),
    stored: a.compare
      ? Object.fromEntries(live.map((s) => [s.display_number, s]))
      : {},
    items,
  };
  writeJson(join(run, "run.json"), runInfo);
  const counts = items.reduce((c, it) => ((c[it.action] = (c[it.action] ?? 0) + 1), c), {});
  log(`planned ${items.length} scenarios in ${studies.length} studies:`, JSON.stringify(counts), "->", run);
  console.log(run);
}

// ---------------------------------------------------------------------------
async function readOne(runInfo, it, previous = null) {
  const study = readJson(join(it.studyDir, "case-study.json"));
  const scenario = (study.scenarios ?? []).find((s) => s.key === it.key);
  const out = { item: it, startedAt: new Date().toISOString() };
  const sourceKinds = Object.keys(it.sources);

  // Claude sees copies of the screenshots, named by kind, in a folder of their own.
  const work = mkdtempSync(join(tmpdir(), "ingest-"));
  const order = ["chart", "settings", "stats", "dca"].filter((k) => it.sources[k]);
  order.forEach((k) => copyFileSync(it.sources[k].path, join(work, SOURCE_FILES[k])));
  const names = order.map((k) => SOURCE_FILES[k]);

  let extraction = null;
  let result = null;
  let schemaErrors = [];
  let readError = null;
  if (previous?.parsed) {
    // --naming-only: keep the earlier reading, redo the checks and the naming.
    out.reading = previous.reading;
    extraction = JSON.parse(JSON.stringify(previous.parsed));
    out.parsed = previous.parsed;
    schemaErrors = validateExtractionShape(extraction);
    if (!Array.isArray(extraction.imageKinds) || extraction.imageKinds.length !== order.length) extraction.imageKinds = order;
    result = buildRecipeFromExtraction(extraction);
    rmSync(work, { recursive: true, force: true });
  } else try {
    const prompt = `${RECIPE_SCREENSHOT_EXTRACTION_PROMPT}\n\nThe screenshots are the files ${names.join(", ")} in the current folder, in that order. Read each one with the Read tool before answering. Reply with the JSON object only.`;
    const env = await withRetry(() => runClaude({ prompt, cwd: work, tools: ["Read"], maxTurns: 10 }), { log: (m) => log(it.slug, it.key, m) });
    out.reading = {
      model: answeringModel(env, DEFAULT_MODEL),
      durationMs: env.duration_ms,
      turns: env.num_turns,
      notionalCostUsd: env.total_cost_usd,
      rawOutput: env.result,
    };
    extraction = jsonFromText(env.result);
    out.parsed = JSON.parse(JSON.stringify(extraction));
    schemaErrors = validateExtractionShape(extraction);
    // The files are named by kind, so their order is the kinds (as the admin screen does).
    if (!Array.isArray(extraction.imageKinds) || extraction.imageKinds.length !== order.length) extraction.imageKinds = order;
    result = buildRecipeFromExtraction(extraction);
  } catch (e) {
    readError = e.message;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  out.schemaErrors = schemaErrors;
  out.result = result;
  out.findings = checkScenario({ study, scenario, sourceKinds, extraction, result, schemaErrors, readError });
  out.figures = scenarioFigures(scenario);

  // Naming (NM1-NM10): three tries, then the fallback. Naming never holds a strategy.
  if (result) {
    const own = it.strategyNumber;
    const taken = runInfo.liveTitles.filter((t) => t.number !== own).map((t) => t.title).concat(runInfo.takenInRun ?? []);
    const input = {
      asset: result.recipe.asset,
      assetName: plainAssetName(study.company ?? extraction.assetName, result.recipe.asset),
      timeFrame: result.recipe.time_frame,
      studyTitle: study.title ?? study.slug,
      scenarioTitle: scenario.title ?? it.key,
      window: scenario.window ?? null,
      context: [...(scenario.context ?? [])],
      numberToRead: scenario.numberToRead ?? null,
      settingsSummary: settingsSummary(result.recipe.algorithm_inputs),
      otherTitles: taken,
    };
    const attempts = [];
    let reply = null;
    for (let i = 0; i < 3; i++) {
      try {
        const env = await withRetry(() =>
          runClaude({ prompt: namingPrompt({ ...input, previousProblems: attempts.at(-1)?.problems }), cwd: tmpdir(), tools: [], jsonSchema: NAMING_JSON_SCHEMA, maxTurns: 3 }),
        );
        const r = env.structured_output ?? jsonFromText(env.result);
        const problems = namingProblems(r, taken);
        attempts.push({ reply: r, problems, model: answeringModel(env, DEFAULT_MODEL) });
        if (!problems.length) {
          reply = r;
          break;
        }
      } catch (e) {
        attempts.push({ error: e.message, problems: [e.message] });
      }
    }
    if (!reply) {
      const last = attempts.findLast((x) => x.reply)?.reply ?? {};
      reply = {
        title: fallbackTitle(input.assetName, input.scenarioTitle),
        summary: (last.summary ?? `${input.assetName} on the ${result.recipe.time_frame} chart.`).slice(0, 110),
        description: (last.description ?? input.settingsSummary).slice(0, 320),
        marketTag: last.marketTag ?? null,
      };
      out.findings.push({ level: "note", code: "fallback_title", message: `No title passed the naming rules in three tries; using "${reply.title}" (NM10).` });
    }
    out.naming = { reply, attempts, promptVersion: NAMING_PROMPT_VERSION };
    out.fields = draftFields({ study, scenario, result, naming: reply, extraction });
  }

  // Phase 3 acceptance: the reading against the published settings.
  const stored = it.strategyNumber != null ? runInfo.stored?.[it.strategyNumber] : null;
  if (runInfo.compare && stored && result) {
    out.comparison = {
      number: it.strategyNumber,
      storedTitle: stored.title,
      timeFrame: { read: result.recipe.time_frame, stored: stored.time_frame },
      asset: { read: result.recipe.asset, stored: stored.asset },
      settings: compareSettings(result.recipe.algorithm_inputs, stored.algorithm_inputs ?? {}),
      testEnd: { draft: out.fields?.test_end ?? null, stored: stored.test_end ?? null },
      returnPct: { case: out.figures.returnPct, screen: extraction.stats?.strategyRoiPercent ?? null, stored: stored.return_pct ?? null },
    };
  }
  out.held = holds(out.findings).length > 0;
  out.finishedAt = new Date().toISOString();
  return out;
}

async function read(a) {
  const run = resolve(a.run);
  const runInfo = readJson(join(run, "run.json"));
  const namingOnly = !!a["naming-only"];
  const only = new Set(list(a.keys));
  const todo = runInfo.items.filter((it) => (it.action === "new" || it.action === "update")
    && (!only.size || only.has(`${it.slug}/${it.key}`))
    && (namingOnly ? existsSync(itemFile(run, it)) : a.redo || !existsSync(itemFile(run, it))));
  const parallel = Math.max(1, Number(a.parallel ?? 1));
  log(`reading ${todo.length} scenarios, ${parallel} at a time, model ${DEFAULT_MODEL}`);
  runInfo.takenInRun = [];
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      const it = todo[next++];
      log("read", it.slug, it.key);
      const res = await readOne(runInfo, it, namingOnly ? readJson(itemFile(run, it)) : null);
      if (res.naming?.reply?.title) runInfo.takenInRun.push(res.naming.reply.title);
      writeJson(itemFile(run, it), res);
      log("done", it.slug, it.key, res.held ? "HELD" : "ok", res.naming?.reply?.title ?? "");
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));
}

// ---------------------------------------------------------------------------
async function write(a) {
  const run = resolve(a.run);
  const runInfo = readJson(join(run, "run.json"));
  const { attachScreenshots, pipelineClient, recordExtraction, saveDraft } = await import("./store.mjs");
  const client = await pipelineClient();
  const results = [];
  for (const f of readdirSync(join(run, "scenarios")).filter((n) => n.endsWith(".json")).sort()) {
    const res = readJson(join(run, "scenarios", f));
    const it = res.item;
    const entry = { slug: it.slug, key: it.key, number: it.strategyNumber };
    if (res.held || !res.fields) {
      results.push({ ...entry, outcome: "held", reasons: holds(res.findings).map((h) => h.message) });
      continue;
    }
    try {
      const images = Object.entries(it.sources).map(([kind, s]) => ({ filename: s.file, kind, sha256: s.sha256, bytes: s.bytes }));
      const extractionId = await recordExtraction(client, {
        strategyId: null,
        model: res.reading.model,
        promptVersion: runInfo.promptVersion,
        images,
        rawOutput: res.reading.rawOutput,
        parsed: res.parsed,
        warnings: res.findings.filter((x) => x.level !== "hold").map((x) => x.message),
        crossCheck: res.result?.crossCheck ?? [],
        schemaErrors: res.schemaErrors,
        lastBarDate: res.result?.lastBarDate ?? null,
      });
      const saved = await saveDraft(client, {
        slug: it.slug, key: it.key, commit: runInfo.commit, hash: it.hash, number: it.strategyNumber,
        fields: { ...res.fields, extraction_id: extractionId },
      });
      if (saved.created) await attachScreenshots(client, { versionId: saved.version_id, slug: it.slug, key: it.key, files: it.sources });
      results.push({ ...entry, outcome: saved.created ? "new draft" : "draft", number: saved.display_number, version: saved.version_id, extractionId, checks: saved.checks });
    } catch (e) {
      // 55006: a person has a draft open on this strategy. Hold this one only (GR2).
      results.push({ ...entry, outcome: e.code === "55006" ? "held" : "failed", reasons: [e.message] });
    }
    log(it.slug, it.key, results.at(-1).outcome);
  }
  writeJson(join(run, "write.json"), { target: process.env.PIPELINE_STORE_URL || process.env.STORE_URL, at: new Date().toISOString(), results });
}

// ---------------------------------------------------------------------------
function cell(v) {
  return String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function report(a) {
  const run = resolve(a.run);
  const runInfo = readJson(join(run, "run.json"));
  const writes = existsSync(join(run, "write.json")) ? readJson(join(run, "write.json")).results : [];
  const res = runInfo.items.map((it) => (existsSync(itemFile(run, it)) ? readJson(itemFile(run, it)) : { item: it }));
  const L = [];
  L.push(`# Case study ingestion, dry run`, "");
  L.push(`Commit ${runInfo.commit.slice(0, 12)} · ${runInfo.createdAt.slice(0, 16).replace("T", " ")} UTC · model ${runInfo.model} · reader prompt ${runInfo.promptVersion} · naming prompt ${runInfo.namingPromptVersion} · pipeline ${runInfo.pipelineVersion}`, "");
  L.push("Nothing was published. Phase 3 reads, names and checks, and saves drafts to staging only.", "");

  const read = res.filter((r) => r.result || r.findings);
  const held = read.filter((r) => r.held);
  L.push(`| Scenario | # | Action | Outcome | Title Claude wrote | Holds and warnings |`, `| --- | --- | --- | --- | --- | --- |`);
  for (const r of res) {
    const it = r.item;
    const w = writes.find((x) => x.slug === it.slug && x.key === it.key);
    const outcome = !r.findings ? "not read" : r.held ? "held" : w ? w.outcome : "read";
    const notes = (r.findings ?? []).filter((f) => f.level !== "note").map((f) => `${f.level === "hold" ? "HOLD" : "warn"}: ${f.message}`).join("<br>");
    L.push(`| ${cell(`${it.slug} / ${it.title}`)} | ${it.strategyNumber ?? w?.number ?? ""} | ${it.action} | ${cell(outcome)} | ${cell(r.naming?.reply?.title)} | ${cell(notes || (it.action === "skip" ? it.reason : ""))} |`);
  }
  L.push("", `${read.length} read, ${held.length} held, ${res.filter((r) => r.item.action === "skip").length} skipped.`, "");

  const cmp = res.filter((r) => r.comparison);
  if (cmp.length) {
    L.push("## Settings against the store", "");
    L.push("Every setting a client copies into TradingView (40 per strategy), as Claude read it from the screenshots, against the published version.", "");
    L.push("| # | Asset | Time frame | Settings that differ | Differences | Test end (draft / store) | Return (case study / screen / store) |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const r of cmp) {
      const c = r.comparison;
      const tf = c.timeFrame.read === c.timeFrame.stored ? c.timeFrame.read : `read ${c.timeFrame.read}, stored ${c.timeFrame.stored}`;
      const diffs = c.settings.map((d) => `${d.path}: read ${JSON.stringify(d.read)}, stored ${JSON.stringify(d.stored)}`).join("<br>");
      const end = c.testEnd ? `${c.testEnd.draft ?? "none"} / ${c.testEnd.stored ?? "none"}` : "";
      const ret = c.returnPct ? [c.returnPct.case, c.returnPct.screen, c.returnPct.stored == null ? null : Math.round(c.returnPct.stored * 100) / 100].map((v) => (v == null ? "?" : `${v}%`)).join(" / ") : "";
      L.push(`| ${c.number} | ${c.asset.read} | ${cell(tf)} | ${c.settings.length} of 40 | ${cell(diffs) || "none"} | ${end} | ${ret} |`);
    }
    const exact = cmp.filter((r) => r.comparison.settings.length === 0 && r.comparison.timeFrame.read === r.comparison.timeFrame.stored).length;
    L.push("", `${exact} of ${cmp.length} match the store exactly.`, "");
  }

  const titles = res.filter((r) => r.naming);
  if (titles.length) {
    L.push("## Names", "", "| # | Title today | Title Claude wrote | Summary | Tries |", "| --- | --- | --- | --- | --- |");
    for (const r of titles) {
      L.push(`| ${r.item.strategyNumber ?? ""} | ${cell(r.comparison?.storedTitle ?? runInfo.liveTitles.find((t) => t.number === r.item.strategyNumber)?.title)} | ${cell(r.naming.reply.title)} | ${cell(r.naming.reply.summary)} | ${r.naming.attempts.length} |`);
    }
    L.push("");
  }
  const md = L.join("\n");
  writeFileSync(join(run, "report.md"), md);
  console.log(md);
}

const a = args(process.argv.slice(2));
const cmd = a._[0];
const commands = { plan, read, write, report };
if (!commands[cmd]) {
  console.error("usage: run.mjs plan|read|write|report [options]  (see the header of this file)");
  process.exit(2);
}
Promise.resolve(commands[cmd](a)).catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
