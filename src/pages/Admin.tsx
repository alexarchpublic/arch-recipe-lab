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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Session, User } from "@supabase/supabase-js";
import { ADMIN_DENIED_MESSAGE, decideAdminAccess } from "../../lib/adminAccess";
import { VersionReview } from "@/components/admin/VersionReview";
import {
  type AdminRole,
  type ParityRun,
  type StrategyGroup,
  fetchAdminRole,
  fetchLatestParity,
  fetchStrategyGroups,
  versionToFormRecipe,
  versionToProStrategy,
} from "@/data/adminVersions";

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<StrategyGroup[]>([]);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [parity, setParity] = useState<ParityRun | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StrategyGroup | null>(null);
  const [viewingGroup, setViewingGroup] = useState<StrategyGroup | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const admit = async (session: Session | null) => {
      if (!session) {
        navigate('/auth');
        return;
      }
      const rpc = await supabase.rpc('is_admin');
      if (cancelled) return;
      const decision = decideAdminAccess(rpc, session.user.email);
      if (!decision.allowed) {
        await supabase.auth.signOut();
        toast({
          variant: "destructive",
          title: "Access Restricted",
          description: ADMIN_DENIED_MESSAGE,
        });
        navigate('/auth');
        return;
      }
      setUser(session.user);
      fetchRecipes();
    };

    supabase.auth.getSession().then(({ data: { session } }) => admit(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      // Defer: awaiting Supabase calls inside this callback can deadlock the auth client.
      setTimeout(() => void admit(session), 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const fetchRecipes = async (): Promise<StrategyGroup[] | null> => {
    try {
      setLoading(true);
      const [nextGroups, nextRole, nextParity] = await Promise.all([
        fetchStrategyGroups(),
        fetchAdminRole(),
        fetchLatestParity(),
      ]);
      setGroups(nextGroups);
      setRole(nextRole);
      setParity(nextParity);
      return nextGroups;
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load strategies",
      });
      return null;
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
    setEditingGroup(null);
    setShowForm(true);
  };

  const handleEditRecipe = (group: StrategyGroup) => {
    setReviewingId(null);
    setEditingGroup(group);
    setShowForm(true);
  };

  const handleFormSuccess = async (versionId?: string) => {
    setShowForm(false);
    setEditingGroup(null);
    const all = await fetchRecipes();
    // After a save, go straight to the draft's review (A6).
    const owner = versionId ? all?.find((g) => g.history.some((v) => v.id === versionId)) : null;
    if (owner) setReviewingId(owner.strategyId);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingGroup(null);
  };

  const editingVersion = editingGroup ? editingGroup.draft ?? editingGroup.published ?? editingGroup.history[0] : null;
  const reviewingGroup = groups.find((g) => g.strategyId === reviewingId) ?? null;
  const viewingVersion = viewingGroup ? viewingGroup.draft ?? viewingGroup.published ?? viewingGroup.history[0] : null;

  // Filter strategies based on search query
  const q = searchQuery.toLowerCase();
  const filteredGroups = groups
    .filter((g) => (showArchived ? true : !g.archivedAt))
    .filter((g) => {
      const v = g.draft ?? g.published ?? g.history[0];
      return [v.name, v.short_name, v.title, v.asset, v.strategy_type, v.goal, String(g.displayNumber ?? "")]
        .some((t) => (t ?? "").toLowerCase().includes(q));
    });
  const archivedCount = groups.filter((g) => !!g.archivedAt).length;
  const openDrafts = groups.filter((g) => g.draft).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/[0.08] bg-navy">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-white">Admin</h1>
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate('/')} variant="secondary" className="gap-2">
              <Eye className="h-4 w-4" />
              View public site
            </Button>
            <Button variant="secondary" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        {/* Parity check (R5, D8): the views against the store, after every publish and daily */}
        {parity && (
          <div
            className={`mb-6 rounded-lg border p-3 text-sm ${
              parity.ok ? "border-gain/40 bg-gain/5" : "border-destructive/50 bg-destructive/5"
            }`}
          >
            <span className="font-semibold">
              {parity.ok ? "Parity check clean" : `Parity check found ${parity.problems.length} problem(s)`}
            </span>
            <span className="text-muted-foreground">
              {" "}· {new Date(parity.ran_at).toLocaleString()} ({parity.trigger})
              {" "}· {String((parity.counts as Record<string, unknown>).pro_rows ?? "?")} client rows,{" "}
              {String((parity.counts as Record<string, unknown>).public_rows ?? "?")} public rows
              {openDrafts > 0 && ` · ${openDrafts} open draft${openDrafts === 1 ? "" : "s"}`}
            </span>
            {!parity.ok && (
              <pre className="mt-2 max-h-32 overflow-auto text-xs">{JSON.stringify(parity.problems.slice(0, 20), null, 1)}</pre>
            )}
          </div>
        )}

        {/* Header Actions */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search strategies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived" className="text-sm">
                Show archived
              </Label>
            </div>
            {archivedCount > 0 && (
              <Badge variant="secondary" className="whitespace-nowrap">
                {archivedCount} archived
              </Badge>
            )}
          </div>
          <Button onClick={handleCreateRecipe} className="gap-2">
            <Plus className="h-4 w-4" />
            Create recipe
          </Button>
        </div>

        {/* Recipe Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-80 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? 'No recipes found matching your search.' : 'No recipes found. Create your first recipe!'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Showing {filteredGroups.length} of {groups.length} strategies
            </p>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredGroups.map(group => (
                <AdminRecipeCard
                  key={group.strategyId}
                  group={group}
                  onEdit={handleEditRecipe}
                  onReview={(g) => setReviewingId(g.strategyId)}
                  onView={setViewingGroup}
                  onChanged={() => void fetchRecipes()}
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
              {editingGroup ? 'Edit strategy (saves a draft)' : 'Create New Recipe'}
            </DialogTitle>
          </DialogHeader>
          <RecipeForm
            recipe={editingVersion ? versionToFormRecipe(editingVersion) : null}
            role={role}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        </DialogContent>
      </Dialog>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={viewingVersion ? versionToProStrategy(viewingVersion) : null}
        open={!!viewingVersion}
        onOpenChange={(open) => !open && setViewingGroup(null)}
        initialCapital={viewingVersion?.starting_capital}
      />

      {/* Review, publish and history (A2, A3, A6, A7, D9) */}
      <VersionReview
        key={reviewingId ?? "none"}
        group={reviewingGroup}
        role={role}
        open={!!reviewingGroup}
        onOpenChange={(open) => !open && setReviewingId(null)}
        onChanged={() => void fetchRecipes()}
        onEdit={handleEditRecipe}
      />
    </div>
  );
}