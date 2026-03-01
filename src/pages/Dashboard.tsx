import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import StyleSelectionModal from "@/components/dashboard/StyleSelectionModal";
import ResultsView from "@/components/dashboard/ResultsView";
import LowCreditBanner from "@/components/dashboard/LowCreditBanner";
import CreditTopUpModal from "@/components/dashboard/CreditTopUpModal";
import BatchUploadFlow from "@/components/dashboard/BatchUploadFlow";
import OnboardingModal from "@/components/dashboard/OnboardingModal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  Layers,
  BarChart3,
  ArrowRight,
  Images,
  Star,
  RotateCcw,
  Download,
  RefreshCw,
  Trash2,
  Wand2,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

interface UserImage {
  id: string;
  filename: string;
  original_url: string | null;
  created_at: string;
}

interface Profile {
  credits_remaining: number;
  subscription_tier: string;
  full_name: string | null;
}

interface RecentJob {
  id: string;
  output_url: string | null;
  template_id: string | null;
  created_at: string;
}

interface FolderItem {
  id: string;
  name: string;
  color: string;
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

const PROGRESS_STEPS = [
  { label: "Analysing image...", pct: 15 },
  { label: "Generating room scene...", pct: 50 },
  { label: "Rendering details...", pct: 80 },
  { label: "Finalising...", pct: 95 },
];

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
  const [monthlyCreditsUsed, setMonthlyCreditsUsed] = useState(0);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [recentFolders, setRecentFolders] = useState<FolderItem[]>([]);
  const [lastTemplateId, setLastTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // AI generation state
  const [view, setView] = useState<View>("grid");
  const [selectedImage, setSelectedImage] = useState<UserImage | null>(null);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
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

    const [{ data: profileData }, { data: imagesData }, { data: jobsData }, { data: monthUploads }, { data: monthJobs }, { data: foldersData }] = await Promise.all([
      supabase.from("profiles").select("credits_remaining, subscription_tier, full_name").eq("id", user.id).single(),
      supabase.from("images").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("jobs").select("id, output_url, template_id, created_at, credits_used").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(4),
      supabase.from("images").select("id", { count: "exact" }).eq("user_id", user.id).gte("created_at", startOfMonth.toISOString()),
      supabase.from("jobs").select("id, credits_used", { count: "exact" }).eq("user_id", user.id).eq("status", "completed").gte("created_at", startOfMonth.toISOString()),
      (supabase as any).from("folders").select("id, name, color").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(4),
    ]);

    if (profileData) setProfile(profileData as Profile);
    setMonthlyUploads(monthUploads?.length || 0);
    setMonthlyGenerated(monthJobs?.length || 0);
    setMonthlyCreditsUsed((monthJobs || []).reduce((sum: number, j: any) => sum + (j.credits_used || 0), 0));
    if (foldersData) setRecentFolders(foldersData as FolderItem[]);

    if ((!imagesData || imagesData.length === 0) && (!jobsData || jobsData.length === 0)) {
      const onboarded = localStorage.getItem("furnistudio_onboarded");
      if (!onboarded) setShowOnboarding(true);
    }

    if (jobsData && jobsData.length > 0) {
      setLastTemplateId(jobsData[0].template_id);
    }

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

    setIsLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("furnistudio_onboarded", "true");
  };

  const validateFiles = (files: FileList): File[] => {
    const valid: File[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ title: "Invalid file type", description: `"${file.name}" must be JPEG, PNG, or WebP.`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "File too large", description: `"${file.name}" exceeds 20MB limit.`, variant: "destructive" });
        continue;
      }
      valid.push(file);
    }
    return valid;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const validFiles = validateFiles(files);
    if (validFiles.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(true);
    for (const file of validFiles) {
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
    toast({ title: "Upload complete", description: `${validFiles.length} image(s) uploaded.` });
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
    setProgressStep(0);
    setSelectedTemplateName(TEMPLATE_NAMES[templateId] || "Custom");

    // Simulate progress steps
    const stepTimers = PROGRESS_STEPS.map((_, i) =>
      setTimeout(() => setProgressStep(i), i === 0 ? 500 : i * 7000)
    );

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

      stepTimers.forEach(clearTimeout);

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
      stepTimers.forEach(clearTimeout);
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

  const handleRedoLast = () => {
    if (lastTemplateId && images.length > 0) {
      setSelectedImage(images[0]);
      setShowStyleModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("images").delete().eq("id", deleteTarget);
    setDeleteTarget(null);
    fetchData();
    toast({ title: "Image deleted" });
  };

  const handleQuickDownload = async (url: string, name: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Please try again", variant: "destructive" });
    }
  };

  const maxCredits = profile?.subscription_tier === "free" ? 10 : profile?.subscription_tier === "starter" ? 50 : profile?.subscription_tier === "pro" ? 200 : 600;
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Enhanced Processing overlay */}
        {view === "processing" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-accent" />
            </div>

            {/* Source thumbnail + template */}
            {selectedImage && imageUrls[selectedImage.id] && (
              <div className="mb-4 flex items-center gap-3">
                <img
                  src={imageUrls[selectedImage.id]}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover border border-border"
                />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{selectedImage.filename}</p>
                  <p className="text-xs text-accent">{selectedTemplateName}</p>
                </div>
              </div>
            )}

            <h2 className="text-xl font-bold text-foreground mb-2">
              {PROGRESS_STEPS[progressStep]?.label || "Processing..."}
            </h2>

            <div className="w-64 mt-4">
              <Progress value={PROGRESS_STEPS[progressStep]?.pct || 10} className="h-2" />
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              This typically takes 15–30 seconds · 1 credit
            </p>

            {/* Step indicators */}
            <div className="mt-6 flex gap-2">
              {PROGRESS_STEPS.map((step, i) => (
                <div
                  key={step.label}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i <= progressStep ? "bg-accent" : "bg-muted"
                  }`}
                />
              ))}
            </div>
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
            {/* Loading skeletons */}
            {isLoading ? (
              <div className="space-y-6">
                {/* Header skeleton */}
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="h-10 w-36" />
                </div>
                {/* Stats skeleton */}
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
                {/* Grid skeleton */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Low Credit Banners */}
                {profile && profile.credits_remaining === 0 && (
                  <div className="mb-6 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <span className="text-sm font-medium text-destructive">No credits remaining — generation blocked</span>
                    <Button size="sm" onClick={() => setShowTopUp(true)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Upgrade Now
                    </Button>
                  </div>
                )}
                {profile && profile.credits_remaining > 0 && (
                  <LowCreditBanner
                    creditsRemaining={profile.credits_remaining}
                    maxCredits={maxCredits}
                    onTopUp={() => setShowTopUp(true)}
                  />
                )}

                {/* Personalized Header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold font-heading text-foreground">
                      Hi {firstName}! <span className="text-accent">{profile?.credits_remaining ?? 0}</span> credits remaining
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      This month: {monthlyGenerated} images · {monthlyCreditsUsed} credits used
                    </p>
                  </div>
                  <Button
                    onClick={() => document.getElementById("file-input")?.click()}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 min-h-[44px]"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Images
                  </Button>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => document.getElementById("file-input")?.click()}
                  >
                    <Upload className="mr-1.5 h-4 w-4" /> Upload
                  </Button>
                  {lastTemplateId && (
                    <Button variant="outline" size="sm" className="min-h-[44px]" onClick={handleRedoLast}>
                      <RotateCcw className="mr-1.5 h-4 w-4" /> Redo Last
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => navigate("/dashboard/library")}>
                    <Star className="mr-1.5 h-4 w-4" /> Favorites
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setView("batch")}
                  >
                    <Images className="mr-1.5 h-4 w-4" /> Batch Upload
                  </Button>
                </div>

                {/* Recent Generated */}
                {recentJobs.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent</h2>
                      <button onClick={() => navigate("/dashboard/library")} className="text-sm text-accent hover:underline flex items-center gap-1">
                        View All <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {recentJobs.map((job) => (
                        <div key={job.id} className="group rounded-xl border border-border bg-card overflow-hidden">
                          <div className="aspect-square bg-muted overflow-hidden relative">
                            {recentJobUrls[job.id] ? (
                              <img src={recentJobUrls[job.id]} alt="Generated" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <Layers className="h-8 w-8 text-muted-foreground/30" />
                              </div>
                            )}
                            {recentJobUrls[job.id] && (
                              <div className="absolute inset-0 bg-background/0 group-hover:bg-background/60 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                <button
                                  onClick={() => handleQuickDownload(recentJobUrls[job.id], job.template_id || "image")}
                                  className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-full bg-card flex items-center justify-center shadow-md hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
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

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Upload className="h-4 w-4" />
                      <span className="text-xs font-medium">Uploads</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{monthlyUploads}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-xs font-medium">Generated</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{monthlyGenerated}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-accent/50 transition-colors" onClick={() => setShowTopUp(true)}>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-xs font-medium">Credits</span>
                    </div>
                    <p className="text-2xl font-bold text-accent">{profile?.credits_remaining ?? 0}</p>
                  </div>
                </div>

                {/* Recent Folders */}
                {recentFolders.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Projects</h2>
                      <button onClick={() => navigate("/dashboard/library")} className="text-sm text-accent hover:underline flex items-center gap-1">
                        View All <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {recentFolders.map((folder) => (
                        <button
                          key={folder.id}
                          onClick={() => navigate("/dashboard/library")}
                          className="rounded-xl border border-border bg-card p-4 text-left hover:border-accent/50 transition-all min-h-[44px]"
                        >
                          <div className="h-3 w-3 rounded-full mb-2" style={{ backgroundColor: folder.color }} />
                          <p className="text-sm font-medium text-card-foreground truncate">{folder.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Zone */}
                <div className="mb-8 flex flex-col sm:flex-row gap-4">
                  <div
                    className={`flex-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 sm:p-10 transition-colors min-h-[120px] ${
                      dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
                    onClick={() => document.getElementById("file-input")?.click()}
                  >
                    <input id="file-input" type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
                    <Upload className={`mb-3 h-8 w-8 ${dragOver ? "text-accent" : "text-muted-foreground"}`} />
                    <p className="mb-1 text-base font-medium text-foreground">
                      {uploading ? "Uploading..." : "Drop images here"}
                    </p>
                    <p className="text-sm text-muted-foreground">JPEG, PNG, WebP · Max 20MB · 1 credit per generation</p>
                  </div>

                  <button
                    onClick={() => setView("batch")}
                    className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 sm:p-10 hover:border-accent/50 transition-colors min-h-[120px]"
                  >
                    <Images className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-base font-medium text-foreground">Batch Upload</p>
                    <p className="text-sm text-muted-foreground">Up to 10 images · same style</p>
                  </button>
                </div>

                {/* Enhanced Empty State */}
                {images.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-border bg-card/50 py-16 text-center">
                    <Camera className="mx-auto mb-4 h-14 w-14 text-accent/40" />
                    <h3 className="text-lg font-bold text-foreground mb-2">No images yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Upload your first furniture photo and we'll transform it into a stunning room scene.
                    </p>
                    <div className="flex flex-wrap justify-center gap-6 mb-8">
                      {[
                        { step: "1", label: "Upload a photo", icon: Upload },
                        { step: "2", label: "Choose a room style", icon: Wand2 },
                        { step: "3", label: "Download in 4K", icon: Download },
                      ].map((s) => (
                        <div key={s.step} className="flex flex-col items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                            <s.icon className="h-5 w-5 text-accent" />
                          </div>
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={() => document.getElementById("file-input")?.click()}
                      className="bg-accent text-accent-foreground hover:bg-gold-dark btn-glow"
                      size="lg"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Your First Photo
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className="card-elevated group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-accent/50 hover:shadow-lg"
                      >
                        <div
                          className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative"
                          onClick={() => handleImageClick(img)}
                        >
                          {imageUrls[img.id] ? (
                            <img src={imageUrls[img.id]} alt={img.filename} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          ) : (
                            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                          )}
                          <div className="absolute inset-0 bg-background/0 group-hover:bg-background/40 transition-colors flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-accent opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-card-foreground">{img.filename}</p>
                              <p className="text-xs text-muted-foreground">{new Date(img.created_at).toLocaleDateString("en-GB")}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-8 w-8 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0 -mr-1">
                                  <span className="text-muted-foreground text-lg leading-none">...</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {imageUrls[img.id] && (
                                  <DropdownMenuItem onClick={() => handleQuickDownload(imageUrls[img.id], img.filename)}>
                                    <Download className="mr-2 h-3 w-3" /> Download
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleImageClick(img)}>
                                  <Sparkles className="mr-2 h-3 w-3" /> Generate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleImageClick(img)}>
                                  <RefreshCw className="mr-2 h-3 w-3" /> Regenerate
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(img.id)}>
                                  <Trash2 className="mr-2 h-3 w-3" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <p className="text-xs text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to stage · 1 credit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this image. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <OnboardingModal
        open={showOnboarding}
        onClose={handleCloseOnboarding}
        onStartUpload={() => document.getElementById("file-input")?.click()}
      />

      <MobileBottomNav onUploadClick={() => document.getElementById("file-input")?.click()} />
    </div>
  );
}
