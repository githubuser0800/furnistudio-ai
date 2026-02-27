import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import StyleSelectionModal from "@/components/dashboard/StyleSelectionModal";
import ResultsView from "@/components/dashboard/ResultsView";
import LowCreditBanner from "@/components/dashboard/LowCreditBanner";
import CreditTopUpModal from "@/components/dashboard/CreditTopUpModal";
import BatchUploadFlow from "@/components/dashboard/BatchUploadFlow";
import { Upload, Image as ImageIcon, Sparkles, Layers, BarChart3, ArrowRight, Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface UserImage {
  id: string;
  filename: string;
  original_url: string | null;
  created_at: string;
}

interface Profile {
  credits_remaining: number;
  subscription_tier: string;
}

interface RecentJob {
  id: string;
  output_url: string | null;
  template_id: string | null;
  created_at: string;
}

type View = "grid" | "processing" | "results" | "batch";

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

export default function Dashboard() {
  const [images, setImages] = useState<UserImage[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [recentJobUrls, setRecentJobUrls] = useState<Record<string, string>>({});
  const [monthlyUploads, setMonthlyUploads] = useState(0);
  const [monthlyGenerated, setMonthlyGenerated] = useState(0);
  const [showTopUp, setShowTopUp] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // AI generation state
  const [view, setView] = useState<View>("grid");
  const [selectedImage, setSelectedImage] = useState<UserImage | null>(null);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resultData, setResultData] = useState<{
    beforeUrl: string;
    afterUrl: string;
    creditsRemaining: number;
    jobId: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [{ data: profileData }, { data: imagesData }, { data: jobsData }, { data: monthUploads }, { data: monthJobs }] = await Promise.all([
      supabase.from("profiles").select("credits_remaining, subscription_tier").eq("id", user.id).single(),
      supabase.from("images").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("jobs").select("id, output_url, template_id, created_at").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(4),
      supabase.from("images").select("id", { count: "exact" }).eq("user_id", user.id).gte("created_at", startOfMonth.toISOString()),
      supabase.from("jobs").select("id", { count: "exact" }).eq("user_id", user.id).eq("status", "completed").gte("created_at", startOfMonth.toISOString()),
    ]);

    if (profileData) setProfile(profileData);
    setMonthlyUploads(monthUploads?.length || 0);
    setMonthlyGenerated(monthJobs?.length || 0);

    if (imagesData) {
      setImages(imagesData);
      const paths = imagesData.filter((img) => img.original_url).map((img) => img.original_url!);
      if (paths.length > 0) {
        const { data: signedData } = await supabase.storage.from("furniture-images").createSignedUrls(paths, 3600);
        if (signedData) {
          const urlMap: Record<string, string> = {};
          for (const img of imagesData) {
            const signed = signedData.find((s) => s.path === img.original_url);
            if (signed?.signedUrl) urlMap[img.id] = signed.signedUrl;
          }
          setImageUrls(urlMap);
        }
      }
    }

    if (jobsData && jobsData.length > 0) {
      setRecentJobs(jobsData);
      const outputPaths = jobsData.filter((j) => j.output_url).map((j) => j.output_url!);
      if (outputPaths.length > 0) {
        const { data: signed } = await supabase.storage.from("furniture-images").createSignedUrls(outputPaths, 3600);
        if (signed) {
          const map: Record<string, string> = {};
          jobsData.forEach((j) => {
            const s = signed.find((si) => si.path === j.output_url);
            if (s?.signedUrl) map[j.id] = s.signedUrl;
          });
          setRecentJobUrls(map);
        }
      }
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("furniture-images").upload(filePath, file);
      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }
      await supabase.from("images").insert({ user_id: user.id, filename: file.name, original_url: filePath });
    }
    setUploading(false);
    await fetchData();
    toast({ title: "Upload complete", description: `${files.length} image(s) uploaded.` });
  };

  const handleImageClick = (img: UserImage) => {
    setSelectedImage(img);
    setShowStyleModal(true);
  };

  const handleGenerate = async (templateId: string, resolution: string, customPrompt?: string, aspectRatio?: string, cameraAngle?: string, variations?: number) => {
    if (!selectedImage) return;
    setGenerating(true);
    setShowStyleModal(false);
    setView("processing");

    try {
      const { data, error } = await supabase.functions.invoke("generate-staging", {
        body: {
          image_id: selectedImage.id,
          template_id: templateId,
          resolution,
          ...(customPrompt ? { custom_prompt: customPrompt } : {}),
          ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
          ...(cameraAngle ? { camera_angle: cameraAngle } : {}),
          ...(variations && variations > 1 ? { variations } : {}),
        },
      });

      if (error) throw new Error(error.message || "Generation failed");
      if (data?.error) throw new Error(data.error);

      if (data?.success && data.output_url) {
        const beforeUrl = imageUrls[selectedImage.id] || "";
        setResultData({ beforeUrl, afterUrl: data.output_url, creditsRemaining: data.credits_remaining, jobId: data.job_id });
        setProfile((prev) => prev ? { ...prev, credits_remaining: data.credits_remaining } : prev);
        setView("results");
      } else {
        throw new Error("No output received");
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      toast({ title: "Generation failed", description: err.message || "Please try again.", variant: "destructive" });
      setView("grid");
    } finally {
      setGenerating(false);
    }
  };

  const handleTryAnother = () => {
    setView("grid");
    if (selectedImage) setShowStyleModal(true);
  };

  const handleBackToDashboard = () => {
    setView("grid");
    setSelectedImage(null);
    setResultData(null);
    fetchData();
  };

  const maxCredits = profile?.subscription_tier === "free" ? 10 : profile?.subscription_tier === "starter" ? 50 : profile?.subscription_tier === "pro" ? 200 : 600;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {/* Processing overlay */}
        {view === "processing" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-accent" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">AI is staging your furniture...</h2>
            <p className="text-muted-foreground max-w-md">This typically takes 15–30 seconds.</p>
          </div>
        )}

        {/* Results view */}
        {view === "results" && resultData && (
          <ResultsView
            beforeUrl={resultData.beforeUrl}
            afterUrl={resultData.afterUrl}
            creditsRemaining={resultData.creditsRemaining}
            onTryAnother={handleTryAnother}
            onBackToDashboard={handleBackToDashboard}
            jobId={resultData.jobId}
            originalImageId={selectedImage?.id}
            onCreditsChange={(c) => setProfile((p) => p ? { ...p, credits_remaining: c } : p)}
          />
        )}

        {/* Batch upload flow */}
        {view === "batch" && (
          <BatchUploadFlow
            creditsRemaining={profile?.credits_remaining ?? 0}
            onComplete={() => { setView("grid"); fetchData(); }}
            onCreditsChange={(c) => setProfile((p) => p ? { ...p, credits_remaining: c } : p)}
          />
        )}

        {/* Default grid view */}
        {view === "grid" && (
          <>
            {/* Low Credit Banner */}
            {profile && (
              <LowCreditBanner
                creditsRemaining={profile.credits_remaining}
                maxCredits={maxCredits}
                onTopUp={() => setShowTopUp(true)}
              />
            )}

            {/* Header */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Upload furniture images and stage them with AI</p>
              </div>
              {profile && (
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowTopUp(true)}>
                    <Badge variant="outline" className="px-3 py-1 text-sm cursor-pointer hover:bg-accent/10 transition-colors">
                      {profile.credits_remaining} credits remaining
                    </Badge>
                  </button>
                  <Badge className="bg-accent text-accent-foreground capitalize px-3 py-1">
                    {profile.subscription_tier}
                  </Badge>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Upload className="h-4 w-4" />
                  <span className="text-xs font-medium">Uploads this month</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{monthlyUploads}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-medium">Generated this month</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{monthlyGenerated}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs font-medium">Credits remaining</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{profile?.credits_remaining ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-center">
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/library")} className="w-full">
                  <Layers className="mr-2 h-4 w-4" /> View Library
                </Button>
              </div>
            </div>

            {/* Recent Generated */}
            {recentJobs.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-foreground">Recent Generations</h2>
                  <button onClick={() => navigate("/dashboard/library")} className="text-sm text-accent hover:underline flex items-center gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {recentJobs.map((job) => (
                    <div key={job.id} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="aspect-square bg-muted overflow-hidden">
                        {recentJobUrls[job.id] ? (
                          <img src={recentJobUrls[job.id]} alt="Generated" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Layers className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-card-foreground truncate">
                          {TEMPLATE_NAMES[job.template_id || ""] || "Custom"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(job.created_at).toLocaleDateString("en-GB")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Zone */}
            <div className="mb-10 flex flex-col sm:flex-row gap-4">
              <div
                className={`flex-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
                  dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input id="file-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
                <Upload className={`mb-3 h-8 w-8 ${dragOver ? "text-accent" : "text-muted-foreground"}`} />
                <p className="mb-1 text-base font-medium text-foreground">
                  {uploading ? "Uploading..." : "Drop images here or click to browse"}
                </p>
                <p className="text-sm text-muted-foreground">Single image · quick staging</p>
              </div>

              <button
                onClick={() => setView("batch")}
                className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-10 hover:border-accent/50 transition-colors"
              >
                <Images className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-base font-medium text-foreground">Batch Upload</p>
                <p className="text-sm text-muted-foreground">Up to 10 images · same style</p>
              </button>
            </div>

            {/* Images Grid */}
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground">No images yet</p>
                <p className="text-sm text-muted-foreground/60">Upload your first furniture photo to get started</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {images.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => handleImageClick(img)}
                    className="card-elevated group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-accent/50 hover:shadow-lg"
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                      {imageUrls[img.id] ? (
                        <img src={imageUrls[img.id]} alt={img.filename} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-card-foreground">{img.filename}</p>
                      <p className="text-xs text-muted-foreground">{new Date(img.created_at).toLocaleDateString("en-GB")}</p>
                      <p className="text-xs text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to stage with AI →</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <StyleSelectionModal
        open={showStyleModal}
        onClose={() => setShowStyleModal(false)}
        onGenerate={handleGenerate}
        creditsRemaining={profile?.credits_remaining ?? 0}
        loading={generating}
        imageName={selectedImage?.filename ?? ""}
      />

      <CreditTopUpModal
        open={showTopUp}
        onClose={() => setShowTopUp(false)}
        creditsRemaining={profile?.credits_remaining ?? 0}
      />
    </div>
  );
}
