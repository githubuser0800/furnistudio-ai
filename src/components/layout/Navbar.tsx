import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, LayoutDashboard, ChevronDown, Layers, Zap, BarChart3, CreditCard } from "lucide-react";
import CreditTopUpModal from "@/components/dashboard/CreditTopUpModal";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch credits
  useEffect(() => {
    if (!user) { setCredits(null); return; }
    const fetchCredits = async () => {
      const { data } = await supabase.from("profiles").select("credits_remaining").eq("id", user.id).single();
      if (data) setCredits(data.credits_remaining);
    };
    fetchCredits();
    // Refresh credits on focus
    const handleFocus = () => fetchCredits();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">FS</span>
            </div>
            <span className="text-xl font-bold text-foreground">FurniStudio</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {user ? (
              <div className="flex items-center gap-1">
                <Button
                  variant={isActive("/dashboard") ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
                <Button
                  variant={isActive("/dashboard/library") ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => navigate("/dashboard/library")}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  Library
                </Button>

                {/* Clickable credits badge */}
                <button
                  onClick={() => setTopUpOpen(true)}
                  className="ml-2 flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {credits !== null ? credits : "–"}
                </button>

                {/* User menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="ml-1">
                      {user.email?.split("@")[0]}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                      <Settings className="mr-2 h-4 w-4" /> Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/dashboard/usage")}>
                      <BarChart3 className="mr-2 h-4 w-4" /> Usage
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/dashboard/settings?tab=billing")}>
                      <CreditCard className="mr-2 h-4 w-4" /> Billing
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  Pricing
                </Link>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate("/signup")}>
                  Start Free
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Top-up modal triggered from credits badge */}
      <CreditTopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        creditsRemaining={credits ?? 0}
      />
    </>
  );
}
