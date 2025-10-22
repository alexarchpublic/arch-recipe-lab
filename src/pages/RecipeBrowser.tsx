import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RecipeCard } from "@/components/RecipeCard";
import { FilterSidebar, Filters } from "@/components/FilterSidebar";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, Download, LogIn } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Recipe {
  id: string;
  name: string;
  asset: string;
  time_horizon: string;
  strategy_type: string;
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
  screenshots?: Array<{
    id: string;
    image_url: string;
    display_order: number;
  }>;
}

type SortOption = 'cagr-desc' | 'cagr-asc' | 'profit-desc' | 'profit-asc' | 'asset' | 'name';

export default function RecipeBrowser() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('cagr-desc');
  const [filters, setFilters] = useState<Filters>({
    assets: [],
    focuses: [],
    timeHorizons: [],
    timeFrames: [],
    strategyTypes: [],
    minCAGR: 0,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

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
  
  const availableTimeFrames = useMemo(() => 
    [...new Set(recipes.map(r => r.time_frame))].sort(),
    [recipes]
  );
  
  const availableStrategyTypes = useMemo(() => 
    [...new Set(recipes.map(r => r.strategy_type))].sort(),
    [recipes]
  );

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

      // Time Frame filter
      if (filters.timeFrames.length > 0 && !filters.timeFrames.includes(recipe.time_frame)) {
        return false;
      }

      // Strategy Type filter
      if (filters.strategyTypes.length > 0 && !filters.strategyTypes.includes(recipe.strategy_type)) {
        return false;
      }

      // CAGR filter
      const returnValue = recipe.cagr || recipe.annualized_return || 0;
      if (returnValue < filters.minCAGR) {
        return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'cagr-desc':
          return (b.cagr || b.annualized_return || 0) - (a.cagr || a.annualized_return || 0);
        case 'cagr-asc':
          return (a.cagr || a.annualized_return || 0) - (b.cagr || b.annualized_return || 0);
        case 'profit-desc':
          return (b.cash_profit || 0) - (a.cash_profit || 0);
        case 'profit-asc':
          return (a.cash_profit || 0) - (b.cash_profit || 0);
        case 'asset':
          return a.asset.localeCompare(b.asset);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [recipes, searchQuery, filters, sortBy]);

  const exportToCSV = () => {
    const headers = [
      'Name', 'Asset', 'Time Horizon', 'Strategy Type', 'Focus', 'CAGR/Return', 
      'Cash Profit', 'Net Profit', 'Time Frame'
    ];
    
    const rows = filteredAndSortedRecipes.map(recipe => [
      recipe.name,
      recipe.asset,
      recipe.time_horizon,
      recipe.strategy_type,
      recipe.focus,
      recipe.cagr || recipe.annualized_return || '',
      recipe.cash_profit || '',
      recipe.net_profit || '',
      recipe.time_frame,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arch-public-recipes.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${filteredAndSortedRecipes.length} recipes to CSV`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-hero border-b border-primary/20 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Arch Public Recipes</h1>
              <p className="text-sm text-white/80 mt-1">Crypto Algorithm Recipe Browser</p>
            </div>
            <Button 
              variant="secondary" 
              onClick={() => navigate('/admin')}
              className="gap-2"
            >
              <LogIn className="h-4 w-4" />
              Admin
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
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
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cagr-desc">CAGR (High to Low)</SelectItem>
                <SelectItem value="cagr-asc">CAGR (Low to High)</SelectItem>
                <SelectItem value="profit-desc">Profit (High to Low)</SelectItem>
                <SelectItem value="profit-asc">Profit (Low to High)</SelectItem>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={exportToCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>

            {/* Mobile Filter Toggle */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] overflow-y-auto">
                <FilterSidebar
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableAssets={availableAssets}
                  availableFocuses={availableFocuses}
                  availableTimeFrames={availableTimeFrames}
                  availableStrategyTypes={availableStrategyTypes}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-24">
              <FilterSidebar
                filters={filters}
                onFiltersChange={setFilters}
                availableAssets={availableAssets}
                availableFocuses={availableFocuses}
                availableTimeFrames={availableTimeFrames}
                availableStrategyTypes={availableStrategyTypes}
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
                      onClick={() => setSelectedRecipe(recipe)}
                    />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* Detail Modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        open={!!selectedRecipe}
        onOpenChange={(open) => !open && setSelectedRecipe(null)}
      />
    </div>
  );
}