import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/layout/Navbar";
import StyleSelectionModal from "@/components/dashboard/StyleSelectionModal";
import ResultsView from "@/components/dashboard/ResultsView";
import { Upload, Image as ImageIcon, Clock, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

type View = "grid" | "processing" | "results";

export default function Dashboard() {
  const [images, setImages] = useState<UserImage[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // AI generation state
  const [view, setView] = useState<View>("grid");
  const [selectedImage, setSelectedImage] = useState<UserImage | null>(null);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resultData, setResultData] = useState<{
    beforeUrl: string;
    afterUrl: string;
    creditsRemaining: number;
  } | null>(null);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profileData }, { data: imagesData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("credits_remaining, subscription_tier")
        .eq("id", user.id)
        .single(),
      supabase
        .from("images")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (profileData) setProfile(profileData);
    if (imagesData) {
      setImages(imagesData);
      // Fetch signed URLs for display
      const paths = imagesData
        .filter((img) => img.original_url)
        .map((img) => img.original_url!);
      if (paths.length > 0) {
        const { data: signedData } = await supabase.storage
          .from("furniture-images")
          .createSignedUrls(paths, 3600);
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("furniture-images")
        .upload(filePath, file);
      if (uploadError) {
        toast({
          title: "Upload failed",
          description: uploadError.message,
          variant: "destructive",
        });
        continue;
      }
      await supabase.from("images").insert({
        user_id: user.id,
        filename: file.name,
        original_url: filePath,
      });
    }
    setUploading(false);
    await fetchData();
    toast({
      title: "Upload complete",
      description: `${files.length} image(s) uploaded.`,
    });
  };

  const handleImageClick = (img: UserImage) => {
    setSelectedImage(img);
    setShowStyleModal(true);
  };

  const handleGenerate = async (templateId: string, resolution: string, customPrompt?: string, aspectRatio?: string) => {
    if (!selectedImage) return;
    setGenerating(true);
    setShowStyleModal(false);
    setView("processing");

    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-staging",
        {
          body: {
            image_id: selectedImage.id,
            template_id: templateId,
            resolution,
            ...(customPrompt ? { custom_prompt: customPrompt } : {}),
            ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
          },
        }
      );

      if (error) throw new Error(error.message || "Generation failed");

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success && data.output_url) {
        const beforeUrl = imageUrls[selectedImage.id] || "";
        setResultData({
          beforeUrl,
          afterUrl: data.output_url,
          creditsRemaining: data.credits_remaining,
        });
        setProfile((prev) =>
          prev
            ? { ...prev, credits_remaining: data.credits_remaining }
            : prev
        );
        setView("results");
      } else {
        throw new Error("No output received");
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      toast({
        title: "Generation failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      setView("grid");
    } finally {
      setGenerating(false);
    }
  };

  const handleTryAnother = () => {
    setView("grid");
    if (selectedImage) {
      setShowStyleModal(true);
    }
  };

  const handleBackToDashboard = () => {
    setView("grid");
    setSelectedImage(null);
    setResultData(null);
    fetchData();
  };

  const statusBadge = (status: string) => {
    const map: Record<
      string,
      { icon: typeof Clock; label: string; className: string }
    > = {
      pending: {
        icon: Clock,
        label: "Pending",
        className: "bg-muted text-muted-foreground",
      },
      processing: {
        icon: AlertCircle,
        label: "Processing",
        className: "bg-accent/20 text-accent",
      },
      completed: {
        icon: CheckCircle,
        label: "Completed",
        className: "bg-green-100 text-green-700",
      },
    };
    const s = map[status] || map.pending;
    return (
      <Badge variant="secondary" className={s.className}>
        <s.icon className="mr-1 h-3 w-3" /> {s.label}
      </Badge>
    );
  };

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
            <h2 className="text-xl font-bold text-foreground mb-2">
              AI is staging your furniture...
            </h2>
            <p className="text-muted-foreground max-w-md">
              This typically takes 15–30 seconds. We're placing your furniture
              into a professionally designed room scene.
            </p>
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
          />
        )}

        {/* Default grid view */}
        {view === "grid" && (
          <>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Upload furniture images and stage them with AI
                </p>
              </div>
              {profile && (
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="px-3 py-1 text-sm"
                  >
                    {profile.credits_remaining} credits remaining
                  </Badge>
                  <Badge className="bg-accent text-accent-foreground capitalize px-3 py-1">
                    {profile.subscription_tier}
                  </Badge>
                </div>
              )}
            </div>

            {/* Upload Zone */}
            <div
              className={`mb-10 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                dragOver
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleUpload(e.dataTransfer.files);
              }}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <Upload
                className={`mb-4 h-10 w-10 ${
                  dragOver ? "text-accent" : "text-muted-foreground"
                }`}
              />
              <p className="mb-1 text-lg font-medium text-foreground">
                {uploading
                  ? "Uploading..."
                  : "Drop furniture images here or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground">
                JPG, PNG, WebP up to 10MB each
              </p>
            </div>

            {/* Images Grid */}
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-lg font-medium text-muted-foreground">
                  No images yet
                </p>
                <p className="text-sm text-muted-foreground/60">
                  Upload your first furniture photo to get started
                </p>
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
                        <img
                          src={imageUrls[img.id]}
                          alt={img.filename}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-card-foreground">
                        {img.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(img.created_at).toLocaleDateString("en-GB")}
                      </p>
                      <p className="text-xs text-accent mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to stage with AI →
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Style Selection Modal */}
      <StyleSelectionModal
        open={showStyleModal}
        onClose={() => setShowStyleModal(false)}
        onGenerate={handleGenerate}
        creditsRemaining={profile?.credits_remaining ?? 0}
        loading={generating}
        imageName={selectedImage?.filename ?? ""}
      />
    </div>
  );
}
