import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  PROMPT_VERSION,
  RECIPE_SCREENSHOT_EXTRACTION_PROMPT,
  buildRecipeFromExtraction,
  classifyKindsFromFilenames,
  validateExtractionShape,
} from "../lib/recipeScreenshotImport.bundle.js";
import type { RecipeScreenshotExtraction } from "../lib/recipeScreenshotImport";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

const MIN_COUNT = 3;
const MAX_COUNT = 4;

type IncomingImage = {
  filename?: string;
  mimeType?: string;
  data?: string;
};

type NodeReq = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type NodeRes = {
  status: (code: number) => NodeRes;
  json: (body: unknown) => void;
};

type JsonResult = { status: number; body: unknown };

function headerValue(
  headers: Headers | Record<string, string | string[] | undefined>,
  name: string,
): string {
  if (headers && typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) || "";
  }
  const map = headers as Record<string, string | string[] | undefined>;
  const raw = map[name] ?? map[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] || "";
  return raw || "";
}

function isFetchRequest(req: Request | NodeReq): req is Request {
  return typeof Request !== "undefined" && req instanceof Request;
}

function extractJsonObject(text: string): RecipeScreenshotExtraction {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(raw.slice(start, end + 1)) as RecipeScreenshotExtraction;
}

type AdminCheck = { error: JsonResult; client?: undefined } | { error?: undefined; client: SupabaseClient };

async function requireAdmin(authHeader: string): Promise<AdminCheck> {
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  if (!token) return { error: { status: 401, body: { error: "Missing auth token" } } };

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return { error: { status: 500, body: { error: "Server configuration error" } } };
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { error: { status: 403, body: { error: "Admin access required" } } };
  }

  // Same rule as lib/adminAccess.ts, inlined because this function avoids
  // runtime imports of TypeScript from lib/. The allowlist decides; the old
  // domain rule applies only while public.is_admin() is not deployed.
  const email = data.user.email?.trim().toLowerCase() ?? "";
  const rpc = await supabase.rpc("is_admin");
  const missingFunction =
    !!rpc.error &&
    (rpc.error.code === "PGRST202" ||
      rpc.error.code === "42883" ||
      /could not find the function|function .* does not exist/i.test(rpc.error.message ?? ""));
  const allowed = rpc.error
    ? missingFunction && email.endsWith("@archpublic.com")
    : rpc.data === true;
  if (!allowed) {
    return { error: { status: 403, body: { error: "Admin access required" } } };
  }
  return { client: supabase };
}

type ModelReply = { text: string; provider: string; model: string };

async function extractWithOpenAI(images: IncomingImage[]): Promise<ModelReply | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o";

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: RECIPE_SCREENSHOT_EXTRACTION_PROMPT },
  ];
  images.forEach((image, index) => {
    const mime = image.mimeType || "image/jpeg";
    content.push({
      type: "text",
      text: `Image ${index + 1} filename: ${image.filename || `image-${index + 1}`}`,
    });
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${mime};base64,${image.data}`,
        detail: "high",
      },
    });
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI vision failed (${response.status}): ${errText.slice(0, 400)}`);
  }

  const payload = await response.json();
  return { text: payload.choices?.[0]?.message?.content ?? "", provider: "openai", model: payload.model ?? model };
}

const ANTHROPIC_VISION_MODELS = [
  process.env.ANTHROPIC_VISION_MODEL,
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
].filter((model, index, all): model is string => !!model && all.indexOf(model) === index);

async function extractWithAnthropic(images: IncomingImage[]): Promise<ModelReply | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: RECIPE_SCREENSHOT_EXTRACTION_PROMPT },
  ];
  images.forEach((image, index) => {
    content.push({
      type: "text",
      text: `Image ${index + 1} filename: ${image.filename || `image-${index + 1}`}`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mimeType && image.mimeType.startsWith("image/")
          ? image.mimeType
          : "image/jpeg",
        data: image.data,
      },
    });
  });

  let lastError = "Anthropic vision failed";
  for (const model of ANTHROPIC_VISION_MODELS) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        temperature: 0,
        messages: [{ role: "user", content }],
      }),
    });

    if (response.ok) {
      const payload = await response.json();
      const textBlock = (payload.content ?? []).find((block: { type?: string }) => block.type === "text");
      return { text: textBlock?.text ?? "", provider: "anthropic", model: payload.model ?? model };
    }

    const errText = await response.text();
    lastError = `Anthropic vision failed (${response.status}, model ${model}): ${errText.slice(0, 300)}`;
    if (response.status !== 404) {
      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}

function imageRecords(images: IncomingImage[], kinds: string[] | null) {
  return images.map((image, index) => {
    const bytes = Buffer.from(image.data ?? "", "base64");
    return {
      filename: image.filename || `image-${index + 1}`,
      kind: kinds?.[index] ?? null,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    };
  });
}

async function parseScreenshots(authHeader: string, rawBody: unknown): Promise<JsonResult> {
  const admin = await requireAdmin(authHeader);
  if (admin.error) return admin.error;

  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return {
      status: 503,
      body: {
        error:
          "Screenshot import needs OPENAI_API_KEY or ANTHROPIC_API_KEY on the server (Vercel env, and local .env for npm run dev).",
      },
    };
  }

  const body = (typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody) as
    | { images?: IncomingImage[]; strategyId?: string | null }
    | null;
  const images = (body?.images ?? []) as IncomingImage[];
  const strategyId = typeof body?.strategyId === "string" && body.strategyId ? body.strategyId : null;
  if (!Array.isArray(images) || images.length < MIN_COUNT || images.length > MAX_COUNT) {
    return { status: 400, body: { error: "Send 3 screenshots (chart, settings, stats) or 4 to include DCA" } };
  }
  if (images.some((image) => !image?.data)) {
    return { status: 400, body: { error: "Each screenshot must include image data" } };
  }

  let reply: ModelReply | null = null;
  let lastError: unknown;
  try {
    if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      reply = await extractWithAnthropic(images);
    } else {
      reply = (await extractWithOpenAI(images)) || (await extractWithAnthropic(images));
    }
  } catch (error) {
    lastError = error;
    if (process.env.ANTHROPIC_API_KEY && process.env.OPENAI_API_KEY) {
      reply = await extractWithAnthropic(images);
    }
  }
  if (!reply?.text) {
    throw lastError instanceof Error ? lastError : new Error("Vision provider returned an empty result");
  }

  const extraction = extractJsonObject(reply.text);
  const parsedAsReturned = JSON.parse(JSON.stringify(extraction));
  const schemaErrors = validateExtractionShape(extraction);
  const filenameKinds = classifyKindsFromFilenames(
    images.map((image, index) => image.filename || `image-${index + 1}`),
  );
  const kinds = extraction.imageKinds;
  const unique = Array.isArray(kinds) ? new Set(kinds) : new Set();
  if (
    filenameKinds &&
    (!Array.isArray(kinds) || kinds.length !== images.length || unique.size !== images.length)
  ) {
    extraction.imageKinds = filenameKinds;
  }

  const result = buildRecipeFromExtraction(extraction);
  for (const problem of schemaErrors) {
    result.warnings.push(`Model output: ${problem}`);
  }

  // Provenance (A5). Recording must never block ingestion.
  let extractionId: string | null = null;
  const recorded = await admin.client.rpc("admin_record_extraction", {
    p_strategy: strategyId,
    p_provider: reply.provider,
    p_model: reply.model,
    p_prompt_version: PROMPT_VERSION,
    p_images: imageRecords(images, extraction.imageKinds ?? null),
    p_raw_output: reply.text,
    p_parsed: parsedAsReturned,
    p_warnings: result.warnings,
    p_cross_check: result.crossCheck ?? [],
    p_schema_errors: schemaErrors,
    p_last_bar_date: result.lastBarDate ?? null,
  });
  if (recorded.error) {
    result.warnings.push(`The extraction record could not be saved (${recorded.error.message}); checks against it will be missing.`);
  } else {
    extractionId = recorded.data as string;
  }

  return { status: 200, body: { ...result, extractionId, schemaErrors } };
}

export default async function handler(
  req: Request | NodeReq,
  res?: NodeRes,
): Promise<Response | void> {
  const fetchReq = isFetchRequest(req);
  const method = fetchReq ? req.method : req.method;
  const authHeader = fetchReq
    ? req.headers.get("authorization") || ""
    : headerValue(req.headers, "authorization");

  const reply = async (result: JsonResult) => {
    if (res && typeof res.status === "function") {
      res.status(result.status).json(result.body);
      return;
    }
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    if (method === "OPTIONS") {
      return reply({ status: 204, body: null });
    }
    if (method !== "POST") {
      return reply({ status: 405, body: { error: "Method not allowed" } });
    }

    const rawBody = fetchReq ? await req.json() : req.body;
    return reply(await parseScreenshots(authHeader, rawBody));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse recipe screenshots";
    return reply({ status: 500, body: { error: message } });
  }
}
