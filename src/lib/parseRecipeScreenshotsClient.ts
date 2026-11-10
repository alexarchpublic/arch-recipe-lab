import { supabase } from "@/integrations/supabase/client";
import {
  isImportableScreenshotCount,
  orderFilesByKinds,
  type ScreenshotImportResult,
} from "@/lib/recipeScreenshotImport";

const MAX_VISION_EDGE = 1280;
const MIN_VISION_WIDTH = 640;

export interface PreparedScreenshot {
  filename: string;
  mimeType: string;
  data: string;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareScreenshotForVision(file: File): Promise<PreparedScreenshot> {
  const image = await loadImage(file);
  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;

  if (width < MIN_VISION_WIDTH) {
    const scale = MIN_VISION_WIDTH / Math.max(width, 1);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const longest = Math.max(width, height);
  if (longest > MAX_VISION_EDGE) {
    const scale = MAX_VISION_EDGE / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not prepare screenshots for reading");
  }
  ctx.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  const comma = dataUrl.indexOf(",");
  return {
    filename: file.name || "screenshot.jpg",
    mimeType: "image/jpeg",
    data: dataUrl.slice(comma + 1),
  };
}

export async function parseRecipeScreenshotsFromFiles(files: File[]): Promise<ScreenshotImportResult & {
  orderedFiles: File[];
}> {
  if (!isImportableScreenshotCount(files.length)) {
    throw new Error("Drop 3 screenshots (chart, settings, stats) or 4 to include DCA");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Sign in as an admin to import recipes from screenshots");
  }

  const images = await Promise.all(files.map((file) => prepareScreenshotForVision(file)));

  const response = await fetch("/api/parse-recipe-screenshots", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      images,
      filenames: files.map((file) => file.name),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Failed to read recipe screenshots");
  }

  const result = payload as ScreenshotImportResult;
  const orderedFiles = orderFilesByKinds(files, result.orderedKinds);

  return { ...result, orderedFiles };
}
