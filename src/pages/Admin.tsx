import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Plus, Search, Eye } from "lucide-react";
import { AdminRecipeCard } from "@/components/AdminRecipeCard";
import { RecipeForm } from "@/components/RecipeForm";
import { RecipeDetailModal } from "@/components/RecipeDetailModal";

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
  exit_to_entry_proportion: number;
  time_frame: string;
  cagr: number | null;
  annualized_return: number | null;
  net_profit: string | null;
  cash_profit: number | null;
  created_at: string;
  updated_at: string;
}

export default function Admin() {
  const [user, setUser] = useState<any>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
        fetchRecipes();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUser(session.user);
        fetchRecipes();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipes(data || []);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out successfully" });
    navigate('/auth');
  };

  const handleCreateRecipe = () => {
    setEditingRecipe(null);
    setShowForm(true);
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setShowForm(true);
  };

  const handleViewRecipe = (recipe: Recipe) => {
    setViewingRecipe(recipe);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingRecipe(null);
    fetchRecipes();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingRecipe(null);
  };

  const handleDeleteRecipe = () => {
    fetchRecipes();
  };

  // Filter recipes based on search query
  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.strategy_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    recipe.goal.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-hero border-b border-primary/20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/')} variant="secondary" className="gap-2">
              <Eye className="h-4 w-4" />
              View Public Site
            </Button>
            <Button variant="secondary" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handleCreateRecipe} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Recipe
          </Button>
        </div>

        {/* Recipe Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-80 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? 'No recipes found matching your search.' : 'No recipes found. Create your first recipe!'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Showing {filteredRecipes.length} of {recipes.length} recipes
            </p>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredRecipes.map(recipe => (
                <AdminRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onEdit={handleEditRecipe}
                  onDelete={handleDeleteRecipe}
                  onView={handleViewRecipe}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Recipe Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecipe ? 'Edit Recipe' : 'Create New Recipe'}
            </DialogTitle>
          </DialogHeader>
          <RecipeForm
            recipe={editingRecipe}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={viewingRecipe}
        open={!!viewingRecipe}
        onOpenChange={(open) => !open && setViewingRecipe(null)}
      />
    </div>
  );
}