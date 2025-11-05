import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RecipeCard } from "@/components/RecipeCard";
import { FilterSidebar, Filters } from "@/components/FilterSidebar";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, LogIn } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { usePortfolio } from "@/hooks/usePortfolio";
import { parseCurrencyFromString, parseAssetQuantityFromText } from "@/lib/portfolio";

interface Recipe {
  id: string;
  name: string;
  asset: string;
  time_horizon: string;
  strategy_type: string;
  algorithm?: string;
  algorithm_inputs?: any;
  focus: string;
  goal: string;
  entry_trade: string;
  exit_trade: string;
  sell_above_cost_basis: boolean | null;
  exit_to_entry_proportion: number;
  time_frame: string;
  backtesting_period: string;
  initial_capital: number | null;
  cash_profit: number | null;
  asset_accumulated: string | null;
  net_profit: string | null;
  cagr: number | null;
  annualized_return: number | null;
  best_for: string | null;
  display_number?: number | null;
  screenshots?: Array<{
    id: string;
    image_url: string;
    display_order: number;
  }>;
}

type SortOption = 'cagr-desc' | 'cagr-asc' | 'cash-profit-desc' | 'cash-profit-asc' | 'asset-accumulated-desc' | 'asset-accumulated-asc' | 'net-profit-desc' | 'net-profit-asc' | 'pnl-desc' | 'pnl-asc';

export default function RecipeBrowser() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('cagr-desc');
  const { initialCapital, setInitialCapital } = usePortfolio();
  // Keep the raw input as a string so empty state doesn't coerce to 0
  const [initialCapitalInput, setInitialCapitalInput] = useState<string>(initialCapital.toString());
  const [filters, setFilters] = useState<Filters>({
    assets: [],
    focuses: [],
    timeHorizons: [],
    algorithms: [],
    minCAGR: 0,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const formatCurrency = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '';
    return Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const parseCurrency = (value: string): number => {
    const cleaned = value.replace(/[^0-9]/g, '');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  };

  const handleInitialCapitalChange = (value: string) => {
    setInitialCapitalInput(value);
    const parsed = parseCurrency(value);
    if (parsed > 0) {
      setInitialCapital(parsed);
    }
  };

  // Sync portfolio initialCapital to RecipeBrowser input
  useEffect(() => {
    setInitialCapitalInput(formatCurrency(initialCapital));
  }, [initialCapital]);

  const initialCapitalNumber = useMemo(() => {
    return initialCapital;
  }, [initialCapital]);

  const scale = useMemo(() => {
    const base = 100000;
    if (!initialCapitalNumber || initialCapitalNumber <= 0) return 0;
    return initialCapitalNumber / base;
  }, [initialCapitalNumber]);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_screenshots(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to include screenshots in the expected format
      const transformedData = (data || []).map(recipe => ({
        ...recipe,
        screenshots: recipe.recipe_screenshots?.sort((a: any, b: any) => a.display_order - b.display_order) || []
      }));
      
      setRecipes(transformedData);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load recipes",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filters
  const availableAssets = useMemo(() => 
    [...new Set(recipes.map(r => r.asset))].sort(),
    [recipes]
  );
  
  const availableFocuses = useMemo(() => 
    [...new Set(recipes.map(r => r.focus))].sort(),
    [recipes]
  );
  
  const availableAlgorithms = useMemo(() => {
    // Known algorithm values from the schema in preferred order
    const knownAlgorithms = ['Intelligence Algorithm', 'Arbitrage Algorithm', 'Oracle Protocol'];
    
    // Get algorithms from recipes that exist
    const recipeAlgorithms = recipes
      .map(r => r.algorithm)
      .filter((a): a is string => !!a && typeof a === 'string');
    
    // Combine known algorithms with recipe algorithms, remove duplicates
    // Preserve order: start with known algorithms, then add any additional ones from recipes
    const allAlgorithms = [...new Set([...knownAlgorithms, ...recipeAlgorithms])];
    
    // Sort alphabetically for consistency
    return allAlgorithms.sort();
  }, [recipes]);
  
  // Removed time frame and strategy type filters from UI

  // Filter and sort recipes
  const filteredAndSortedRecipes = useMemo(() => {
    let filtered = recipes.filter(recipe => {
      // Text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !recipe.name.toLowerCase().includes(query) &&
          !recipe.goal.toLowerCase().includes(query) &&
          !recipe.asset.toLowerCase().includes(query) &&
          !recipe.strategy_type.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Asset filter
      if (filters.assets.length > 0 && !filters.assets.includes(recipe.asset)) {
        return false;
      }

      // Focus filter
      if (filters.focuses.length > 0 && !filters.focuses.includes(recipe.focus)) {
        return false;
      }

      // Time Horizon filter
      if (filters.timeHorizons.length > 0 && !filters.timeHorizons.includes(recipe.time_horizon)) {
        return false;
      }

      // Algorithm filter
      if (filters.algorithms.length > 0 && (!recipe.algorithm || !filters.algorithms.includes(recipe.algorithm))) {
        return false;
      }

      // Removed time frame and strategy type filters

      // CAGR filter
      const returnValue = recipe.cagr || recipe.annualized_return || 0;
      if (returnValue < filters.minCAGR) {
        return false;
      }

      return true;
    });

    // Helper function to get sortable values for a recipe
    const getSortValue = (recipe: Recipe, field: string): number => {
      const scaleFactor = scale;
      
      switch (field) {
        case 'cagr':
          return recipe.cagr || recipe.annualized_return || 0;
        case 'cash-profit':
          if (recipe.cash_profit === null || recipe.cash_profit === undefined) return 0;
          return Math.round(recipe.cash_profit * scaleFactor);
        case 'asset-accumulated':
          const assetQty = parseAssetQuantityFromText(recipe.asset_accumulated, recipe.asset);
          if (assetQty === null) return 0;
          return assetQty * scaleFactor;
        case 'net-profit':
          const netProfit = parseCurrencyFromString(recipe.net_profit);
          if (netProfit === null) return 0;
          return Math.round(netProfit * scaleFactor);
        case 'pnl':
          const initialCap = recipe.initial_capital ?? null;
          const netProfitForPnl = parseCurrencyFromString(recipe.net_profit);
          if (initialCap === null || initialCap <= 0 || netProfitForPnl === null) return 0;
          return (netProfitForPnl / initialCap) * 100;
        default:
          return 0;
      }
    };

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'cagr-desc': {
          const aVal = getSortValue(a, 'cagr');
          const bVal = getSortValue(b, 'cagr');
          return bVal - aVal;
        }
        case 'cagr-asc': {
          const aVal = getSortValue(a, 'cagr');
          const bVal = getSortValue(b, 'cagr');
          return aVal - bVal;
        }
        case 'cash-profit-desc': {
          const aVal = getSortValue(a, 'cash-profit');
          const bVal = getSortValue(b, 'cash-profit');
          return bVal - aVal;
        }
        case 'cash-profit-asc': {
          const aVal = getSortValue(a, 'cash-profit');
          const bVal = getSortValue(b, 'cash-profit');
          return aVal - bVal;
        }
        case 'asset-accumulated-desc': {
          const aVal = getSortValue(a, 'asset-accumulated');
          const bVal = getSortValue(b, 'asset-accumulated');
          return bVal - aVal;
        }
        case 'asset-accumulated-asc': {
          const aVal = getSortValue(a, 'asset-accumulated');
          const bVal = getSortValue(b, 'asset-accumulated');
          return aVal - bVal;
        }
        case 'net-profit-desc': {
          const aVal = getSortValue(a, 'net-profit');
          const bVal = getSortValue(b, 'net-profit');
          return bVal - aVal;
        }
        case 'net-profit-asc': {
          const aVal = getSortValue(a, 'net-profit');
          const bVal = getSortValue(b, 'net-profit');
          return aVal - bVal;
        }
        case 'pnl-desc': {
          const aVal = getSortValue(a, 'pnl');
          const bVal = getSortValue(b, 'pnl');
          return bVal - aVal;
        }
        case 'pnl-asc': {
          const aVal = getSortValue(a, 'pnl');
          const bVal = getSortValue(b, 'pnl');
          return aVal - bVal;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [recipes, searchQuery, filters, sortBy, scale]);


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10" style={{ backgroundColor: '#244bd8' }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">Recipe Lab</h1>
              <p className="text-sm text-white/90 mt-1">Arch Public Crypto Algorithm Recipe Browser</p>
            </div>
            <img src="/APLogo.png" alt="Arch Public" className="h-8 w-auto" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Get started */}
        <div className="mb-6 p-4 rounded-lg border border-border bg-white texture-overlay">
          <h2 className="text-base font-semibold mb-2">Get started</h2>
          <p className="text-sm text-muted-foreground">
            Search and filter recipes by asset, focus, or time horizon. Set your Initial
            Capital to instantly scale every dollar amount from the $100,000 baseline.
            Click a card to review parameters and results, then add it to your
            portfolio to allocate capital and copy values to TradingView.
          </p>
        </div>

        {/* Search and Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes by name, goal, asset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cagr-desc">CAGR (High to Low)</SelectItem>
                <SelectItem value="cagr-asc">CAGR (Low to High)</SelectItem>
                <SelectItem value="cash-profit-desc">Cash Profit (High to Low)</SelectItem>
                <SelectItem value="cash-profit-asc">Cash Profit (Low to High)</SelectItem>
                <SelectItem value="asset-accumulated-desc">Asset Accumulated (High to Low)</SelectItem>
                <SelectItem value="asset-accumulated-asc">Asset Accumulated (Low to High)</SelectItem>
                <SelectItem value="net-profit-desc">Net Profit (High to Low)</SelectItem>
                <SelectItem value="net-profit-asc">Net Profit (Low to High)</SelectItem>
                <SelectItem value="pnl-desc">PnL (High to Low)</SelectItem>
                <SelectItem value="pnl-asc">PnL (Low to High)</SelectItem>
              </SelectContent>
            </Select>

            {/* Mobile Filter Toggle */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] overflow-y-auto">
                {/* Capital Controls (Mobile within Filters) */}
                <div className="mt-2 mb-4 p-4 rounded-lg border border-border bg-white texture-overlay">
                  <p className="text-sm font-semibold mb-2">Initial Capital</p>
                  <Input
                    type="text"
                    value={initialCapitalInput}
                    onChange={(e) => handleInitialCapitalChange(e.target.value)}
                    onBlur={(e) => {
                      const parsed = parseCurrency(e.target.value);
                      if (parsed > 0) {
                        setInitialCapitalInput(formatCurrency(parsed));
                      }
                    }}
                    placeholder="$100,000"
                    min={0}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Recipes are authored at $100,000. Displayed values are scaled.
                  </p>
                </div>
                <FilterSidebar
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableAssets={availableAssets}
                  availableFocuses={availableFocuses}
                  availableTimeFrames={[]}
                  availableAlgorithms={availableAlgorithms}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              {/* Capital Controls (Desktop above Filters) */}
              <div className="mb-4 p-4 rounded-lg border border-border bg-white texture-overlay">
                <p className="text-sm font-semibold mb-2">Initial Capital</p>
                <Input
                  type="text"
                  value={initialCapitalInput}
                  onChange={(e) => handleInitialCapitalChange(e.target.value)}
                  onBlur={(e) => {
                    const parsed = parseCurrency(e.target.value);
                    if (parsed > 0) {
                      setInitialCapitalInput(formatCurrency(parsed));
                    }
                  }}
                  placeholder="$100,000"
                  min={0}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Recipes are authored at $100,000. Displayed values are scaled.
                </p>
              </div>
              <FilterSidebar
                filters={filters}
                onFiltersChange={setFilters}
                availableAssets={availableAssets}
                availableFocuses={availableFocuses}
                availableTimeFrames={[]}
                availableAlgorithms={availableAlgorithms}
              />
            </div>
          </aside>

          {/* Recipe Grid */}
          <main className="flex-1">
            {loading ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-80 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredAndSortedRecipes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No recipes found matching your criteria.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Showing {filteredAndSortedRecipes.length} of {recipes.length} recipes
                </p>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredAndSortedRecipes.map(recipe => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      scale={scale}
                      onClick={() => setSelectedRecipe(recipe)}
                    />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Footer with Admin button */}
      <footer className="border-t border-border/50 mt-8 py-4">
        <div className="container mx-auto px-4 flex justify-end">
          <Button 
            variant="secondary" 
            onClick={() => navigate('/admin')}
            className="gap-2"
          >
            <LogIn className="h-4 w-4" />
            Admin
          </Button>
        </div>
      </footer>

      {/* Detail Modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        open={!!selectedRecipe}
        onOpenChange={(open) => !open && setSelectedRecipe(null)}
        scale={scale}
        initialCapital={initialCapitalNumber}
      />
    </div>
  );
}