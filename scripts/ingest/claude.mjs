// Claude on the Claude subscription (auto-ingestion PRD, "Extraction"; open
// question Q1, answered 12 Nov 2026: the owner's Claude subscription).
//
// Claude Code runs headless with one tool, Read, in a folder holding only the
// scenario's screenshots. It gets no database or repository credentials: the
// child process sees a short list of environment variables, none of them the
// store's (EX3). Locally it uses the Claude Code sign-in on this machine; in
// GitHub Actions, CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`. Setting
// ANTHROPIC_API_KEY instead switches to pay-per-use with no other change.
import { spawn } from "node:child_process";

export const DEFAULT_MODEL = process.env.INGEST_MODEL || "claude-sonnet-4-6";

// Only these reach Claude. Everything else in the environment stays out.
const PASS_ENV = [
  "PATH", "HOME", "USER", "LOGNAME", "LANG", "LC_ALL", "TMPDIR", "SHELL",
  "CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY", "CLAUDE_CONFIG_DIR",
];

function childEnv() {
  const env = {};
  for (const k of PASS_ENV) if (process.env[k]) env[k] = process.env[k];
  env.DISABLE_AUTOUPDATER = "1";
  env.DISABLE_TELEMETRY = "1";
  return env;
}

export class ClaudeError extends Error {
  constructor(message, { retryable = false, raw = null } = {}) {
    super(message);
    this.retryable = retryable;
    this.raw = raw;
  }
}

const RETRYABLE = /usage limit|rate limit|overloaded|529|429|5\d\d|timed? ?out|ECONNRESET|ETIMEDOUT|ENOTFOUND|network|socket hang up/i;

/** One headless run. Resolves with the parsed --output-format json envelope. */
export function runClaude({ prompt, cwd, tools = [], model = DEFAULT_MODEL, jsonSchema = null, maxTurns = 10, timeoutMs = 10 * 60_000 }) {
  const args = [
    "-p", prompt,
    "--model", model,
    "--output-format", "json",
    "--no-session-persistence",
    "--setting-sources", "",
    "--strict-mcp-config",
    "--max-turns", String(maxTurns),
    "--tools", tools.join(","),
  ];
  if (tools.length) args.push("--allowedTools", tools.join(","));
  if (jsonSchema) args.push("--json-schema", JSON.stringify(jsonSchema));

  return new Promise((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_BIN || "claude", args, { cwd, env: childEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new ClaudeError(`Could not start Claude Code: ${e.message}`));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (signal) return reject(new ClaudeError(`Claude Code timed out after ${timeoutMs / 1000}s`, { retryable: true }));
      let envelope = null;
      try {
        envelope = JSON.parse(out);
      } catch {
        const text = (err || out).trim().slice(0, 500);
        return reject(new ClaudeError(`Claude Code exited ${code}: ${text || "no output"}`, { retryable: RETRYABLE.test(text) }));
      }
      if (envelope.is_error || envelope.subtype !== "success") {
        const text = `${envelope.subtype ?? ""} ${envelope.api_error_status ?? ""} ${envelope.result ?? ""}`.trim();
        return reject(new ClaudeError(`Claude returned an error: ${text.slice(0, 500)}`, { retryable: RETRYABLE.test(text), raw: envelope }));
      }
      resolve(envelope);
    });
  });
}

/** The model that answered, from the envelope (EX4). */
export function answeringModel(envelope, fallback) {
  const models = Object.keys(envelope?.modelUsage ?? {});
  return models.find((m) => !/haiku/.test(m)) ?? models[0] ?? fallback;
}

/**
 * EX7: a run that fails on a usage limit or a network error retries three
 * times over two hours, then gives up and the report says so. Delays are in
 * seconds; INGEST_RETRY_DELAYS="5,5,5" shortens them for a local run.
 */
export function retryDelays() {
  const raw = process.env.INGEST_RETRY_DELAYS;
  if (raw) return raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n >= 0);
  return [10 * 60, 40 * 60, 70 * 60];
}

export async function withRetry(fn, { log = () => {} } = {}) {
  const delays = retryDelays();
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      if (!(e instanceof ClaudeError) || !e.retryable || attempt >= delays.length) throw e;
      log(`retrying in ${delays[attempt]}s after: ${e.message}`);
      await new Promise((r) => setTimeout(r, delays[attempt] * 1000));
    }
  }
}

/** The JSON object in a text reply, fenced or not. */
export function jsonFromText(text) {
  const trimmed = String(text ?? "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ClaudeError("Claude did not return JSON");
  return JSON.parse(raw.slice(start, end + 1));
}
