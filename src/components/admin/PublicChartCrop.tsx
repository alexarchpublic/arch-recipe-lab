import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveDraft, uploadPublicChart, type AdminVersion } from "@/data/adminVersions";

/**
 * The public chart image (D9): the chart screenshot with the settings header
 * cut off. The chart header prints every parameter, so the original is never
 * public. The reviewer moves the cut line until no parameter text shows.
 */
export function PublicChartCrop({ draft, onSaved }: { draft: AdminVersion; onSaved: () => void }) {
  const source = draft.screenshots.find((s) => s.kind === "chart") ?? draft.screenshots[0] ?? null;
  const [cropPct, setCropPct] = useState(15);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const sourceUrl = source?.url ?? null;
  useEffect(() => {
    if (!sourceUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setLoadError("Could not load the chart screenshot.");
    img.src = sourceUrl;
  }, [sourceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const top = Math.round((image.naturalHeight * cropPct) / 100);
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight - top;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(image, 0, top, image.naturalWidth, canvas.height, 0, 0, image.naturalWidth, canvas.height);
  }, [image, cropPct]);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not produce the cropped image.");
      const url = await uploadPublicChart(draft.strategy_id, draft.version_number, blob);
      await saveDraft(draft.strategy_id, { public_chart_url: url });
      toast({ title: "Public chart saved", description: "The draft is back in draft status; submit it again." });
      onSaved();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Could not save the public chart",
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!source) return <p className="text-sm text-muted-foreground">No chart screenshot to crop.</p>;
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-40 text-sm text-muted-foreground">Cut {cropPct}% from the top</span>
        <Slider value={[cropPct]} min={0} max={40} step={0.5} onValueChange={([v]) => setCropPct(v)} className="flex-1" />
      </div>
      <canvas ref={canvasRef} className="w-full rounded border border-border" />
      <p className="text-xs text-muted-foreground">
        Check that no indicator parameters remain at the top of the image before saving.
      </p>
      <Button size="sm" onClick={save} disabled={!image || saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save as public chart
      </Button>
      {draft.public_chart_url && (
        <p className="text-xs text-muted-foreground">
          Current public chart: <a className="underline" href={draft.public_chart_url} target="_blank" rel="noreferrer">open</a>
        </p>
      )}
    </div>
  );
}
