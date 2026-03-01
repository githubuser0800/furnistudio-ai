import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ImageIcon, Zap, TrendingUp, Calendar, Sparkles } from "lucide-react";

interface Job {
  id: string;
  created_at: string;
  template_id: string | null;
  resolution: string | null;
  credits_used: number;
  status: string;
}

interface DailyUsage {
  date: string;
  credits: number;
  images: number;
}

const TEMPLATE_NAMES: Record<string, string> = {
  scandinavian: "Modern Scandinavian",
  contemporary_grey: "Contemporary Grey",
  cozy_british: "Cozy British",
  luxury_penthouse: "Luxury Penthouse",
  minimalist_white: "Minimalist White",
  serene_bedroom: "Serene Bedroom",
  boutique_hotel: "Boutique Hotel",
  light_airy: "Light & Airy",
  modern_dining: "Modern Dining",
  rustic_farmhouse: "Rustic Farmhouse",
  modern_office: "Modern Home Office",
  creative_studio: "Creative Studio",
  white_background: "Pure White Background",
  grey_studio: "Grey Studio",
  showroom_floor: "Showroom Floor",
  custom: "Custom Prompt",
};

export default function Usage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: jobsData }, { data: profile }] = await Promise.all([
      supabase.from("jobs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("credits_remaining").eq("id", user.id).single(),
    ]);

    if (jobsData) setJobs(jobsData);
    if (profile) setCreditsRemaining(profile.credits_remaining);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedJobs = jobs.filter((j) => j.status === "completed");
  const thisMonthJobs = completedJobs.filter((j) => new Date(j.created_at) >= startOfMonth);

  const totalImagesAllTime = completedJobs.length;
  const totalImagesThisMonth = thisMonthJobs.length;
  const creditsUsedThisMonth = thisMonthJobs.reduce((sum, j) => sum + j.credits_used, 0);
  const creditsUsedAllTime = completedJobs.reduce((sum, j) => sum + j.credits_used, 0);

  // Build daily usage for last 30 days
  const dailyUsage: DailyUsage[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayJobs = completedJobs.filter((j) => j.created_at.slice(0, 10) === dateStr);
    dailyUsage.push({
      date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      credits: dayJobs.reduce((s, j) => s + j.credits_used, 0),
      images: dayJobs.length,
    });
  }

  const recentJobs = completedJobs.slice(0, 20);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Usage</h1>

        {/* Stats cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Images This Month</p>
                <p className="text-2xl font-bold text-card-foreground">{totalImagesThisMonth}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credits Used This Month</p>
                <p className="text-2xl font-bold text-card-foreground">{creditsUsedThisMonth}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">All-Time Images</p>
                <p className="text-2xl font-bold text-card-foreground">{totalImagesAllTime}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credits Remaining</p>
                <p className="text-2xl font-bold text-card-foreground">{creditsRemaining}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Daily usage chart */}
        <Card className="p-6 border-border bg-card mb-8">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">Daily Usage (Last 30 Days)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="credits" name="Credits" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="images" name="Images" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent generations */}
        <Card className="border-border bg-card">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-card-foreground">Recent Generations</h2>
          </div>
          {recentJobs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No generations yet</div>
          ) : (
            <div className="divide-y divide-border">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-card-foreground">
                        {TEMPLATE_NAMES[job.template_id || ""] || job.template_id || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        {new Date(job.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-[11px]">
                      {(job.resolution || "1k").toUpperCase()}
                    </Badge>
                    <span className="text-sm font-medium text-accent">{job.credits_used} cr</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
