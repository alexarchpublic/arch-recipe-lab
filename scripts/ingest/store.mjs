// The store, two ways. Public reads use the publishable key both labs ship
// (STORE_URL, STORE_ANON_KEY). Writes sign in as the pipeline's own account
// (PIPELINE_EMAIL, PIPELINE_PASSWORD), which can call only the pipeline_*
// functions (GR8). Phase 3 writes to staging only.
import { createClient } from "@supabase/supabase-js";

export const PRODUCTION_REF = "xsoixhltejgyuhedhbdu";

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set.`);
  return v;
}

export function publicClient() {
  return createClient(need("STORE_URL"), need("STORE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Live strategies as both labs see them: number, title, settings. */
export async function liveStrategies(client = publicClient()) {
  const { data, error } = await client
    .from("strategies_pro")
    .select("display_number, title, asset, time_frame, algorithm, algorithm_inputs, net_profit_usd, return_pct, buy_hold_pnl_pct, dca_pnl_pct, cash_profit_usd, asset_qty, test_start, test_end, archived_at");
  if (error) throw new Error(`Reading strategies_pro: ${error.message}`);
  return data.filter((s) => !s.archived_at);
}

/**
 * The pipeline's own account, on the store it writes to: PIPELINE_STORE_URL
 * and PIPELINE_STORE_ANON_KEY (staging in Phase 3), else STORE_URL.
 */
export async function pipelineClient({ allowProduction = false } = {}) {
  const url = process.env.PIPELINE_STORE_URL || need("STORE_URL");
  const key = process.env.PIPELINE_STORE_URL ? need("PIPELINE_STORE_ANON_KEY") : need("STORE_ANON_KEY");
  if (url.includes(PRODUCTION_REF) && !allowProduction) {
    throw new Error("Phase 3 writes to staging only; the pipeline's store address is production.");
  }
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: need("PIPELINE_EMAIL"), password: need("PIPELINE_PASSWORD") });
  if (error) throw new Error(`Pipeline sign-in failed: ${error.message}`);
  return client;
}

export async function scenarioState(client, slug) {
  const { data, error } = await client.rpc("pipeline_scenario_state", { p_slug: slug });
  if (error) throw new Error(`pipeline_scenario_state(${slug}): ${error.message}`);
  return Object.fromEntries((data ?? []).map((row) => [row.scenario_key, row]));
}

export async function recordExtraction(client, r) {
  const { data, error } = await client.rpc("pipeline_record_extraction", {
    p_strategy: r.strategyId ?? null,
    p_provider: "anthropic",
    p_model: r.model,
    p_prompt_version: r.promptVersion,
    p_images: r.images,
    p_raw_output: r.rawOutput,
    p_parsed: r.parsed,
    p_warnings: r.warnings,
    p_cross_check: r.crossCheck ?? [],
    p_schema_errors: r.schemaErrors ?? [],
    p_last_bar_date: r.lastBarDate ?? null,
  });
  if (error) throw new Error(`pipeline_record_extraction: ${error.message}`);
  return data;
}

export async function saveDraft(client, { slug, key, commit, hash, number, fields }) {
  const { data, error } = await client.rpc("pipeline_save_draft", {
    p_slug: slug, p_scenario_key: key, p_commit: commit, p_hash: hash, p_number: number, p_fields: fields,
  });
  if (error) {
    const e = new Error(error.message);
    e.code = error.code;
    throw e;
  }
  return data;
}

/** Uploads the source screenshots under case-studies/<slug>/<key>/ and attaches them. */
export async function attachScreenshots(client, { versionId, slug, key, files }) {
  const { readFileSync } = await import("node:fs");
  const order = ["chart", "settings", "stats", "dca"];
  const images = [];
  for (const kind of order) {
    const f = files[kind];
    if (!f) continue;
    const path = `case-studies/${slug}/${key}/${f.sha256.slice(0, 12)}-${f.file}`;
    const { error } = await client.storage.from("recipe-screenshots").upload(path, readFileSync(f.path), {
      contentType: "image/png", upsert: false,
    });
    if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`Upload ${path}: ${error.message}`);
    const { data } = client.storage.from("recipe-screenshots").getPublicUrl(path);
    images.push({ url: data.publicUrl, kind, order: images.length, sha256: f.sha256 });
  }
  const { data, error } = await client.rpc("pipeline_attach_screenshots", { p_version: versionId, p_images: images });
  if (error) throw new Error(`pipeline_attach_screenshots: ${error.message}`);
  return data;
}

/** Phase 4: publish a pipeline draft. Errors and off-list review checks hold it (GR3). */
export async function publish(client, versionId, author) {
  const { data, error } = await client.rpc("pipeline_publish", { p_version: versionId, p_author: author });
  if (error) throw new Error(`pipeline_publish: ${error.message}`);
  return data;
}

export async function syncCaseStudyRefs(client, index) {
  const { data, error } = await client.rpc("pipeline_sync_case_study_refs", { p_index: index });
  if (error) throw new Error(`pipeline_sync_case_study_refs: ${error.message}`);
  return data;
}

export async function recordBaseline(client, slug, hashes) {
  const { data, error } = await client.rpc("pipeline_record_baseline", { p_slug: slug, p_hashes: hashes });
  if (error) throw new Error(`pipeline_record_baseline: ${error.message}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const htmlText = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * PB3: ask Strategy Lab to refresh (as the pipeline), then confirm each
 * published strategy on both labs: the Pro view shows its number and title,
 * and a public one's page shows them too. Pro reads its view live, so the
 * view is Pro's page check. Returns { <number>: { pro, publicView, publicPage } }.
 */
export async function refreshAndCheck(client, published, { strategyLab = null, tries = 8, waitMs = 15_000 } = {}) {
  const out = {};
  const numbers = published.map((r) => r.number);
  const { data: pro } = await client.from("strategies_pro").select("display_number, title, slug").in("display_number", numbers);
  const { data: pub } = await client.from("strategies_public").select("display_number, title, slug").in("display_number", numbers);
  for (const r of published) {
    const p = (pro ?? []).find((x) => x.display_number === r.number);
    const q = (pub ?? []).find((x) => x.display_number === r.number);
    out[r.number] = {
      pro: !!p && p.title === r.title,
      publicView: r.listedPublic ? !!q && q.title === r.title : null,
      publicPage: r.listedPublic ? "not checked" : null,
      slug: q?.slug ?? p?.slug ?? null,
    };
  }
  if (!strategyLab) return out;
  const base = strategyLab.replace(/\/+$/, "");
  const { data: session } = await client.auth.getSession();
  const res = await fetch(`${base}/api/revalidate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ scope: "strategies" }),
  }).catch((e) => ({ ok: false, status: e.message }));
  const refreshed = res.ok;
  for (const r of published.filter((x) => x.listedPublic)) {
    const o = out[r.number];
    let found = false;
    for (let i = 0; i < tries && !found && o.slug; i++) {
      if (i) await sleep(waitMs);
      const page = await fetch(`${base}/${o.slug}`, { cache: "no-store", headers: { "user-agent": "strategy-ingestion-check" } }).catch(() => null);
      const html = page?.ok ? await page.text() : "";
      found = html.includes(`Strategy #${r.number}`) && (html.includes(htmlText(r.title)) || html.includes(r.title.replace(/'/g, "&#x27;")) || html.includes(r.title));
    }
    o.publicPage = found ? "ok" : refreshed ? "missing" : `missing (refresh failed: HTTP ${res.status})`;
    o.url = `${base}/${o.slug}`;
  }
  return out;
}
