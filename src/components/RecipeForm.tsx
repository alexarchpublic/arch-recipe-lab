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
      ...recipe
    }
  });

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

            {/* Trading Parameters */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Trading Parameters</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entry_trade">Entry Trade *</Label>
                  <Textarea
                    id="entry_trade"
                    {...register("entry_trade")}
                    placeholder="e.g., Purchase $8,000 when price drops 3%"
                    rows={2}
                  />
                  {errors.entry_trade && (
                    <p className="text-sm text-destructive">{errors.entry_trade.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exit_trade">Exit Trade *</Label>
                  <Textarea
                    id="exit_trade"
                    {...register("exit_trade")}
                    placeholder="e.g., Sell $6,500 when price rises 3.5%"
                    rows={2}
                  />
                  {errors.exit_trade && (
                    <p className="text-sm text-destructive">{errors.exit_trade.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exit_to_entry_proportion">Exit to Entry Proportion (%) *</Label>
                  <Input
                    id="exit_to_entry_proportion"
                    type="number"
                    step="0.01"
                    {...register("exit_to_entry_proportion", { valueAsNumber: true })}
                    placeholder="e.g., 81.25"
                  />
                  {errors.exit_to_entry_proportion && (
                    <p className="text-sm text-destructive">{errors.exit_to_entry_proportion.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_frame">Time Frame *</Label>
                  <Input
                    id="time_frame"
                    {...register("time_frame")}
                    placeholder="e.g., Daily, 6 Hour, 1 Week"
                  />
                  {errors.time_frame && (
                    <p className="text-sm text-destructive">{errors.time_frame.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backtesting_period">Backtesting Period *</Label>
                  <Input
                    id="backtesting_period"
                    {...register("backtesting_period")}
                    placeholder="e.g., January 2025–June 2025"
                  />
                  {errors.backtesting_period && (
                    <p className="text-sm text-destructive">{errors.backtesting_period.message}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sell_above_cost_basis"
                    checked={watch("sell_above_cost_basis")}
                    onCheckedChange={(checked) => setValue("sell_above_cost_basis", !!checked)}
                  />
                  <Label htmlFor="sell_above_cost_basis">Sell Above Cost Basis</Label>
                </div>
              </div>
            </div>

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
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                    <div className="mt-4">
                      <Label htmlFor="image-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-muted-foreground">
                          Upload screenshots
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          PNG, JPG, WEBP up to 5MB each (max {MAX_IMAGES_PER_RECIPE} images)
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
