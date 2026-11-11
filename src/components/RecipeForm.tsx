import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  uploadRecipeImage,
  removeRecipeImage,
  getRecipeScreenshots,
  kindFromLabel,
  validateImage,
  MAX_IMAGES_PER_RECIPE
} from "@/lib/imageUpload";
import { 
  Upload, 
  X, 
  GripVertical, 
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Sparkles
} from "lucide-react";
import { resolveBuyHoldPnlPercentForSave, resolveDcaPnlPercentForSave } from "@/utils/recipeMetrics";
import {
  type AdminRole,
  type FormValues,
  formToVersionFields,
  refreshDraftScreenshots,
  runEndIsInFuture,
  saveDraft,
  strategyIdForVersion,
  todayIso,
} from "@/data/adminVersions";
import { CRYPTO_ASSETS } from "@/lib/algorithms";
import { parseRecipeScreenshotsFromFiles } from "@/lib/parseRecipeScreenshotsClient";
import {
  RECIPE_SCREENSHOT_KINDS,
  RECIPE_SCREENSHOT_LABELS,
  isImportableScreenshotCount,
  type ImportedRecipeDraft,
} from "@/lib/recipeScreenshotImport";

const TICKER_REGEX = /^[A-Z.-]{1,10}$/;

// Form validation schema
const recipeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  asset_class: z.enum(["Equities", "ETFs", "Crypto"]).default("Equities"),
  asset: z.string().min(1, "Asset is required"),
  time_horizon: z.enum(["STH", "LTH"]),
  focus: z.enum(["Cash Yielding", "Balanced", "Accumulation"]),
  goal: z.string().min(1, "Goal is required"),
  entry_trade: z.string().min(1, "Entry trade is required"),
  exit_trade: z.string().min(1, "Exit trade is required"),
  sell_above_cost_basis: z.boolean(),
  exit_to_entry_proportion: z.number().min(0, "Must be positive"),
  time_frame: z.enum(["1 Week", "1 Day", "6 Hours", "4 Hours", "1 Hour"], {
    required_error: "Time frame is required",
  }),
  backtesting_period: z.string().min(1, "Backtesting period is required"),
  initial_capital: z.number().optional(),
  cash_profit: z.number().optional(),
  asset_accumulated: z.string().optional(),
  net_profit: z.string().optional(),
  cagr: z.number().optional(),
  // New algorithm fields
  algorithm: z.enum(["Intelligence Algorithm","Arbitrage Algorithm","Oracle Protocol","Market Wave"]).default("Market Wave"),
  algorithm_inputs: z.any().optional(),
  // Version (PRD 7): identity, assumptions and the change note
  title: z.string().optional(),
  short_name: z.string().optional(),
  slug: z.string().regex(/^$|^[a-z0-9]+(-[a-z0-9]+)*$/, "Lower-case words joined by hyphens").optional(),
  as_of: z.string().optional(),
  test_end_chart: z.string().optional(),
  max_drawdown_pct: z.number().nullable().optional(),
  listed_public: z.boolean().optional(),
  change_note: z.string().optional(),
}).superRefine((data, ctx) => {
  // A far-future end year is a TradingView run setting. The real test end is
  // the last bar on the chart, and clients only ever see that (D10, A16).
  if (runEndIsInFuture(data.algorithm, data.algorithm_inputs, data.as_of || todayIso()) && !data.test_end_chart) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "The settings end date is in the future. Enter the date of the last bar on the chart.",
      path: ["test_end_chart"],
    });
  }
  if (data.asset_class !== "Crypto" && data.algorithm !== "Market Wave") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Equities and ETF recipes must use Market Wave",
      path: ["algorithm"],
    });
  }
  const normalizedAsset = data.asset.trim().toUpperCase();
  if (data.asset_class === "Crypto") {
    if (!CRYPTO_ASSETS.includes(normalizedAsset as (typeof CRYPTO_ASSETS)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a valid crypto asset",
        path: ["asset"],
      });
    }
  } else if (!TICKER_REGEX.test(normalizedAsset)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid ticker (1–10 letters, dots, or hyphens)",
      path: ["asset"],
    });
  }
});

type RecipeFormData = z.infer<typeof recipeSchema>;

interface RecipeScreenshot {
  id: string;
  image_url: string;
  display_order: number;
  file?: File;
  label?: string;
}

interface RecipeFormProps {
  /** For edit mode: versionToFormRecipe(open draft ?? published). `id` is the strategy id. */
  recipe?: any;
  /** The signed-in admin's role; a marketing editor saves copy only (A10). */
  role?: AdminRole | null;
  /** Called with the saved draft's version id. */
  onSuccess: (versionId?: string) => void;
  onCancel: () => void;
}

interface ImportMeta {
  extractionId: string | null;
  lastBarDate: string | null;
}

interface RecipeFormBodyProps extends RecipeFormProps {
  importedScreenshotFiles?: File[] | null;
  importMeta?: ImportMeta | null;
  onScreenshotImport?: (draft: ImportedRecipeDraft, files: File[], meta: ImportMeta) => void;
}

function screenshotsFromFiles(files: File[]): RecipeScreenshot[] {
  return files.map((file, index) => ({
    id: `temp_import_${Date.now()}_${index}`,
    image_url: URL.createObjectURL(file),
    display_order: index,
    file,
    label: RECIPE_SCREENSHOT_LABELS[RECIPE_SCREENSHOT_KINDS[index]] ?? `Screenshot ${index + 1}`,
  }));
}

export function RecipeForm(props: RecipeFormProps) {
  const [importNonce, setImportNonce] = useState(0);
  const [importedRecipe, setImportedRecipe] = useState<ImportedRecipeDraft | null>(null);
  const [importedFiles, setImportedFiles] = useState<File[] | null>(null);
  const [importMeta, setImportMeta] = useState<ImportMeta | null>(null);

  // An import keeps the strategy's identity and version copy when editing (A11).
  const recipe = importedRecipe
    ? {
        ...(props.recipe ?? {}),
        ...importedRecipe,
        id: props.recipe?.id,
        test_end_chart: importMeta?.lastBarDate ?? props.recipe?.test_end_chart ?? "",
      }
    : props.recipe;

  return (
    <RecipeFormBody
      key={importNonce}
      {...props}
      recipe={recipe}
      importedScreenshotFiles={importedFiles}
      importMeta={importMeta}
      onScreenshotImport={(draft, files, meta) => {
        setImportedRecipe(draft);
        setImportedFiles(files);
        setImportMeta(meta);
        setImportNonce((n) => n + 1);
      }}
    />
  );
}

function RecipeFormBody({
  recipe,
  role,
  onSuccess,
  onCancel,
  importedScreenshotFiles,
  importMeta,
  onScreenshotImport,
}: RecipeFormBodyProps) {
  const [loading, setLoading] = useState(false);
  const [screenshots, setScreenshots] = useState<RecipeScreenshot[]>(() =>
    importedScreenshotFiles?.length ? screenshotsFromFiles(importedScreenshotFiles) : [],
  );
  const [deletedScreenshots, setDeletedScreenshots] = useState<
    Array<{ id: string; image_url: string }>
  >([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [parsingScreenshots, setParsingScreenshots] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  // When editing, dropping 3 or 4 screenshots reads them and updates the fields (A11).
  const [autofillOnEdit, setAutofillOnEdit] = useState(true);
  const { toast } = useToast();
  const isMarketingEditor = role === "marketing_editor";

  const isEditMode = Boolean(recipe?.id);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      sell_above_cost_basis: true,
      exit_to_entry_proportion: 0,
      // Provide safe defaults so DB NOT NULL constraints are satisfied
      entry_trade: recipe?.entry_trade || 'See parameters',
      exit_trade: recipe?.exit_trade || 'See parameters',
      time_frame: (recipe?.time_frame as any) || '1 Day',
      backtesting_period: recipe?.backtesting_period || 'N/A',
      asset_class: recipe?.asset_class || "Equities",
      algorithm: recipe?.algorithm || "Market Wave",
      algorithm_inputs: recipe?.algorithm_inputs || {},
      as_of: todayIso(),
      listed_public: true,
      test_end_chart: "",
      change_note: "",
      ...recipe,
      max_drawdown_pct: recipe?.max_drawdown_pct ?? null,
    }
  });
  const watchedInputs = watch("algorithm_inputs");
  const watchedAsOf = watch("as_of");
  const needsChartEnd = runEndIsInFuture(watch("algorithm"), watchedInputs, watchedAsOf || todayIso());
  const selectedAlgorithm = watch("algorithm");
  const selectedAssetClass = watch("asset_class");
  const isEquitiesOrEtf = selectedAssetClass === "Equities" || selectedAssetClass === "ETFs";


  // Load existing screenshots for edit mode
  useEffect(() => {
    if (isEditMode && recipe?.id) {
      loadExistingScreenshots(recipe.id);
    }
  }, [isEditMode, recipe?.id]);

  const loadExistingScreenshots = async (recipeId: string) => {
    try {
      const existingScreenshots = await getRecipeScreenshots(recipeId);
      if (importedScreenshotFiles?.length) {
        // New screenshots were read into this edit: they replace the current set.
        setDeletedScreenshots(existingScreenshots.map((s) => ({ id: s.id, image_url: s.image_url })));
        return;
      }
      setScreenshots(existingScreenshots.map((s) => ({ ...s, label: s.kind ? s.kind[0].toUpperCase() + s.kind.slice(1) : undefined })));
      setDeletedScreenshots([]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const importFromScreenshots = async (files: File[]) => {
    setParsingScreenshots(true);
    try {
      for (const file of files) {
        const validationError = validateImage(file);
        if (validationError) {
          throw new Error(validationError.message);
        }
      }
      const result = await parseRecipeScreenshotsFromFiles(files, isEditMode ? recipe.id : null);
      toast({
        title: "Recipe filled from screenshots",
        description: result.warnings.length
          ? result.warnings.join(" ")
          : "Review the fields, then click Create Recipe.",
      });
      onScreenshotImport?.(result.recipe, result.orderedFiles, {
        extractionId: result.extractionId,
        lastBarDate: result.lastBarDate ?? null,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not read screenshots",
        description: error.message || "Failed to import recipe from screenshots",
      });
    } finally {
      setParsingScreenshots(false);
    }
  };

  const handleImageUpload = async (fileList: FileList | File[]) => {
    if (parsingScreenshots) return;
    const files = Array.from(fileList);

    const canImport = isEditMode ? autofillOnEdit && !isMarketingEditor : screenshots.length === 0;
    if (canImport && isImportableScreenshotCount(files.length)) {
      await importFromScreenshots(files);
      return;
    }

    if (screenshots.length + files.length > MAX_IMAGES_PER_RECIPE) {
      toast({
        variant: "destructive",
        title: "Too many images",
        description: `Maximum ${MAX_IMAGES_PER_RECIPE} images allowed per recipe`,
      });
      return;
    }

    setUploadingImages(true);
    const newScreenshots: RecipeScreenshot[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate image
        const validationError = validateImage(file);
        if (validationError) {
          toast({
            variant: "destructive",
            title: "Invalid image",
            description: validationError.message,
          });
          continue;
        }

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        
        newScreenshots.push({
          id: `temp_${Date.now()}_${i}`,
          image_url: previewUrl,
          display_order: screenshots.length + i,
          file
        });
      }

      setScreenshots(prev => [...prev, ...newScreenshots]);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageUpload(files);
    }
  };

  const removeScreenshot = (index: number) => {
    const screenshot = screenshots[index];

    if (screenshot.id.startsWith("temp_")) {
      URL.revokeObjectURL(screenshot.image_url);
    } else {
      setDeletedScreenshots((prev) => [
        ...prev,
        { id: screenshot.id, image_url: screenshot.image_url },
      ]);
    }

    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  const moveScreenshot = (fromIndex: number, toIndex: number) => {
    setScreenshots(prev => {
      const newScreenshots = [...prev];
      const [moved] = newScreenshots.splice(fromIndex, 1);
      newScreenshots.splice(toIndex, 0, moved);
      
      // Update display order
      return newScreenshots.map((screenshot, index) => ({
        ...screenshot,
        display_order: index
      }));
    });
  };

  const onSubmit = async (data: RecipeFormData) => {
    setLoading(true);

    try {
      // Every save writes a draft version; nothing reaches clients until an
      // approver publishes it (A2). The database derives return, CAGR and the
      // benchmark deltas (D3), so none are computed here.
      const fields = formToVersionFields(
        { ...data, algorithm: data.algorithm ?? "Market Wave" } as FormValues,
        {
          role: role ?? null,
          strategyType: isEditMode ? recipe.strategy_type : (data.algorithm ?? "Market Wave"),
          buyHoldPnlPct: resolveBuyHoldPnlPercentForSave(data.algorithm, data.algorithm_inputs),
          dcaPnlPct: resolveDcaPnlPercentForSave(data.algorithm, data.algorithm_inputs),
          extractionId: importMeta?.extractionId ?? recipe?.extraction_id ?? null,
        },
      );
      const versionId = await saveDraft(isEditMode ? recipe.id : null, fields);

      if (!isMarketingEditor) {
        const strategyId = isEditMode ? recipe.id : await strategyIdForVersion(versionId);

        // Removing a screenshot unlinks it; the file stays for published versions.
        for (const deleted of deletedScreenshots) {
          await removeRecipeImage(deleted.id);
        }

        const newImageFiles = screenshots.filter((s) => s.file);
        for (const screenshot of newImageFiles) {
          if (screenshot.file) {
            await uploadRecipeImage(
              screenshot.file,
              strategyId,
              screenshot.display_order,
              kindFromLabel(screenshot.label),
            );
          }
        }

        if (deletedScreenshots.length > 0 || newImageFiles.length > 0) {
          await refreshDraftScreenshots(versionId);
        }
      }

      toast({
        title: "Draft saved",
        description: "Review the checks, then submit it for publishing.",
      });

      onSuccess(versionId);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderScreenshotsSection = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Screenshots</h3>
        {!isEditMode && (
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Auto-fill
          </Badge>
        )}
        {isEditMode && !isMarketingEditor && (
          <label className="ml-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={autofillOnEdit} onCheckedChange={(c) => setAutofillOnEdit(!!c)} />
            Dropping 3 or 4 new screenshots updates the fields
          </label>
        )}
      </div>

      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            {parsingScreenshots ? (
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            ) : (
              <ImageIcon
                className={`mx-auto h-12 w-12 transition-colors ${
                  isDragOver ? "text-primary" : "text-muted-foreground"
                }`}
              />
            )}
            <div className="mt-4">
              <Label htmlFor="image-upload" className="cursor-pointer">
                <span
                  className={`mt-2 block text-sm font-medium transition-colors ${
                    isDragOver ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {parsingScreenshots
                    ? "Reading screenshots…"
                    : isDragOver
                      ? "Drop images here"
                      : isEditMode
                        ? "Upload screenshots"
                        : "Drop 3 or 4 screenshots to auto-fill"}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {isEditMode
                    ? `PNG, JPG, WEBP up to 5MB each (max ${MAX_IMAGES_PER_RECIPE} images)`
                    : "Chart, Settings, and Stats required. DCA optional. PNG, JPG, or WEBP up to 5MB each."}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {isEditMode
                    ? "Or drag and drop images here"
                    : "We'll classify them, fill every field, and attach Chart first as the card thumbnail. Without DCA, that benchmark stays blank."}
                </span>
              </Label>
              <Input
                id="image-upload"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                className="hidden"
                disabled={uploadingImages || parsingScreenshots}
              />
            </div>
          </div>
        </div>

        {screenshots.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Uploaded Screenshots ({screenshots.length}/{MAX_IMAGES_PER_RECIPE})
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {screenshots.map((screenshot, index) => (
                <div key={screenshot.id} className="relative group">
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={screenshot.image_url}
                      alt={screenshot.label || `Screenshot ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeScreenshot(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-xs">
                      {screenshot.label || index + 1}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(uploadingImages || parsingScreenshots) && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">
              {parsingScreenshots ? "Reading screenshots…" : "Uploading images..."}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const renderVersionSection = () => (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-lg font-semibold">Version</h3>
        <p className="text-sm text-muted-foreground">
          Saving writes a draft. Clients see nothing until an approver publishes it.
          {isMarketingEditor && " As a marketing editor, only the title, short name, goal and change note are saved."}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...register("title")} placeholder="Defaults to the goal" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="short_name">Short name</Label>
          <Input id="short_name" {...register("short_name")} placeholder="e.g. MARA LTH 1W Position" />
        </div>
        {!isMarketingEditor && (
          <>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input id="slug" {...register("slug")} placeholder="Generated when blank" />
              {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="as_of">As-of date</Label>
              <Input id="as_of" type="date" {...register("as_of")} />
            </div>
            <div className={`space-y-2 ${needsChartEnd ? "rounded-md border border-destructive/60 bg-destructive/5 p-2" : ""}`}>
              <Label htmlFor="test_end_chart">
                Test end — last bar on the chart{needsChartEnd ? " *" : ""}
              </Label>
              <Input id="test_end_chart" type="date" {...register("test_end_chart")} />
              <p className="text-xs text-muted-foreground">
                {needsChartEnd
                  ? "The settings end date is a far-future run setting. Clients see this date instead."
                  : "Leave blank to use the end date in the settings."}
                {importMeta?.lastBarDate ? ` Read from the chart: ${importMeta.lastBarDate}.` : ""}
              </p>
              {errors.test_end_chart && <p className="text-sm text-destructive">{errors.test_end_chart.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_drawdown_pct">Max drawdown % (optional)</Label>
              <Input
                id="max_drawdown_pct"
                type="number"
                step="0.01"
                {...register("max_drawdown_pct", { setValueAs: (v) => (v === "" || v === null || v === undefined ? null : Number(v)) })}
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="listed_public"
                defaultChecked={recipe?.listed_public ?? true}
                onCheckedChange={(checked) => setValue("listed_public", !!checked)}
              />
              <Label htmlFor="listed_public">Listed on the public Strategy Lab</Label>
            </div>
          </>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="change_note">Change note</Label>
          <Textarea id="change_note" {...register("change_note")} placeholder="What changed and why" rows={2} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? 'Edit Recipe' : 'Create New Recipe'}</CardTitle>
          <CardDescription>
            {isEditMode 
              ? 'Changes are saved as a draft version for review' 
              : 'Drop 3 screenshots (chart, settings, stats) to auto-fill, or 4 to include DCA'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {!isEditMode && renderScreenshotsSection()}
            {importMeta && importMeta.extractionId === null && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The screenshot reading was not recorded, so the review will not cross-check these figures against it.
                </AlertDescription>
              </Alert>
            )}
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Recipe Name *</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="e.g., [BTC] STH Recipe No. 1"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="asset_class">Asset Class *</Label>
                  <Select
                    onValueChange={(value) => {
                      setValue("asset_class", value as "Equities" | "ETFs" | "Crypto");
                      if (value !== "Crypto") {
                        setValue("algorithm", "Market Wave");
                      }
                    }}
                    defaultValue={recipe?.asset_class || "Equities"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Equities">Equities</SelectItem>
                      <SelectItem value="ETFs">ETFs</SelectItem>
                      <SelectItem value="Crypto">Crypto</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.asset_class && (
                    <p className="text-sm text-destructive">{errors.asset_class.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="asset">Asset *</Label>
                  {selectedAssetClass === "Crypto" ? (
                    <Select onValueChange={(value) => setValue("asset", value)} defaultValue={recipe?.asset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {CRYPTO_ASSETS.map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="asset"
                      {...register("asset", {
                        onChange: (e) => {
                          e.target.value = e.target.value.toUpperCase().trim();
                        },
                      })}
                      defaultValue={recipe?.asset}
                      placeholder="e.g., AAPL, SPY"
                      maxLength={10}
                    />
                  )}
                  {errors.asset && (
                    <p className="text-sm text-destructive">{errors.asset.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_horizon">Time Horizon *</Label>
                  <Select onValueChange={(value) => setValue("time_horizon", value as "STH" | "LTH")} defaultValue={recipe?.time_horizon}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time horizon" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STH">STH (Short Term)</SelectItem>
                      <SelectItem value="LTH">LTH (Long Term)</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.time_horizon && (
                    <p className="text-sm text-destructive">{errors.time_horizon.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="focus">Focus *</Label>
                  <Select onValueChange={(value) => setValue("focus", value as "Cash Yielding" | "Balanced" | "Accumulation")} defaultValue={recipe?.focus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select focus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash Yielding">Cash Yielding</SelectItem>
                      <SelectItem value="Balanced">Balanced</SelectItem>
                      <SelectItem value="Accumulation">Accumulation</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.focus && (
                    <p className="text-sm text-destructive">{errors.focus.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Goal *</Label>
                <Textarea
                  id="goal"
                  {...register("goal")}
                  placeholder="Describe the recipe's objective..."
                  rows={3}
                />
                {errors.goal && (
                  <p className="text-sm text-destructive">{errors.goal.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_frame">Chart Time Frame *</Label>
                <Select onValueChange={(value) => setValue("time_frame", value as any)} defaultValue={(recipe?.time_frame as any) || '1 Day'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time frame" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 Week">1 Week</SelectItem>
                    <SelectItem value="1 Day">1 Day</SelectItem>
                    <SelectItem value="6 Hours">6 Hours</SelectItem>
                    <SelectItem value="4 Hours">4 Hours</SelectItem>
                    <SelectItem value="1 Hour">1 Hour</SelectItem>
                  </SelectContent>
                </Select>
                {errors.time_frame && (
                  <p className="text-sm text-destructive">{errors.time_frame.message as any}</p>
                )}
              </div>
            </div>

            {/* Algorithm */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Algorithm</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="algorithm">Algorithm *</Label>
                  <Select
                    onValueChange={(value) => setValue("algorithm", value as any)}
                    defaultValue={recipe?.algorithm || "Market Wave"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select algorithm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Intelligence Algorithm" disabled={isEquitiesOrEtf}>Intelligence Algorithm</SelectItem>
                      <SelectItem value="Arbitrage Algorithm" disabled={isEquitiesOrEtf}>Arbitrage Algorithm</SelectItem>
                      <SelectItem value="Oracle Protocol" disabled={isEquitiesOrEtf}>Oracle Protocol (Legacy)</SelectItem>
                      <SelectItem value="Market Wave">Market Wave</SelectItem>
                    </SelectContent>
                  </Select>
                  {isEquitiesOrEtf && (
                    <p className="text-sm text-muted-foreground">Equities and ETF recipes require Market Wave.</p>
                  )}
                  {errors.algorithm && (
                    <p className="text-sm text-destructive">{errors.algorithm.message}</p>
                  )}
                </div>
              </div>

              {/* Intelligence Algorithm Inputs */}
              {selectedAlgorithm === 'Intelligence Algorithm' && (
                <div className="space-y-4 border rounded-md p-4">
                  <h4 className="font-medium">Intelligence Algorithm Inputs</h4>

                  <div className="space-y-2">
                    <Label>Repeat Purchase Method</Label>
                    <Select
                      onValueChange={(value) => setValue('algorithm_inputs.repeatPurchaseMethod' as any, value)}
                      defaultValue={(recipe?.algorithm_inputs?.repeatPurchaseMethod as string) || 'Every Bar'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Every Bar">Every Bar</SelectItem>
                        <SelectItem value="Daily">Daily</SelectItem>
                        <SelectItem value="Weekly">Weekly</SelectItem>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label>Start Year</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.start?.year}
                        {...register('algorithm_inputs.start.year' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Month</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.start?.month}
                        {...register('algorithm_inputs.start.month' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Day</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.start?.day}
                        {...register('algorithm_inputs.start.day' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Hour (24h)</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.start?.hour}
                        {...register('algorithm_inputs.start.hour' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Minute</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.start?.minute}
                        {...register('algorithm_inputs.start.minute' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>End Year</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.end?.year}
                        {...register('algorithm_inputs.end.year' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Month</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.end?.month}
                        {...register('algorithm_inputs.end.month' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Day</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.end?.day}
                        {...register('algorithm_inputs.end.day' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Number of Bars (Start X Bars Back)</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.startBarsBack?.bars}
                        {...register('algorithm_inputs.startBarsBack.bars' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="flex items-center space-x-2 mt-6">
                      <Checkbox
                        id="exitFullOnLast"
                        defaultChecked={!!recipe?.algorithm_inputs?.backtest?.exitFullOnLastBar}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.backtest.exitFullOnLastBar' as any, !!checked)}
                      />
                      <Label htmlFor="exitFullOnLast">Exit Full Position on Last Historical Bar</Label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="intelligenceEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.activate?.enabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.activate.enabled' as any, !!checked)}
                      />
                      <Label htmlFor="intelligenceEnabled">Activate Intelligence</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Intelligence Factor</Label>
                      <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.activate?.factor}
                        {...register('algorithm_inputs.activate.factor' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  {/* Properties Section */}
                  <div className="space-y-3 border-t pt-4 mt-4">
                    <h5 className="font-medium">Properties</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Initial Capital</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.properties?.initialCapital}
                          {...register('algorithm_inputs.properties.initialCapital' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Order Size</Label>
                        <div className="flex gap-2">
                          <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.properties?.orderSize?.value}
                            {...register('algorithm_inputs.properties.orderSize.value' as any, { valueAsNumber: true })} />
                          <Select
                            onValueChange={(value) => setValue('algorithm_inputs.properties.orderSize.type' as any, value)}
                            defaultValue={(recipe?.algorithm_inputs?.properties?.orderSize?.type as string) || 'Currency'}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Quantity">Quantity</SelectItem>
                              <SelectItem value="Currency">Currency</SelectItem>
                              <SelectItem value="% of Equity">% of Equity</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Pyramiding</Label>
                        <Input type="number" step="1" defaultValue={recipe?.algorithm_inputs?.properties?.pyramiding}
                          {...register('algorithm_inputs.properties.pyramiding' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Arbitrage Algorithm Inputs */}
              {selectedAlgorithm === 'Arbitrage Algorithm' && (
                <div className="space-y-4 border rounded-md p-4">
                  <h4 className="font-medium">Arbitrage Algorithm Inputs</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="arbLongEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.longThreshold?.enabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.longThreshold.enabled' as any, !!checked)}
                      />
                      <Label htmlFor="arbLongEnabled">Enable Long Threshold</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Long Threshold (%)</Label>
                      <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.longThreshold?.percent}
                        {...register('algorithm_inputs.longThreshold.percent' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="arbExitEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.exitThreshold?.enabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.exitThreshold.enabled' as any, !!checked)}
                      />
                      <Label htmlFor="arbExitEnabled">Enable Exit Threshold</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Exit Threshold (%)</Label>
                      <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.exitThreshold?.percent}
                        {...register('algorithm_inputs.exitThreshold.percent' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-medium">Cost Basis</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="arbOnlySellAbove"
                          defaultChecked={!!recipe?.algorithm_inputs?.costBasis?.onlySellAbove}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.costBasis.onlySellAbove' as any, !!checked)}
                        />
                        <Label htmlFor="arbOnlySellAbove">Only Sell Above Cost Basis</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="arbShowOnChart"
                          defaultChecked={!!recipe?.algorithm_inputs?.costBasis?.showOnChart}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.costBasis.showOnChart' as any, !!checked)}
                        />
                        <Label htmlFor="arbShowOnChart">Show on chart</Label>
                      </div>
                      <div className="space-y-2">
                        <Label>Average Price Mode</Label>
                        <Select
                          onValueChange={(value) => setValue('algorithm_inputs.costBasis.avgPriceMode' as any, value)}
                          defaultValue={(recipe?.algorithm_inputs?.costBasis?.avgPriceMode as string) || 'Auto'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Auto">Auto</SelectItem>
                            <SelectItem value="Manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Total Cost Basis (not avg)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.costBasis?.totalCostBasis}
                          {...register('algorithm_inputs.costBasis.totalCostBasis' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Quantity</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.costBasis?.totalQty}
                          {...register('algorithm_inputs.costBasis.totalQty' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="arbTradeInitial"
                          defaultChecked={!!recipe?.algorithm_inputs?.costBasis?.tradeInitialPosition}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.costBasis.tradeInitialPosition' as any, !!checked)}
                        />
                        <Label htmlFor="arbTradeInitial">Trade Initial Position</Label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Entry Trade Size ($)</Label>
                      <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.entry}
                        {...register('algorithm_inputs.tradeSize.entry' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Exit Trade Size ($)</Label>
                      <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.exit}
                        {...register('algorithm_inputs.tradeSize.exit' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label>Start Year</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.year}
                        {...register('algorithm_inputs.dates.start.year' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Month</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.month}
                        {...register('algorithm_inputs.dates.start.month' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Day</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.day}
                        {...register('algorithm_inputs.dates.start.day' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Hour (24h)</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.hour}
                        {...register('algorithm_inputs.dates.start.hour' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Minute</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.minute}
                        {...register('algorithm_inputs.dates.start.minute' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>End Year</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.year}
                        {...register('algorithm_inputs.dates.end.year' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Month</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.month}
                        {...register('algorithm_inputs.dates.end.month' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Day</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.day}
                        {...register('algorithm_inputs.dates.end.day' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Number of Bars (Start X Bars Back)</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.startBarsBack?.bars}
                        {...register('algorithm_inputs.startBarsBack.bars' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="flex items-center space-x-2 mt-6">
                      <Checkbox
                        id="arbExitLast"
                        defaultChecked={!!recipe?.algorithm_inputs?.backtest?.exitFullOnLastBar}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.backtest.exitFullOnLastBar' as any, !!checked)}
                      />
                      <Label htmlFor="arbExitLast">Exit Full Position on Last Historical Bar</Label>
                    </div>
                    <div className="flex items-center space-x-2 mt-6">
                      <Checkbox
                        id="arbLimitToCap"
                        defaultChecked={!!recipe?.algorithm_inputs?.backtest?.limitToCapital}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.backtest.limitToCapital' as any, !!checked)}
                      />
                      <Label htmlFor="arbLimitToCap">Limit to Available Capital</Label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="arbShowStatus"
                      defaultChecked={!!recipe?.algorithm_inputs?.inputsUI?.showInStatusLine}
                      onCheckedChange={(checked) => setValue('algorithm_inputs.inputsUI.showInStatusLine' as any, !!checked)}
                    />
                    <Label htmlFor="arbShowStatus">Inputs in status line</Label>
                  </div>
                </div>
              )}

              {/* Oracle Protocol Inputs */}
              {selectedAlgorithm === 'Oracle Protocol' && (
                <div className="space-y-4 border rounded-md p-4">
                  <h4 className="font-medium">Oracle Protocol Inputs</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="orcLongEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.longThreshold?.enabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.longThreshold.enabled' as any, !!checked)}
                      />
                      <Label htmlFor="orcLongEnabled">Enable Long Threshold</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Long Threshold (%)</Label>
                      <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.longThreshold?.percent}
                        {...register('algorithm_inputs.longThreshold.percent' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="orcExitEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.exitThreshold?.enabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.exitThreshold.enabled' as any, !!checked)}
                      />
                      <Label htmlFor="orcExitEnabled">Enable Exit Threshold</Label>
                    </div>
                    <div className="space-y-2">
                      <Label>Exit Threshold (%)</Label>
                      <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.exitThreshold?.percent}
                        {...register('algorithm_inputs.exitThreshold.percent' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-medium">Cost Basis</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="orcOnlySellAbove"
                          defaultChecked={!!recipe?.algorithm_inputs?.costBasis?.onlySellAbove}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.costBasis.onlySellAbove' as any, !!checked)}
                        />
                        <Label htmlFor="orcOnlySellAbove">Only Sell Above Cost Basis</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="orcShowOnChart"
                          defaultChecked={!!recipe?.algorithm_inputs?.costBasis?.showOnChart}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.costBasis.showOnChart' as any, !!checked)}
                        />
                        <Label htmlFor="orcShowOnChart">Show on chart</Label>
                      </div>
                      <div className="space-y-2">
                        <Label>Sell Profit Threshold (%)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.costBasis?.sellProfitThreshold}
                          {...register('algorithm_inputs.costBasis.sellProfitThreshold' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="orcBuyBelowOnly"
                          defaultChecked={!!recipe?.algorithm_inputs?.costBasis?.buyBelowOnly}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.costBasis.buyBelowOnly' as any, !!checked)}
                        />
                        <Label htmlFor="orcBuyBelowOnly">Buy Below Cost Basis Only</Label>
                      </div>
                      <div className="space-y-2">
                        <Label>Average Price Mode</Label>
                        <Select
                          onValueChange={(value) => setValue('algorithm_inputs.costBasis.avgPriceMode' as any, value)}
                          defaultValue={(recipe?.algorithm_inputs?.costBasis?.avgPriceMode as string) || 'Auto'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Auto">Auto</SelectItem>
                            <SelectItem value="Manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Total Cost Basis (not avg)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.costBasis?.totalCostBasis}
                          {...register('algorithm_inputs.costBasis.totalCostBasis' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Quantity</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.costBasis?.totalQty}
                          {...register('algorithm_inputs.costBasis.totalQty' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="orcTradeInitial"
                          defaultChecked={!!recipe?.algorithm_inputs?.costBasis?.tradeInitialPosition}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.costBasis.tradeInitialPosition' as any, !!checked)}
                        />
                        <Label htmlFor="orcTradeInitial">Trade Initial Position</Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-medium">Trade Size</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Primary Trade Size Type</Label>
                        <Select
                          onValueChange={(value) => setValue('algorithm_inputs.tradeSize.primaryType' as any, value)}
                          defaultValue={(recipe?.algorithm_inputs?.tradeSize?.primaryType as string) || 'Fixed'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Fixed">Fixed</SelectItem>
                            <SelectItem value="Percent">Percent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Entry Trade Size (Percentage)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.entryPercent}
                          {...register('algorithm_inputs.tradeSize.entryPercent' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Exit Trade Size (Percentage)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.exitPercent}
                          {...register('algorithm_inputs.tradeSize.exitPercent' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="orcUseFixedMin"
                        defaultChecked={!!recipe?.algorithm_inputs?.tradeSize?.useFixedAsMin}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.tradeSize.useFixedAsMin' as any, !!checked)}
                      />
                      <Label htmlFor="orcUseFixedMin">Use Fixed Trade Size as Minimum Limit (Percentage)</Label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entry Trade Size (Fixed)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.entryFixed}
                          {...register('algorithm_inputs.tradeSize.entryFixed' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Exit Trade Size (Fixed)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.exitFixed}
                          {...register('algorithm_inputs.tradeSize.exitFixed' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label>Start Year</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.year}
                        {...register('algorithm_inputs.dates.start.year' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Month</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.month}
                        {...register('algorithm_inputs.dates.start.month' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Day</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.day}
                        {...register('algorithm_inputs.dates.start.day' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Hour (24h)</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.hour}
                        {...register('algorithm_inputs.dates.start.hour' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Minute</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.minute}
                        {...register('algorithm_inputs.dates.start.minute' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>End Year</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.year}
                        {...register('algorithm_inputs.dates.end.year' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Month</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.month}
                        {...register('algorithm_inputs.dates.end.month' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Day</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.day}
                        {...register('algorithm_inputs.dates.end.day' as any, { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Number of Bars (Start X Bars Back)</Label>
                      <Input type="number" defaultValue={recipe?.algorithm_inputs?.startBarsBack?.bars}
                        {...register('algorithm_inputs.startBarsBack.bars' as any, { valueAsNumber: true })} />
                    </div>
                    <div className="flex items-center space-x-2 mt-6">
                      <Checkbox
                        id="orcExitLast"
                        defaultChecked={!!recipe?.algorithm_inputs?.backtest?.exitFullOnLastBar}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.backtest.exitFullOnLastBar' as any, !!checked)}
                      />
                      <Label htmlFor="orcExitLast">Exit Full Position on Last Historical Bar</Label>
                    </div>
                    <div className="flex items-center space-x-2 mt-6">
                      <Checkbox
                        id="orcLimitToCap"
                        defaultChecked={!!recipe?.algorithm_inputs?.backtest?.limitToCapital}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.backtest.limitToCapital' as any, !!checked)}
                      />
                      <Label htmlFor="orcLimitToCap">Limit to Available Capital</Label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="orcShowStatus"
                      defaultChecked={!!recipe?.algorithm_inputs?.inputsUI?.showInStatusLine}
                      onCheckedChange={(checked) => setValue('algorithm_inputs.inputsUI.showInStatusLine' as any, !!checked)}
                    />
                    <Label htmlFor="orcShowStatus">Inputs in status line</Label>
                  </div>

                  <div className="space-y-3">
                    <h5 className="font-medium">Properties</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Initial Capital</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.properties?.initialCapital}
                          {...register('algorithm_inputs.properties.initialCapital' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Order Size</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.properties?.orderSize?.value}
                          {...register('algorithm_inputs.properties.orderSize.value' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Order Size Type</Label>
                        <Select
                          onValueChange={(value) => setValue('algorithm_inputs.properties.orderSize.type' as any, value)}
                          defaultValue={(recipe?.algorithm_inputs?.properties?.orderSize?.type as string) || '% of Equity'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Quantity">Quantity</SelectItem>
                            <SelectItem value="Currency">Currency</SelectItem>
                            <SelectItem value="% of Equity">% of Equity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Pyramiding (orders)</Label>
                        <Input type="number" step="1" defaultValue={recipe?.algorithm_inputs?.properties?.pyramiding}
                          {...register('algorithm_inputs.properties.pyramiding' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Market Wave Inputs — Crypto variant (unchanged) */}
              {selectedAlgorithm === 'Market Wave' && selectedAssetClass === 'Crypto' && (
                <div className="space-y-4 border rounded-md p-4">
                  <h4 className="font-medium">Market Wave Inputs</h4>

                  {/* User Initial Capital */}
                  <div className="space-y-3">
                    <h5 className="font-medium">User Initial Capital</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Starting Cash ($)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.userInitialCapital?.startingCash}
                          {...register('algorithm_inputs.userInitialCapital.startingCash' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Starting Crypto Quantity</Label>
                        <Input type="number" step="0.00000001" defaultValue={recipe?.algorithm_inputs?.userInitialCapital?.startingCryptoQty}
                          {...register('algorithm_inputs.userInitialCapital.startingCryptoQty' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Order Entry & Exit Rules */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Order Entry &amp; Exit Rules</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="mwLongEnabled"
                            defaultChecked={!!recipe?.algorithm_inputs?.longThreshold?.enabled}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.longThreshold.enabled' as any, !!checked)}
                          />
                          <Label htmlFor="mwLongEnabled">Long Threshold (%)</Label>
                        </div>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.longThreshold?.percent}
                          {...register('algorithm_inputs.longThreshold.percent' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="mwExitEnabled"
                            defaultChecked={!!recipe?.algorithm_inputs?.exitThreshold?.enabled}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.exitThreshold.enabled' as any, !!checked)}
                          />
                          <Label htmlFor="mwExitEnabled">Exit Threshold (%)</Label>
                        </div>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.exitThreshold?.percent}
                          {...register('algorithm_inputs.exitThreshold.percent' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Trade Size */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Trade Size ($5 min)</h5>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mwFixedEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.tradeSize?.fixedEnabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.tradeSize.fixedEnabled' as any, !!checked)}
                      />
                      <Label htmlFor="mwFixedEnabled">Fixed Trade Size</Label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entry Trade Size ($)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.entryFixed}
                          {...register('algorithm_inputs.tradeSize.entryFixed' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Exit Trade Size ($)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.exitFixed}
                          {...register('algorithm_inputs.tradeSize.exitFixed' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mwPercentEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.tradeSize?.percentEnabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.tradeSize.percentEnabled' as any, !!checked)}
                      />
                      <Label htmlFor="mwPercentEnabled">Percentage Trade Size</Label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entry Trade Size (%)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.entryPercent}
                          {...register('algorithm_inputs.tradeSize.entryPercent' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Exit Trade Size (%)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.exitPercent}
                          {...register('algorithm_inputs.tradeSize.exitPercent' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Market Wave */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Market Wave</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Scope (0.5=micro 10=macro)</Label>
                        <Input type="number" step="0.1" defaultValue={recipe?.algorithm_inputs?.marketWave?.scope}
                          {...register('algorithm_inputs.marketWave.scope' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="flex flex-col gap-2 md:mt-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="mwMwOnlySellAbove"
                            defaultChecked={!!recipe?.algorithm_inputs?.marketWave?.onlySellAbove}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.marketWave.onlySellAbove' as any, !!checked)}
                          />
                          <Label htmlFor="mwMwOnlySellAbove">Only Sell Above</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="mwMwOnlyBuyBelow"
                            defaultChecked={!!recipe?.algorithm_inputs?.marketWave?.onlyBuyBelow}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.marketWave.onlyBuyBelow' as any, !!checked)}
                          />
                          <Label htmlFor="mwMwOnlyBuyBelow">Only Buy Below</Label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Sell Buffer (%)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.marketWave?.sellBuffer}
                          {...register('algorithm_inputs.marketWave.sellBuffer' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Buy Buffer (%)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.marketWave?.buyBuffer}
                          {...register('algorithm_inputs.marketWave.buyBuffer' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Static Market Price Filter */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Static Market Price Filter</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="mwStaticSellAboveEnabled"
                            defaultChecked={!!recipe?.algorithm_inputs?.staticPriceFilter?.sellAboveEnabled}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.staticPriceFilter.sellAboveEnabled' as any, !!checked)}
                          />
                          <Label htmlFor="mwStaticSellAboveEnabled">Only Sell Above</Label>
                        </div>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.staticPriceFilter?.sellAbove}
                          {...register('algorithm_inputs.staticPriceFilter.sellAbove' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="mwStaticBuyBelowEnabled"
                            defaultChecked={!!recipe?.algorithm_inputs?.staticPriceFilter?.buyBelowEnabled}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.staticPriceFilter.buyBelowEnabled' as any, !!checked)}
                          />
                          <Label htmlFor="mwStaticBuyBelowEnabled">Only Buy Below</Label>
                        </div>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.staticPriceFilter?.buyBelow}
                          {...register('algorithm_inputs.staticPriceFilter.buyBelow' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Trend Filter */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Trend Filter</h5>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mwTrendBuyUp"
                          defaultChecked={!!recipe?.algorithm_inputs?.trendFilter?.buyOnUpTrend}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.trendFilter.buyOnUpTrend' as any, !!checked)}
                        />
                        <Label htmlFor="mwTrendBuyUp">Buy on change of trend (Up Trend breakout)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mwTrendSellDown"
                          defaultChecked={!!recipe?.algorithm_inputs?.trendFilter?.sellOnDownTrend}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.trendFilter.sellOnDownTrend' as any, !!checked)}
                        />
                        <Label htmlFor="mwTrendSellDown">Sell on change of trend (Down Trend breakout)</Label>
                      </div>
                    </div>
                  </div>

                  {/* Start Date / Time */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Start Date / Time</h5>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.year}
                          {...register('algorithm_inputs.dates.start.year' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Month</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.month}
                          {...register('algorithm_inputs.dates.start.month' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Day</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.day}
                          {...register('algorithm_inputs.dates.start.day' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Hour (24h)</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.hour}
                          {...register('algorithm_inputs.dates.start.hour' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Minute</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.minute}
                          {...register('algorithm_inputs.dates.start.minute' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* End Date */}
                  <div className="space-y-3">
                    <h5 className="font-medium">End Date</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.year}
                          {...register('algorithm_inputs.dates.end.year' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Month</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.month}
                          {...register('algorithm_inputs.dates.end.month' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Day</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.day}
                          {...register('algorithm_inputs.dates.end.day' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Backtesting */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Backtesting</h5>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="mwExitFullOnLast"
                        defaultChecked={!!recipe?.algorithm_inputs?.backtest?.exitFullOnLastBar}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.backtest.exitFullOnLastBar' as any, !!checked)}
                      />
                      <Label htmlFor="mwExitFullOnLast">Exit Full Position on Last Historical Bar</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Market Wave Inputs — Equities/ETF variant */}
              {selectedAlgorithm === 'Market Wave' && isEquitiesOrEtf && (
                <div className="space-y-4 border rounded-md p-4">
                  <h4 className="font-medium">Market Wave Inputs</h4>

                  {/* User Initial Capital */}
                  <div className="space-y-3">
                    <h5 className="font-medium">User Initial Capital</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Starting Cash ($)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.userInitialCapital?.startingCash}
                          {...register('algorithm_inputs.userInitialCapital.startingCash' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Starting Share Quantity</Label>
                        <Input type="number" step="1" defaultValue={recipe?.algorithm_inputs?.userInitialCapital?.startingQty}
                          {...register('algorithm_inputs.userInitialCapital.startingQty' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Order Entry & Exit Rules */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Order Entry &amp; Exit Rules</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="eqMwLongEnabled"
                            defaultChecked={!!recipe?.algorithm_inputs?.longThreshold?.enabled}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.longThreshold.enabled' as any, !!checked)}
                          />
                          <Label htmlFor="eqMwLongEnabled">Long Threshold (%)</Label>
                        </div>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.longThreshold?.percent}
                          {...register('algorithm_inputs.longThreshold.percent' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="eqMwExitEnabled"
                            defaultChecked={!!recipe?.algorithm_inputs?.exitThreshold?.enabled}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.exitThreshold.enabled' as any, !!checked)}
                          />
                          <Label htmlFor="eqMwExitEnabled">Exit Threshold (%)</Label>
                        </div>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.exitThreshold?.percent}
                          {...register('algorithm_inputs.exitThreshold.percent' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Trade Size */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Trade Size ($5 min)</h5>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="eqMwSharesEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.tradeSize?.sharesEnabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.tradeSize.sharesEnabled' as any, !!checked)}
                      />
                      <Label htmlFor="eqMwSharesEnabled">Shares Trade Size</Label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entry Trade Size (shares)</Label>
                        <Input type="number" step="1" defaultValue={recipe?.algorithm_inputs?.tradeSize?.entryShares}
                          {...register('algorithm_inputs.tradeSize.entryShares' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Exit Trade Size (shares)</Label>
                        <Input type="number" step="1" defaultValue={recipe?.algorithm_inputs?.tradeSize?.exitShares}
                          {...register('algorithm_inputs.tradeSize.exitShares' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="eqMwFixedEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.tradeSize?.fixedEnabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.tradeSize.fixedEnabled' as any, !!checked)}
                      />
                      <Label htmlFor="eqMwFixedEnabled">Fixed Trade Size</Label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entry Trade Size ($)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.entryFixed}
                          {...register('algorithm_inputs.tradeSize.entryFixed' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Exit Trade Size ($)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.exitFixed}
                          {...register('algorithm_inputs.tradeSize.exitFixed' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="eqMwPercentEnabled"
                        defaultChecked={!!recipe?.algorithm_inputs?.tradeSize?.percentEnabled}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.tradeSize.percentEnabled' as any, !!checked)}
                      />
                      <Label htmlFor="eqMwPercentEnabled">Percentage Trade Size</Label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Entry Trade Size (%)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.entryPercent}
                          {...register('algorithm_inputs.tradeSize.entryPercent' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Exit Trade Size (%)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.tradeSize?.exitPercent}
                          {...register('algorithm_inputs.tradeSize.exitPercent' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="eqMwRoundDownWholeShares"
                        defaultChecked={!!recipe?.algorithm_inputs?.tradeSize?.roundDownWholeShares}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.tradeSize.roundDownWholeShares' as any, !!checked)}
                      />
                      <Label htmlFor="eqMwRoundDownWholeShares">Round Down to Whole Shares (Dollar &amp; % modes)</Label>
                    </div>
                  </div>

                  {/* Market Wave */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Market Wave</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Scope (0.5=micro 20=macro)</Label>
                        <Input type="number" step="0.1" defaultValue={recipe?.algorithm_inputs?.marketWave?.scope}
                          {...register('algorithm_inputs.marketWave.scope' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="flex flex-col gap-2 md:mt-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="eqMwMwOnlySellAbove"
                            defaultChecked={!!recipe?.algorithm_inputs?.marketWave?.onlySellAbove}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.marketWave.onlySellAbove' as any, !!checked)}
                          />
                          <Label htmlFor="eqMwMwOnlySellAbove">Only Sell Above</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="eqMwMwOnlyBuyBelow"
                            defaultChecked={!!recipe?.algorithm_inputs?.marketWave?.onlyBuyBelow}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.marketWave.onlyBuyBelow' as any, !!checked)}
                          />
                          <Label htmlFor="eqMwMwOnlyBuyBelow">Only Buy Below</Label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Sell Buffer (%)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.marketWave?.sellBuffer}
                          {...register('algorithm_inputs.marketWave.sellBuffer' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Buy Buffer (%)</Label>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.marketWave?.buyBuffer}
                          {...register('algorithm_inputs.marketWave.buyBuffer' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Static Market Price Filter */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Static Market Price Filter</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="eqMwStaticSellAboveEnabled"
                            defaultChecked={!!recipe?.algorithm_inputs?.staticPriceFilter?.sellAboveEnabled}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.staticPriceFilter.sellAboveEnabled' as any, !!checked)}
                          />
                          <Label htmlFor="eqMwStaticSellAboveEnabled">Only Sell Above</Label>
                        </div>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.staticPriceFilter?.sellAbove}
                          {...register('algorithm_inputs.staticPriceFilter.sellAbove' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="eqMwStaticBuyBelowEnabled"
                            defaultChecked={!!recipe?.algorithm_inputs?.staticPriceFilter?.buyBelowEnabled}
                            onCheckedChange={(checked) => setValue('algorithm_inputs.staticPriceFilter.buyBelowEnabled' as any, !!checked)}
                          />
                          <Label htmlFor="eqMwStaticBuyBelowEnabled">Only Buy Below</Label>
                        </div>
                        <Input type="number" step="0.01" defaultValue={recipe?.algorithm_inputs?.staticPriceFilter?.buyBelow}
                          {...register('algorithm_inputs.staticPriceFilter.buyBelow' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Trend Filter */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Trend Filter</h5>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="eqMwTrendBuyDown"
                          defaultChecked={!!recipe?.algorithm_inputs?.trendFilter?.buyInDownTrend}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.trendFilter.buyInDownTrend' as any, !!checked)}
                        />
                        <Label htmlFor="eqMwTrendBuyDown">Buy in Down Trend</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="eqMwTrendBuyUp"
                          defaultChecked={!!recipe?.algorithm_inputs?.trendFilter?.buyInUpTrend}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.trendFilter.buyInUpTrend' as any, !!checked)}
                        />
                        <Label htmlFor="eqMwTrendBuyUp">Buy in Up Trend</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="eqMwTrendSellDown"
                          defaultChecked={!!recipe?.algorithm_inputs?.trendFilter?.sellInDownTrend}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.trendFilter.sellInDownTrend' as any, !!checked)}
                        />
                        <Label htmlFor="eqMwTrendSellDown">Sell in Down Trend</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="eqMwTrendSellUp"
                          defaultChecked={!!recipe?.algorithm_inputs?.trendFilter?.sellInUpTrend}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.trendFilter.sellInUpTrend' as any, !!checked)}
                        />
                        <Label htmlFor="eqMwTrendSellUp">Sell in Up Trend</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="eqMwTrendBuyUpBreakout"
                          defaultChecked={!!recipe?.algorithm_inputs?.trendFilter?.buyOnUpTrend}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.trendFilter.buyOnUpTrend' as any, !!checked)}
                        />
                        <Label htmlFor="eqMwTrendBuyUpBreakout">Buy on change of trend (Up Trend breakout)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="eqMwTrendSellDownBreakout"
                          defaultChecked={!!recipe?.algorithm_inputs?.trendFilter?.sellOnDownTrend}
                          onCheckedChange={(checked) => setValue('algorithm_inputs.trendFilter.sellOnDownTrend' as any, !!checked)}
                        />
                        <Label htmlFor="eqMwTrendSellDownBreakout">Sell on change of trend (Down Trend breakout)</Label>
                      </div>
                    </div>
                  </div>

                  {/* Start Date / Time */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Start Date / Time</h5>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.year}
                          {...register('algorithm_inputs.dates.start.year' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Month</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.month}
                          {...register('algorithm_inputs.dates.start.month' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Day</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.day}
                          {...register('algorithm_inputs.dates.start.day' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Hour (24h)</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.hour}
                          {...register('algorithm_inputs.dates.start.hour' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Minute</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.start?.minute}
                          {...register('algorithm_inputs.dates.start.minute' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* End Date */}
                  <div className="space-y-3">
                    <h5 className="font-medium">End Date</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.year}
                          {...register('algorithm_inputs.dates.end.year' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Month</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.month}
                          {...register('algorithm_inputs.dates.end.month' as any, { valueAsNumber: true })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Day</Label>
                        <Input type="number" defaultValue={recipe?.algorithm_inputs?.dates?.end?.day}
                          {...register('algorithm_inputs.dates.end.day' as any, { valueAsNumber: true })} />
                      </div>
                    </div>
                  </div>

                  {/* Backtesting */}
                  <div className="space-y-3">
                    <h5 className="font-medium">Backtesting</h5>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="eqMwExitFullOnLast"
                        defaultChecked={!!recipe?.algorithm_inputs?.backtest?.exitFullOnLastBar}
                        onCheckedChange={(checked) => setValue('algorithm_inputs.backtest.exitFullOnLastBar' as any, !!checked)}
                      />
                      <Label htmlFor="eqMwExitFullOnLast">Exit Full Position on Last Historical Bar</Label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Trading Parameters section intentionally removed. These fields are now
               represented within algorithm-specific inputs. Safe defaults are
               provided in form defaults to satisfy DB constraints. */}

            {/* Results */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Results</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initial_capital">Initial Capital</Label>
                  <Input
                    id="initial_capital"
                    type="number"
                    step="0.01"
                    {...register("initial_capital", { valueAsNumber: true })}
                    placeholder="e.g., 100000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cash_profit">Cash Profit</Label>
                  <Input
                    id="cash_profit"
                    type="number"
                    step="0.01"
                    {...register("cash_profit", { valueAsNumber: true })}
                    placeholder="e.g., 2742"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="asset_accumulated">Asset Accumulated</Label>
                  <Input
                    id="asset_accumulated"
                    {...register("asset_accumulated")}
                    placeholder="e.g., $96,170 (0.92 BTC @ $104,000)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="net_profit">Net Profit</Label>
                  <Input
                    id="net_profit"
                    {...register("net_profit")}
                    placeholder="e.g., $20,455 (87% from BTC growth, 13% cash)"
                  />
                </div>
              </div>
            </div>

            {selectedAlgorithm === 'Market Wave' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Benchmark</h3>
                <div className={`grid grid-cols-1 gap-4 ${isEquitiesOrEtf ? 'md:grid-cols-2 max-w-2xl' : 'max-w-xs'}`}>
                  <div className="space-y-2">
                    <Label>Buy &amp; Hold PnL (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={recipe?.algorithm_inputs?.buyHoldPnlPercent}
                      {...register('algorithm_inputs.buyHoldPnlPercent' as any, { valueAsNumber: true })}
                      placeholder="e.g., 42.5"
                    />
                  </div>
                  {isEquitiesOrEtf && (
                    <div className="space-y-2">
                      <Label>DCA PnL (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={recipe?.algorithm_inputs?.dcaPnlPercent}
                        {...register('algorithm_inputs.dcaPnlPercent' as any, { valueAsNumber: true })}
                        placeholder="e.g., 18.2"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showBuyHoldBenchmark"
                      defaultChecked={recipe?.algorithm_inputs?.benchmark?.showBuyHold !== false}
                      onCheckedChange={(checked) => setValue('algorithm_inputs.benchmark.showBuyHold' as any, !!checked)}
                    />
                    <Label htmlFor="showBuyHoldBenchmark">Show Buy &amp; Hold Benchmark</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showDcaBenchmark"
                      defaultChecked={!!recipe?.algorithm_inputs?.benchmark?.showDca || !!recipe?.algorithm_inputs?.showDcaBenchmark}
                      onCheckedChange={(checked) => setValue('algorithm_inputs.benchmark.showDca' as any, !!checked)}
                    />
                    <Label htmlFor="showDcaBenchmark">Show DCA Benchmark</Label>
                  </div>
                </div>
              </div>
            )}

            {renderVersionSection()}

            {isEditMode && renderScreenshotsSection()}

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || parsingScreenshots}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving draft...
                  </>
                ) : (
                  'Save draft'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
