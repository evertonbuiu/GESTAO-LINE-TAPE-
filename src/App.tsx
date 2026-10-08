import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CustomAuthProvider } from "@/hooks/useCustomAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import Index from "./routes/index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import QuoteApproval from "./pages/QuoteApproval";

import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { PWAUpdateBanner } from "@/components/PWAUpdateBanner";
import { Loader2 } from "lucide-react";
import { RealtimeQuerySync } from "@/components/RealtimeQuerySync";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
      retry: 2,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useCustomAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/install" element={<Install />} />
        <Route path="/orcamento/:token" element={<QuoteApproval />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CustomAuthProvider>
          <RealtimeQuerySync />
          <ThemeProvider>
            <Toaster />
            <Sonner />
            <PWAUpdateBanner />
            <AppRoutes />
          </ThemeProvider>
        </CustomAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;

