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
  deleteRecipeImage, 
  getRecipeScreenshots,
  validateImage,
  MAX_IMAGES_PER_RECIPE 
} from "@/lib/imageUpload";
import { 
  Upload, 
  X, 
  GripVertical, 
  AlertCircle,
  Loader2,
  Image as ImageIcon
} from "lucide-react";

// Form validation schema
const recipeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  asset: z.string().min(1, "Asset is required"),
  time_horizon: z.enum(["STH", "LTH"]),
  strategy_type: z.string().min(1, "Strategy type is required"),
  focus: z.enum(["Cash Yielding", "Balanced", "Accumulation"]),
  goal: z.string().min(1, "Goal is required"),
  entry_trade: z.string().min(1, "Entry trade is required"),
  exit_trade: z.string().min(1, "Exit trade is required"),
  sell_above_cost_basis: z.boolean(),
  exit_to_entry_proportion: z.number().min(0, "Must be positive"),
  time_frame: z.string().min(1, "Time frame is required"),
  backtesting_period: z.string().min(1, "Backtesting period is required"),
  initial_capital: z.number().optional(),
  cash_profit: z.number().optional(),
  asset_accumulated: z.string().optional(),
  net_profit: z.string().optional(),
  cagr: z.number().optional(),
  best_for: z.string().optional(),
  // New algorithm fields
  algorithm: z.enum(["Intelligence Algorithm","Arbitrage Algorithm","Oracle Protocol"]).default("Oracle Protocol"),
  algorithm_inputs: z.any().optional(),
});

type RecipeFormData = z.infer<typeof recipeSchema>;

interface RecipeScreenshot {
  id: string;
  image_url: string;
  display_order: number;
  file?: File;
}

interface RecipeFormProps {
  recipe?: any; // Existing recipe for edit mode
  onSuccess: () => void;
  onCancel: () => void;
}

export function RecipeForm({ recipe, onSuccess, onCancel }: RecipeFormProps) {
  const [loading, setLoading] = useState(false);
  const [screenshots, setScreenshots] = useState<RecipeScreenshot[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!recipe;

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
      time_frame: recipe?.time_frame || 'N/A',
      backtesting_period: recipe?.backtesting_period || 'N/A',
      algorithm: recipe?.algorithm || "Oracle Protocol",
      algorithm_inputs: recipe?.algorithm_inputs || {},
      ...recipe
    }
  });
  const selectedAlgorithm = watch("algorithm");


  // Load existing screenshots for edit mode
  useEffect(() => {
    if (isEditMode && recipe?.id) {
      loadExistingScreenshots(recipe.id);
    }
  }, [isEditMode, recipe?.id]);

  const loadExistingScreenshots = async (recipeId: string) => {
    try {
      const existingScreenshots = await getRecipeScreenshots(recipeId);
      setScreenshots(existingScreenshots);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleImageUpload = async (files: FileList) => {
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
    
    // Revoke object URL if it's a temporary file
    if (screenshot.id.startsWith('temp_')) {
      URL.revokeObjectURL(screenshot.image_url);
    }
    
    setScreenshots(prev => prev.filter((_, i) => i !== index));
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
      let recipeId: string;

      if (isEditMode) {
        // Update existing recipe
        const { data: updatedRecipe, error } = await supabase
          .from('recipes')
          .update(data)
          .eq('id', recipe.id)
          .select('id')
          .single();

        if (error) throw error;
        recipeId = updatedRecipe.id;
      } else {
        // Create new recipe
        const { data: newRecipe, error } = await supabase
          .from('recipes')
          .insert(data)
          .select('id')
          .single();

        if (error) throw error;
        recipeId = newRecipe.id;
      }

      // Upload new images
      const newImageFiles = screenshots.filter(s => s.file);
      for (let i = 0; i < newImageFiles.length; i++) {
        const screenshot = newImageFiles[i];
        if (screenshot.file) {
          await uploadRecipeImage(screenshot.file, recipeId, screenshot.display_order);
        }
      }

      toast({
        title: "Success",
        description: `Recipe ${isEditMode ? 'updated' : 'created'} successfully`,
      });

      onSuccess();
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEditMode ? 'Edit Recipe' : 'Create New Recipe'}</CardTitle>
          <CardDescription>
            {isEditMode 
              ? 'Update the recipe details and screenshots' 
              : 'Fill in the recipe details and upload screenshots'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                  <Label htmlFor="asset">Asset *</Label>
                  <Select onValueChange={(value) => setValue("asset", value)} defaultValue={recipe?.asset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BTC">BTC</SelectItem>
                      <SelectItem value="ETH">ETH</SelectItem>
                      <SelectItem value="SOL">SOL</SelectItem>
                      <SelectItem value="XRP">XRP</SelectItem>
                      <SelectItem value="SUI">SUI</SelectItem>
                    </SelectContent>
                  </Select>
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
                <Label htmlFor="strategy_type">Strategy Type *</Label>
                <Input
                  id="strategy_type"
                  {...register("strategy_type")}
                  placeholder="e.g., Daily Arbitrage, 6 hour Arbitrage"
                />
                {errors.strategy_type && (
                  <p className="text-sm text-destructive">{errors.strategy_type.message}</p>
                )}
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
            </div>

            {/* Algorithm */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Algorithm</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="algorithm">Algorithm *</Label>
                  <Select
                    onValueChange={(value) => setValue("algorithm", value as any)}
                    defaultValue={recipe?.algorithm || "Oracle Protocol"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select algorithm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Intelligence Algorithm">Intelligence Algorithm</SelectItem>
                      <SelectItem value="Arbitrage Algorithm">Arbitrage Algorithm</SelectItem>
                      <SelectItem value="Oracle Protocol">Oracle Protocol</SelectItem>
                    </SelectContent>
                  </Select>
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

                <div className="space-y-2">
                  <Label htmlFor="cagr">CAGR (%)</Label>
                  <Input
                    id="cagr"
                    type="number"
                    step="0.01"
                    {...register("cagr", { valueAsNumber: true })}
                    placeholder="e.g., 45.29"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="best_for">Best For</Label>
                <Textarea
                  id="best_for"
                  {...register("best_for")}
                  placeholder="Describe who this recipe is best suited for..."
                  rows={2}
                />
              </div>
            </div>

            {/* Screenshots */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Screenshots</h3>
              
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                    isDragOver 
                      ? 'border-primary bg-primary/5' 
                      : 'border-muted-foreground/25'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="text-center">
                    <ImageIcon className={`mx-auto h-12 w-12 transition-colors ${
                      isDragOver ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                    <div className="mt-4">
                      <Label htmlFor="image-upload" className="cursor-pointer">
                        <span className={`mt-2 block text-sm font-medium transition-colors ${
                          isDragOver ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {isDragOver ? 'Drop images here' : 'Upload screenshots'}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          PNG, JPG, WEBP up to 5MB each (max {MAX_IMAGES_PER_RECIPE} images)
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Or drag and drop images here
                        </span>
                      </Label>
                      <Input
                        id="image-upload"
                        type="file"
                        multiple
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                        className="hidden"
                        disabled={uploadingImages}
                      />
                    </div>
                  </div>
                </div>

                {screenshots.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Uploaded Screenshots ({screenshots.length}/{MAX_IMAGES_PER_RECIPE})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {screenshots.map((screenshot, index) => (
                        <div key={screenshot.id} className="relative group">
                          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                            <img
                              src={screenshot.image_url}
                              alt={`Screenshot ${index + 1}`}
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
                              {index + 1}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {uploadingImages && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">Uploading images...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isEditMode ? 'Update Recipe' : 'Create Recipe'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
