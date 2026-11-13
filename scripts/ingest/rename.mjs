#!/usr/bin/env node
// BF3 (auto-ingestion PRD, Phase 5): one plain title for each of the older
// live strategies, written by the pipeline's naming step and checked by its
// rules (NM2-NM10). Two commands:
//
//   name     reads the live strategies (STORE_URL, STORE_ANON_KEY), writes a
//            title, summary and description for each one not kept, from its
//            origin case study where it has one (store.case_study_refs, via the
//            view's case_studies column), otherwise from its stored fields.
//            Claude runs headless on this machine's sign-in, as `read` does.
//            Writes <out>/items/<number>.json and <out>/list.json. Nothing is
//            written to any store.
//
//   publish  publishes the approved list as copy-type versions (NM9) through
//            pipeline_publish_copy, as the pipeline account (PIPELINE_*). Only
//            title, summary (goal) and description (how_it_trades) are sent;
//            the function refuses anything else, refuses a strategy whose
//            published version moved since the list was made, and keeps the
//            page address.
//
//   node scripts/ingest/rename.mjs name --case-studies ../case-studies --out runs/bf3 [--keep 99,100,101] [--numbers 66,68] [--parallel 3] [--redo]
//   node scripts/ingest/rename.mjs publish --run runs/bf3 --approved "<who and when>" [--numbers 66,68] [--staging-versions | --production]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  NAMING_JSON_SCHEMA,
  NAMING_PROMPT_VERSION,
  fallbackTitle,
  namingProblems,
  namingPrompt,
  plainAssetName,
  scenarioCompany,
  settingsSummary,
  titleProblems,
} from "../../lib/pipeline.bundle.js";
import { DEFAULT_MODEL, answeringModel, jsonFromText, runClaude, withRetry } from "./claude.mjs";

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
const nums = (v) => (typeof v === "string" ? v.split(",").map((s) => Number(s.trim())).filter(Number.isFinite) : []);
const norm = (t) => (t ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const COLUMNS = [
  "id", "display_number", "version_id", "slug", "title", "short_name", "name", "goal", "best_for", "how_it_trades",
  "up_market_behavior", "down_market_behavior", "asset", "algorithm", "time_frame", "algorithm_inputs",
  "test_start", "test_end", "archived_at", "case_studies",
].join(", ");

async function liveRows() {
  const { publicClient } = await import("./store.mjs");
  const client = publicClient();
  const { data, error } = await client.from("strategies_pro").select(COLUMNS).order("display_number");
  if (error) throw new Error(`Reading strategies_pro: ${error.message}`);
  const pub = await client.from("strategies_public").select("display_number");
  if (pub.error) throw new Error(`Reading strategies_public: ${pub.error.message}`);
  const shown = new Set(pub.data.map((r) => r.display_number));
  return data.filter((s) => !s.archived_at).map((s) => ({ ...s, listed_public: shown.has(s.display_number) }));
}

const fmtDate = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : null);

/** The naming input for one strategy: its origin case study's scenario, else its stored fields. */
function namingInput(s, studies) {
  const ref = (s.case_studies ?? []).find((r) => r.role === "origin") ?? (s.case_studies ?? [])[0] ?? null;
  const study = ref ? studies.get(ref.slug) : null;
  const scenario = study ? (study.scenarios ?? []).find((x) => x.key === ref.scenario_key) : null;
  const window = s.test_start && s.test_end ? `${fmtDate(s.test_start)} to ${fmtDate(s.test_end)}` : null;
  const settings = s.algorithm === "Market Wave"
    ? settingsSummary(s.algorithm_inputs ?? {})
    : `${s.algorithm} (an Arch Public algorithm; do not name it in the title)`;
  if (study && scenario) {
    return {
      source: { kind: "case_study", slug: ref.slug, key: ref.scenario_key, studyTitle: study.title, scenarioTitle: scenario.title },
      input: {
        asset: s.asset,
        assetName: plainAssetName(scenarioCompany(study, scenario), s.asset),
        timeFrame: s.time_frame,
        studyTitle: study.title ?? study.slug,
        scenarioTitle: scenario.title ?? ref.scenario_key,
        window: scenario.window ?? window,
        context: [...(scenario.context ?? [])],
        numberToRead: scenario.numberToRead ?? null,
        settingsSummary: settings,
      },
    };
  }
  // No case study: what the store says about it. Figures stay out (NM4, NM8).
  const own = [s.title, s.short_name].map(norm);
  const stored = [
    ["What it is for", s.goal],
    ["Best for", s.best_for],
    ["How it trades", s.how_it_trades],
    ["In rising markets", s.up_market_behavior],
    ["In falling markets", s.down_market_behavior],
  ].filter(([, v]) => v && v.trim() && !own.includes(norm(v)));
  return {
    source: { kind: "store" },
    input: {
      asset: s.asset,
      assetName: null,
      timeFrame: s.time_frame,
      studyTitle: "None. No case study covers this strategy; write only from the stored fields below",
      scenarioTitle: `none. Its title today is "${s.title}" (short name "${s.short_name}"); keep that idea, in plain words`,
      window,
      context: [
        `Algorithm: ${s.algorithm}.`,
        ...stored.map(([k, v]) => `${k}: ${v.trim()}`),
        ...(stored.length ? [] : ["The store has no description of it beyond its title, settings and test window."]),
      ],
      numberToRead: null,
      settingsSummary: settings,
    },
  };
}

async function nameOne(s, input, taken) {
  const attempts = [];
  let reply = null;
  for (let i = 0; i < 3; i++) {
    try {
      const env = await withRetry(() =>
        runClaude({ prompt: namingPrompt({ ...input, otherTitles: taken(), previousProblems: attempts.at(-1)?.problems }), cwd: tmpdir(), tools: [], jsonSchema: NAMING_JSON_SCHEMA, maxTurns: 3 }),
      );
      const r = env.structured_output ?? jsonFromText(env.result);
      const problems = namingProblems(r, taken());
      attempts.push({ reply: r, problems, model: answeringModel(env, DEFAULT_MODEL) });
      if (!problems.length) {
        reply = r;
        break;
      }
    } catch (e) {
      if (/\b401\b|authenticat|OAuth access token|not logged in/i.test(e.message)) throw e;
      attempts.push({ error: e.message, problems: [e.message] });
    }
  }
  let fallback = false;
  if (!reply) {
    const last = attempts.findLast((x) => x.reply)?.reply ?? {};
    reply = {
      title: fallbackTitle(input.assetName ?? s.asset, input.scenarioTitle),
      summary: (last.summary ?? "").slice(0, 110),
      description: (last.description ?? "").slice(0, 320),
      marketTag: last.marketTag ?? null,
    };
    fallback = true;
  }
  return { reply, attempts, fallback };
}

async function name(a) {
  const root = resolve(a["case-studies"] ?? "../case-studies");
  const out = resolve(a.out ?? "runs/bf3");
  mkdirSync(join(out, "items"), { recursive: true });
  const keep = new Set(nums(a.keep ?? "99,100,101"));
  const only = new Set(nums(a.numbers));

  const studies = new Map();
  const { loadStudies } = await import("./studies.mjs");
  for (const { study } of loadStudies(root)) studies.set(study.slug, study);

  const rows = await liveRows();
  const todo = rows.filter((s) => !keep.has(s.display_number) && (!only.size || only.has(s.display_number)));
  log(`${rows.length} live strategies; naming ${todo.length}; keeping ${[...keep].join(", ")}`);

  const itemPath = (n) => join(out, "items", `${n}.json`);
  // Titles already settled: the kept strategies, and every item named so far.
  const settled = new Map(rows.filter((s) => keep.has(s.display_number)).map((s) => [s.display_number, s.title]));
  for (const s of rows) if (!keep.has(s.display_number) && existsSync(itemPath(s.display_number))) settled.set(s.display_number, readJson(itemPath(s.display_number)).after.title);

  const queue = todo.filter((s) => a.redo || !existsSync(itemPath(s.display_number)));
  const parallel = Math.max(1, Number(a.parallel ?? 3));
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const s = queue[next++];
      const { source, input } = namingInput(s, studies);
      const taken = () => [...settled].filter(([n]) => n !== s.display_number).map(([, t]) => t);
      const t0 = Date.now();
      const res = await nameOne(s, input, taken);
      settled.set(s.display_number, res.reply.title);
      const item = {
        number: s.display_number,
        strategyId: s.id,
        versionId: s.version_id,
        slug: s.slug,
        listedPublic: s.listed_public,
        asset: s.asset,
        algorithm: s.algorithm,
        timeFrame: s.time_frame,
        source,
        before: { title: s.title, short_name: s.short_name, name: s.name, goal: s.goal, how_it_trades: s.how_it_trades },
        after: { title: res.reply.title.trim(), goal: res.reply.summary.trim(), how_it_trades: res.reply.description.trim() },
        marketTag: res.reply.marketTag ?? null,
        fallback: res.fallback,
        attempts: res.attempts,
        input,
        namingPromptVersion: NAMING_PROMPT_VERSION,
        seconds: Math.round((Date.now() - t0) / 1000),
      };
      writeJson(itemPath(s.display_number), item);
      log(`#${s.display_number}`, `"${s.title}" -> "${item.after.title}"`, res.fallback ? "(FALLBACK)" : `(${res.attempts.length} tries)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, worker));

  // Parallel naming can land two equal titles: name the later one again.
  const items = todo.map((s) => readJson(itemPath(s.display_number)));
  const seen = new Map([...settled].filter(([n]) => keep.has(n)).map(([n, t]) => [norm(t), n]));
  const clashes = [];
  for (const it of items) {
    const k = norm(it.after.title);
    if (seen.has(k)) clashes.push(it.number);
    else seen.set(k, it.number);
  }
  if (clashes.length) log(`title clashes, run again with --redo --numbers ${clashes.join(",")}`);

  const listing = items.map((it) => ({
    number: it.number, slug: it.slug, listedPublic: it.listedPublic, asset: it.asset, algorithm: it.algorithm, timeFrame: it.timeFrame,
    source: it.source, before: it.before, after: it.after, fallback: it.fallback, tries: it.attempts.length,
    problems: titleProblems(it.after.title, { otherTitles: items.filter((o) => o.number !== it.number).map((o) => o.after.title).concat([...settled].filter(([n]) => keep.has(n)).map(([, t]) => t)) }),
    versionId: it.versionId,
  }));
  writeJson(join(out, "list.json"), { createdAt: new Date().toISOString(), model: DEFAULT_MODEL, namingPromptVersion: NAMING_PROMPT_VERSION, kept: [...keep], clashes, items: listing });
  log(`wrote ${listing.length} to ${join(out, "list.json")}; ${listing.filter((x) => x.problems.length).length} with problems; ${listing.filter((x) => x.fallback).length} fallbacks`);
}

async function publish(a) {
  const run = resolve(a.run ?? "runs/bf3");
  if (!a.approved || a.approved === true) throw new Error("--approved \"<who approved the list, and when>\" is required: BF3 publishes only an approved list (Q3).");
  const list = readJson(join(run, "list.json"));
  const only = new Set(nums(a.numbers));
  const items = list.items.filter((x) => !only.size || only.has(x.number));
  const { pipelineClient } = await import("./store.mjs");
  const client = await pipelineClient({ allowProduction: !!a.production });
  // Staging holds other version ids than production, where the list was made.
  // For a staging rehearsal, --staging-versions takes staging's current ones.
  let current = null;
  if (a["staging-versions"]) {
    if (a.production) throw new Error("--staging-versions is for a staging rehearsal only.");
    const { data, error } = await client.from("strategies_pro").select("display_number, version_id");
    if (error) throw new Error(`Reading staging's versions: ${error.message}`);
    current = new Map(data.map((r) => [r.display_number, r.version_id]));
  }
  const results = [];
  for (const it of items) {
    const { data, error } = await client.rpc("pipeline_publish_copy", {
      p_number: it.number,
      p_expected_version: current ? current.get(it.number) ?? it.versionId : it.versionId,
      p_fields: { title: it.after.title, goal: it.after.goal, how_it_trades: it.after.how_it_trades },
      p_note: `BF3 rename: list approved by ${a.approved}`,
    });
    const r = error ? { number: it.number, published: false, error: error.message } : { number: it.number, ...data };
    results.push(r);
    log(`#${it.number}`, r.published ? `published "${r.title}" at ${r.slug}` : `NOT published: ${r.error ?? JSON.stringify(r.blocking ?? r)}`);
  }
  writeJson(join(run, `published-${a.production ? "production" : "staging"}.json`), { at: new Date().toISOString(), approved: a.approved, results });
  const bad = results.filter((r) => !r.published);
  log(`${results.length - bad.length} published, ${bad.length} not`);
  if (bad.length) process.exitCode = 1;
}

const a = args(process.argv.slice(2));
const cmd = a._[0];
const run = { name, publish }[cmd];
if (!run) {
  console.error("usage: rename.mjs name|publish ...");
  process.exit(2);
}
run(a).catch((e) => {
  console.error(e.stack ?? e.message);
  process.exit(1);
});
