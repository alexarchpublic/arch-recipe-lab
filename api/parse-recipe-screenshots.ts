import { createClient } from "@supabase/supabase-js";
import {
  RECIPE_SCREENSHOT_EXTRACTION_PROMPT,
  buildRecipeFromExtraction,
  classifyKindsFromFilenames,
  type RecipeScreenshotExtraction,
} from "../src/lib/recipeScreenshotImport";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

const REQUIRED_COUNT = 4;

type IncomingImage = {
  filename?: string;
  mimeType?: string;
  data?: string;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

async function requireAdmin(request: Request): Promise<Response | null> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json(401, { error: "Missing auth token" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: "Server configuration error" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.auth.getUser(token);
  const email = data.user?.email?.toLowerCase() ?? "";
  if (error || !email.endsWith("@archpublic.com")) {
    return json(403, { error: "Admin access required" });
  }
  return null;
}

async function extractWithOpenAI(images: IncomingImage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "";

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
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
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
  return payload.choices?.[0]?.message?.content ?? "";
}

async function extractWithAnthropic(images: IncomingImage[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";

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
        media_type: image.mimeType || "image/jpeg",
        data: image.data,
      },
    });
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic vision failed (${response.status}): ${errText.slice(0, 400)}`);
  }

  const payload = await response.json();
  const textBlock = (payload.content ?? []).find((block: { type?: string }) => block.type === "text");
  return textBlock?.text ?? "";
}

async function runParse(authHeader: string | null, body: unknown): Promise<Response> {
  const authRequest = new Request("https://recipe-lab.local/api/parse-recipe-screenshots", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : undefined,
  });
  const authError = await requireAdmin(authRequest);
  if (authError) return authError;

  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return json(503, {
      error:
        "Screenshot import needs OPENAI_API_KEY or ANTHROPIC_API_KEY on the server (Vercel env, and local .env for npm run dev).",
    });
  }

  const images = ((body as { images?: IncomingImage[] })?.images ?? []) as IncomingImage[];
  if (!Array.isArray(images) || images.length !== REQUIRED_COUNT) {
    return json(400, { error: "Send exactly 4 screenshots: chart, settings, stats, and DCA" });
  }
  if (images.some((image) => !image?.data)) {
    return json(400, { error: "Each screenshot must include image data" });
  }

  let raw = "";
  let lastError: unknown;
  try {
    raw = (await extractWithOpenAI(images)) || (await extractWithAnthropic(images));
  } catch (error) {
    lastError = error;
    raw = await extractWithAnthropic(images);
  }
  if (!raw) {
    throw lastError instanceof Error ? lastError : new Error("Vision provider returned an empty result");
  }

  const extraction = extractJsonObject(raw);
  const filenameKinds = classifyKindsFromFilenames(
    images.map((image, index) => image.filename || `image-${index + 1}`),
  );
  if (filenameKinds && Array.isArray(extraction.imageKinds)) {
    const unique = new Set(extraction.imageKinds);
    if (unique.size !== REQUIRED_COUNT) {
      extraction.imageKinds = filenameKinds;
    }
  }

  const result = buildRecipeFromExtraction(extraction);
  return json(200, result);
}

export default async function handler(
  req: Request | { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown },
  res?: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<Response | void> {
  const method = req instanceof Request ? req.method : req.method;
  const authHeader =
    req instanceof Request
      ? req.headers.get("authorization")
      : typeof req.headers.authorization === "string"
        ? req.headers.authorization
        : Array.isArray(req.headers.authorization)
          ? req.headers.authorization[0]
          : null;

  try {
    if (method === "OPTIONS") {
      if (res) {
        res.status(204).json(null);
        return;
      }
      return new Response(null, { status: 204 });
    }
    if (method !== "POST") {
      const denied = json(405, { error: "Method not allowed" });
      if (res) {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      return denied;
    }

    const body = req instanceof Request ? await req.json() : req.body;
    const response = await runParse(authHeader, body);
    if (res) {
      const payload = await response.json();
      res.status(response.status).json(payload);
      return;
    }
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse recipe screenshots";
    if (res) {
      res.status(500).json({ error: message });
      return;
    }
    return json(500, { error: message });
  }
}
