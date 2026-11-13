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
//   node scripts/ingest/run.mjs plan --case-studies ../case-studies --out runs/x [--slug msft,aapl] [--since <sha>] [--keys msft/full-cycle,...] [--compare] [--state] [--live]
//   node scripts/ingest/run.mjs read --run runs/x [--parallel 2] [--keys slug/key,...] [--redo | --naming-only]
//   node scripts/ingest/run.mjs write --run runs/x [--author <name>] [--sync-index <case-studies.json url>]
//   node scripts/ingest/run.mjs report --run runs/x
//
// A dry run (the default) saves drafts only. A live run (plan --live) publishes
// each strategy that passes, refreshes both labs, checks them, and lists the new
// numbers in numbers.json for the case study write-back (Phase 4).
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
  scenarioCompany,
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

  if (a.live && !a.state) throw new Error("A live run needs --state: it compares each scenario with what the store recorded (TR3, TR4, BF2).");
  let stateClient = null;
  if (a.state) {
    const { pipelineClient } = await import("./store.mjs");
    stateClient = await pipelineClient({ allowProduction: !!a.live });
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
      // A scenario the store already published but whose number has not reached
      // the case study yet carries the store's number (NO2, NO4).
      const known = typeof scenario.strategyNumber === "number" ? scenario.strategyNumber : stored.published_number ?? null;
      const p = planScenario({
        study, scenario: { ...scenario, strategyNumber: known ?? undefined }, hash,
        storedHash: stored.draft_hash ?? stored.published_hash ?? stored.ref_hash ?? null,
        hasSources: Object.keys(src.files).length > 0,
        baselineUnrecorded: !!a.live,
      });
      items.push({
        ...p,
        hash,
        caseStudyNumber: typeof scenario.strategyNumber === "number" ? scenario.strategyNumber : null,
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
    mode: a.live ? "live" : "dry-run",
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
    // A bad or expired Claude sign-in fails every scenario the same way: stop
    // the run and say so, rather than report each one as held.
    if (/\b401\b|authenticat|OAuth access token|invalid x-api-key|not logged in|login/i.test(e.message)) {
      throw new Error(`Claude sign-in failed, so nothing was read. Check CLAUDE_CODE_OAUTH_TOKEN (make a new one with \`claude setup-token\`). ${e.message}`);
    }
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
      assetName: plainAssetName(scenarioCompany(study, scenario) ?? extraction.assetName, result.recipe.asset),
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
  const live = runInfo.mode === "live";
  const st = await import("./store.mjs");
  const client = await st.pipelineClient({ allowProduction: live });
  const author = a.author || process.env.INGEST_AUTHOR || "unknown";
  const results = [];

  // LK1: links follow the live case study index, which carries the numbers
  // an earlier run wrote back. A run therefore links what the run before it published.
  let sync = null;
  if (a["sync-index"]) {
    let index;
    if (/^https?:\/\//.test(a["sync-index"])) {
      const res = await fetch(a["sync-index"], { cache: "no-store" });
      if (!res.ok) throw new Error(`Case study index ${a["sync-index"]}: HTTP ${res.status}`);
      index = await res.json();
    } else index = readJson(resolve(a["sync-index"])); // a built site/case-studies.json
    sync = await st.syncCaseStudyRefs(client, index);
    log("links synced:", JSON.stringify(sync).slice(0, 200));
  }

  // BF2: numbered scenarios with no recorded hash get one, and nothing else.
  const baselines = {};
  for (const it of runInfo.items.filter((x) => x.action === "baseline")) (baselines[it.slug] ??= {})[it.key] = it.hash;
  for (const [slug, hashes] of Object.entries(baselines)) {
    const n = await st.recordBaseline(client, slug, hashes);
    for (const key of Object.keys(hashes)) results.push({ slug, key, number: runInfo.items.find((x) => x.slug === slug && x.key === key)?.strategyNumber, outcome: "baseline", recorded: n > 0 });
  }

  for (const f of readdirSync(join(run, "scenarios")).filter((n) => n.endsWith(".json")).sort()) {
    const res = readJson(join(run, "scenarios", f));
    const it = res.item;
    const entry = { slug: it.slug, key: it.key, number: it.strategyNumber, caseStudyNumber: it.caseStudyNumber ?? it.strategyNumber, title: res.naming?.reply?.title };
    if (res.held || !res.fields) {
      results.push({ ...entry, outcome: "held", reasons: holds(res.findings ?? []).map((h) => h.message) });
      continue;
    }
    try {
      const images = Object.entries(it.sources).map(([kind, s]) => ({ filename: s.file, kind, sha256: s.sha256, bytes: s.bytes }));
      const extractionId = await st.recordExtraction(client, {
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
      const saved = await st.saveDraft(client, {
        slug: it.slug, key: it.key, commit: runInfo.commit, hash: it.hash, number: it.strategyNumber,
        fields: { ...res.fields, extraction_id: extractionId },
      });
      const out = { ...entry, outcome: saved.created ? "new draft" : "draft", number: saved.display_number, version: saved.version_id, extractionId, checks: saved.checks, created: saved.created };
      // New screenshots: always for a new strategy; for a changed scenario when publishing (PB5).
      if (saved.created || live) {
        try {
          await st.attachScreenshots(client, { versionId: saved.version_id, slug: it.slug, key: it.key, files: it.sources });
        } catch (e) {
          if (!/originates in another case study/.test(e.message)) throw e;
          out.note = "Screenshots kept: the strategy originates in another case study.";
        }
      }
      if (live) {
        const pub = await st.publish(client, saved.version_id, author);
        if (pub.published) Object.assign(out, { outcome: "published", slug_page: pub.slug, listedPublic: pub.listed_public, acknowledged: pub.acknowledged, parityOk: pub.parity_ok });
        else Object.assign(out, { outcome: "held", reasons: pub.blocking.map((b) => `${b.code}: ${b.message}`) });
      }
      results.push(out);
    } catch (e) {
      // 55006: a person has a draft open on this strategy. Hold this one only (GR2).
      results.push({ ...entry, outcome: e.code === "55006" ? "held" : "failed", reasons: [e.message] });
    }
    log(it.slug, it.key, results.at(-1).outcome);
  }

  // PB3: refresh the public pages, then check that both labs show each number and title.
  const published = results.filter((r) => r.outcome === "published");
  let pages = null;
  if (published.length) {
    pages = await st.refreshAndCheck(client, published, { strategyLab: process.env.STRATEGY_LAB_URL || null });
    for (const r of published) r.pages = pages[r.number];
  }
  // NO2: every published scenario the case study gave no number, including one
  // whose strategy an earlier, interrupted run created (NO4).
  const numbers = published.filter((r) => r.caseStudyNumber == null).map((r) => ({ slug: r.slug, key: r.key, number: r.number }));
  // And any the store numbered in an earlier run whose write-back did not land.
  for (const it of runInfo.items) {
    if (it.caseStudyNumber == null && it.strategyNumber != null && !numbers.some((n) => n.slug === it.slug && n.key === it.key)) {
      numbers.push({ slug: it.slug, key: it.key, number: it.strategyNumber });
    }
  }
  writeJson(join(run, "numbers.json"), numbers);
  writeJson(join(run, "write.json"), {
    target: process.env.PIPELINE_STORE_URL || process.env.STORE_URL, mode: runInfo.mode, at: new Date().toISOString(), author, sync, results,
  });
  log(`${published.length} published, ${results.filter((r) => r.outcome === "held").length} held, ${numbers.length} numbers to write back`);
}

// ---------------------------------------------------------------------------
function cell(v) {
  return String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function report(a) {
  const run = resolve(a.run);
  const runInfo = readJson(join(run, "run.json"));
  const writeInfo = existsSync(join(run, "write.json")) ? readJson(join(run, "write.json")) : null;
  const writes = writeInfo?.results ?? [];
  const live = runInfo.mode === "live";
  const res = runInfo.items.map((it) => (existsSync(itemFile(run, it)) ? readJson(itemFile(run, it)) : { item: it }));
  const L = [];
  L.push(live ? "# Case study ingestion" : "# Case study ingestion, dry run", "");
  L.push(`Commit ${runInfo.commit.slice(0, 12)} · ${runInfo.createdAt.slice(0, 16).replace("T", " ")} UTC · model ${runInfo.model} · reader prompt ${runInfo.promptVersion} · naming prompt ${runInfo.namingPromptVersion} · pipeline ${runInfo.pipelineVersion}`, "");
  if (!live) L.push("Nothing was published. A dry run reads, names and checks, and saves drafts only.", "");
  const pub = writes.filter((w) => w.outcome === "published");
  if (live) {
    const heldN = writes.filter((w) => w.outcome === "held" || w.outcome === "failed").length;
    L.push(`${pub.length} published, ${heldN} held or failed${writeInfo?.sync ? `; links synced (${writeInfo.sync.links ?? "?"} links)` : ""}.`, "");
  }
  if (pub.length) {
    L.push("## Published", "", "| # | Title | Strategy Lab Pro | Strategy Lab | Checks let through |", "| --- | --- | --- | --- | --- |");
    for (const w of pub) {
      const pg = w.pages ?? {};
      const lab = w.listedPublic === false ? "Pro only" : pg.publicPage === "ok" ? `[page](${pg.url})` : `${pg.publicPage ?? "not checked"}${pg.publicView === false ? ", not in the view" : ""}`;
      L.push(`| ${w.number} | ${cell(w.title)} | ${pg.pro ? "shows it" : "MISSING"} | ${cell(lab)} | ${cell((w.acknowledged ?? []).join(", ")) || "none"} |`);
    }
    L.push("");
  }
  const heldW = writes.filter((w) => w.outcome === "held" || w.outcome === "failed");
  if (heldW.length) {
    L.push("## Held", "", "Each stays a draft (or unread) until the case study or the draft is fixed; the rest of the study went ahead (GR2, GR5).", "", "| Scenario | # | Why |", "| --- | --- | --- |");
    for (const w of heldW) L.push(`| ${cell(`${w.slug} / ${w.key}`)} | ${w.number ?? ""} | ${cell((w.reasons ?? []).join("; "))} |`);
    L.push("");
  }

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
