import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import Browse from "./pages/pro/Browse";
import StrategyPage from "./pages/pro/StrategyPage";
import Portfolios from "./pages/pro/Portfolios";
import Apply from "./pages/pro/Apply";
import WhatsNew from "./pages/pro/WhatsNew";
import Help from "./pages/pro/Help";
import Compare from "./pages/pro/Compare";
import NotFound from "./pages/NotFound";
import { PortfolioProvider } from "@/hooks/usePortfolio";
import { PreferencesProvider } from "@/hooks/usePreferences";

// The admin console loads only for admins, so clients do not download it.
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient();

/** Recipe Lab's /recipe/N links open the same strategy (PRD 5). vercel.json redirects them too. */
function LegacyRecipeLink() {
  const { displayNumber } = useParams();
  return <Navigate to={`/strategy/${displayNumber ?? ""}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PreferencesProvider>
        <PortfolioProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Browse />} />
              <Route path="/strategy/:displayNumber" element={<StrategyPage />} />
              <Route path="/recipe/:displayNumber" element={<LegacyRecipeLink />} />
              <Route path="/portfolios" element={<Portfolios />} />
              <Route path="/portfolios/:portfolioId/apply" element={<Apply />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/whats-new" element={<WhatsNew />} />
              <Route path="/help" element={<Help />} />
              <Route path="/auth" element={<Suspense fallback={null}><Auth /></Suspense>} />
              <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </PortfolioProvider>
      </PreferencesProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
