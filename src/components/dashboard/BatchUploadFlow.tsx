import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  X,
  Plus,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Download,
  ChevronDown,
  Check,
} from "lucide-react";
import StyleSelectionModal from "./StyleSelectionModal";
import ExportModal from "./ExportModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SHOT_TYPE_LABELS = [
  { value: "Full Product", group: "Standard" },
  { value: "3/4 Angle", group: "Standard" },
  { value: "Side View", group: "Standard" },
  { value: "Back View", group: "Standard" },
  { value: "Top View", group: "Standard" },
  { value: "Corner View", group: "Standard" },
  { value: "Close-up: Arm", group: "Close-up" },
  { value: "Close-up: Seat", group: "Close-up" },
  { value: "Close-up: Leg", group: "Close-up" },
  { value: "Close-up: Fabric", group: "Close-up" },
  { value: "Close-up: Detail", group: "Close-up" },
  { value: "Feature: Reclined", group: "Feature" },
  { value: "Feature: Extended", group: "Feature" },
];

const QUICK_LABELS = ["Full Product", "3/4 Angle", "Side View", "Close-up: Arm", "Close-up: Fabric", "Close-up: Detail"];

interface StagedFile {
  file: File;
  preview: string;
  label: string;
  imageId?: string;
  uploaded: boolean;
  detecting?: boolean;
  detectedLabel?: string;
}

interface BatchResult {
  imageId: string;
  label: string;
  beforeUrl: string;
  afterUrl: string;
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
}

interface BatchUploadFlowProps {
  creditsRemaining: number;
  onComplete: () => void;
  onCreditsChange: (credits: number) => void;
}

export default function BatchUploadFlow({
  creditsRemaining,
  onComplete,
  onCreditsChange,
}: BatchUploadFlowProps) {
  const [step, setStep] = useState<"upload" | "detect" | "style" | "processing" | "results">("upload");
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sameStyle, setSameStyle] = useState(true);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");
  const [exportImage, setExportImage] = useState<{ url: string; name: string } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).slice(0, 10 - files.length).map((file, i) => ({
      file,
      preview: URL.createObjectURL(file),
      label: SHOT_TYPE_LABELS[files.length + i]?.value || "Full Product",
      uploaded: false,
    }));
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateLabel = (index: number, label: string) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, label } : f)));
  };

  const handleUploadAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(true);
    const updated = [...files];

    for (let i = 0; i < updated.length; i++) {
      setUploadProgress(((i + 1) / updated.length) * 100);
      const f = updated[i];
      const filePath = `${user.id}/${Date.now()}_${f.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("furniture-images")
        .upload(filePath, f.file);

      if (uploadError) {
        toast({ title: `Failed to upload ${f.file.name}`, variant: "destructive" });
        continue;
      }

      const { data: imgRecord } = await supabase.from("images").insert({
        user_id: user.id,
        filename: f.file.name,
        original_url: filePath,
        label: f.label || null,
      } as any).select().single();

      if (imgRecord) {
        updated[i] = { ...updated[i], imageId: imgRecord.id, uploaded: true };
      }
    }

    setFiles(updated);
    setUploading(false);
    setUploadProgress(100);

    // Smart shot detection
    const uploadedIds = updated.filter((f) => f.uploaded && f.imageId).map((f) => f.imageId!);
    if (uploadedIds.length > 0) {
      setStep("detect");
      setDetecting(true);
      try {
        const { data, error } = await supabase.functions.invoke("detect-shot-type", {
          body: { image_ids: uploadedIds },
        });
        if (data?.success && data.detections) {
          const detected = data.detections as Array<{ image_id: string; detected_type: string; confidence: string }>;
          const detectedFiles = updated.map((f) => {
            const det = detected.find((d) => d.image_id === f.imageId);
            if (det) {
              return { ...f, label: det.detected_type, detectedLabel: det.detected_type };
            }
            return f;
          });
          setFiles(detectedFiles);
        }
      } catch (err) {
        console.error("Shot detection failed:", err);
        // Continue without detection - user can still manually label
      }
      setDetecting(false);
    } else {
      setStep("style");
      setShowStyleModal(true);
    }
  };

  const handleBatchGenerate = async (
    templateId: string,
    resolution: string,
    customPrompt?: string,
    aspectRatio?: string,
    cameraAngle?: string,
  ) => {
    setShowStyleModal(false);
    setStep("processing");

    const uploadedFiles = files.filter((f) => f.uploaded && f.imageId);
    setProcessingTotal(uploadedFiles.length);

    // Create product set
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const templateNames: Record<string, string> = {
      scandinavian: "Scandinavian", contemporary_grey: "Contemporary Grey", cozy_british: "Cozy British",
      luxury_penthouse: "Luxury Penthouse", minimalist_white: "Minimalist White", serene_bedroom: "Serene Bedroom",
      boutique_hotel: "Boutique Hotel", light_airy: "Light & Airy", modern_dining: "Modern Dining",
      rustic_farmhouse: "Rustic Farmhouse", modern_office: "Home Office", creative_studio: "Creative Studio",
      white_background: "White Background", grey_studio: "Grey Studio", showroom_floor: "Showroom Floor", custom: "Custom",
    };
    const setName = `${templateNames[templateId] || "Custom"} - ${new Date().toLocaleDateString("en-GB")}`;

    const { data: setRecord } = await supabase.from("product_sets" as any).insert({
      user_id: user.id,
      name: setName,
      template_id: templateId,
      resolution,
      image_count: uploadedFiles.length,
    } as any).select().single();

    const setId = (setRecord as any)?.id;
    const results: BatchResult[] = [];
    let currentCredits = creditsRemaining;
    let masterBackgroundPath: string | null = null;

    for (let i = 0; i < uploadedFiles.length; i++) {
      setProcessingIndex(i + 1);
      const f = uploadedFiles[i];

      // Update status message
      if (i === 0) {
        setProcessingStatus("Creating room environment...");
      } else {
        const viewLabel = f.label || `image ${i + 1}`;
        setProcessingStatus(`Adding ${viewLabel.toLowerCase()}...`);
      }

      try {
        const { data, error } = await supabase.functions.invoke("generate-staging", {
          body: {
            image_id: f.imageId,
            template_id: templateId,
            resolution,
            ...(customPrompt ? { custom_prompt: customPrompt } : {}),
            ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
            ...(cameraAngle ? { camera_angle: cameraAngle } : {}),
            ...(setId ? { set_id: setId } : {}),
            label: f.label,
            batch_index: i,
            batch_total: uploadedFiles.length,
            // Pass master background for images 2+
            ...(i > 0 && masterBackgroundPath ? { master_background_path: masterBackgroundPath } : {}),
          },
        });

        if (error || data?.error) {
          results.push({
            imageId: f.imageId!,
            label: f.label,
            beforeUrl: f.preview,
            afterUrl: "",
            jobId: "",
            status: "failed",
          });
        } else if (data?.success) {
          currentCredits = data.credits_remaining;
          onCreditsChange(currentCredits);

          // Capture master background path from image 1
          if (i === 0 && data.master_background_path) {
            masterBackgroundPath = data.master_background_path;
          }

          results.push({
            imageId: f.imageId!,
            label: f.label,
            beforeUrl: f.preview,
            afterUrl: data.output_url,
            jobId: data.job_id,
            status: "completed",
          });
        }
      } catch {
        results.push({
          imageId: f.imageId!,
          label: f.label,
          beforeUrl: f.preview,
          afterUrl: "",
          jobId: "",
          status: "failed",
        });
      }

      setBatchResults([...results]);
    }

    setStep("results");
    toast({
      title: "Batch complete",
      description: `${results.filter((r) => r.status === "completed").length} of ${uploadedFiles.length} images generated.`,
    });
  };

  const handleDownloadAll = async () => {
    const completed = batchResults.filter((r) => r.status === "completed" && r.afterUrl);
    for (const r of completed) {
      try {
        const resp = await fetch(r.afterUrl);
        const blob = await resp.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${r.label || "staged"}-${r.jobId.slice(0, 6)}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        // skip
      }
    }
  };

  // === UPLOAD STEP ===
  if (step === "upload") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Batch Upload</h2>
            <p className="text-sm text-muted-foreground">Upload up to 10 images to process with the same style</p>
          </div>
          <Badge variant="outline" className="px-3 py-1">{files.length}/10 images</Badge>
        </div>

        {files.length < 10 && (
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 hover:border-accent/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFilesSelected(e.dataTransfer.files); }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Drop images or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP · up to 10 images</p>
          </div>
        )}

        {files.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {files.map((f, i) => (
              <div key={i} className="relative rounded-xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-destructive/80 flex items-center justify-center hover:bg-destructive transition-colors"
                >
                  <X className="h-3 w-3 text-destructive-foreground" />
                </button>
                <div className="aspect-square overflow-hidden">
                  <img src={f.preview} alt={f.file.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-2">
                  <Select value={f.label} onValueChange={(val) => updateLabel(i, val)}>
                    <SelectTrigger className="text-xs h-7">
                      <SelectValue placeholder="Select shot type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOT_TYPE_LABELS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{f.file.name}</p>
                </div>
              </div>
            ))}

            {files.length < 10 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center aspect-square hover:border-accent/50 transition-colors"
              >
                <Plus className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Add More</span>
              </button>
            )}
          </div>
        )}

        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Quick labels:</span>
            {QUICK_LABELS.map((label) => (
              <button
                key={label}
                onClick={() => {
                  const idx = files.findIndex((f) => !f.label || f.label === "Full Product");
                  if (idx >= 0) updateLabel(idx, label);
                }}
                className="px-2 py-0.5 rounded-full border border-border text-[11px] text-foreground hover:bg-accent/10 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Uploading...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {files.length > 0 && !uploading && (
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <Switch checked={sameStyle} onCheckedChange={setSameStyle} />
              <span className="text-sm text-foreground">Apply same style to all</span>
            </div>
            <Button
              onClick={handleUploadAll}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload & Choose Style ({files.length} images)
            </Button>
          </div>
        )}

        <StyleSelectionModal
          open={showStyleModal}
          onClose={() => { setShowStyleModal(false); setStep("upload"); }}
          onGenerate={(templateId, resolution, customPrompt, aspectRatio, cameraAngle) => {
            handleBatchGenerate(templateId, resolution, customPrompt, aspectRatio, cameraAngle);
          }}
          creditsRemaining={creditsRemaining}
          loading={false}
          imageName={`${files.filter((f) => f.uploaded).length} images (batch)`}
        />
      </div>
    );
  }

  // === DETECT STEP (Smart Shot Detection) ===
  if (step === "detect") {
    const uploadedFiles = files.filter((f) => f.uploaded && f.imageId);
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">
            {detecting ? "Detecting shot types..." : "Detected shot types:"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {detecting ? "AI is analyzing your images" : "Confirm or change the detected labels, then continue"}
          </p>
        </div>

        {detecting && (
          <div className="flex justify-center py-8">
            <div className="h-12 w-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
          </div>
        )}

        {!detecting && (
          <>
            <div className="space-y-3">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0">
                    <img src={f.preview} alt={f.file.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{f.file.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Select value={f.label} onValueChange={(val) => updateLabel(files.indexOf(f), val)}>
                        <SelectTrigger className="text-xs h-7 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHOT_TYPE_LABELS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {f.detectedLabel && f.label === f.detectedLabel && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          <Check className="mr-0.5 h-2.5 w-2.5" /> Auto-detected
                        </Badge>
                      )}
                      {f.detectedLabel && f.label !== f.detectedLabel && (
                        <button
                          onClick={() => updateLabel(files.indexOf(f), f.detectedLabel!)}
                          className="text-[10px] text-accent hover:underline"
                        >
                          Reset to: {f.detectedLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button
                onClick={() => { setStep("style"); setShowStyleModal(true); }}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Continue to Style Selection
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // === STYLE STEP ===
  if (step === "style") {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <Sparkles className="h-10 w-10 text-accent mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground">Choose a style for your batch</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {files.filter((f) => f.uploaded).length} images uploaded · Select a template to apply
          </p>
          <Button className="mt-4 bg-accent text-accent-foreground" onClick={() => setShowStyleModal(true)}>
            Open Style Selection
          </Button>
        </div>
        <StyleSelectionModal
          open={showStyleModal}
          onClose={() => { setShowStyleModal(false); setStep("upload"); }}
          onGenerate={(templateId, resolution, customPrompt, aspectRatio, cameraAngle) => {
            handleBatchGenerate(templateId, resolution, customPrompt, aspectRatio, cameraAngle);
          }}
          creditsRemaining={creditsRemaining}
          loading={false}
          imageName={`${files.filter((f) => f.uploaded).length} images (batch)`}
        />
      </div>
    );
  }

  // === PROCESSING STEP ===
  if (step === "processing") {
    const pct = processingTotal > 0 ? (processingIndex / processingTotal) * 100 : 0;
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-accent" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Processing {processingIndex} of {processingTotal} images...
        </h2>
        <p className="text-sm font-medium text-accent mb-1">{processingStatus}</p>
        <p className="text-muted-foreground mb-4">Each image takes 15–30 seconds</p>
        <div className="w-64">
          <Progress value={pct} />
        </div>
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-5 gap-2 max-w-md">
          {batchResults.map((r, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img src={r.beforeUrl} alt={r.label} className="h-full w-full object-cover opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center">
                {r.status === "completed" ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : r.status === "failed" ? (
                  <AlertCircle className="h-6 w-6 text-destructive" />
                ) : null}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-background/70 px-1 py-0.5 text-center">
                <span className="text-[9px] text-foreground truncate block">
                  {i === 0 ? "Master" : r.label || `#${i + 1}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // === RESULTS STEP ===
  const completedResults = batchResults.filter((r) => r.status === "completed");
  const failedCount = batchResults.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Batch Results</h2>
          <p className="text-sm text-muted-foreground">
            {completedResults.length} completed{failedCount > 0 ? ` · ${failedCount} failed` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {completedResults.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleDownloadAll}>
              <Download className="mr-2 h-4 w-4" /> Download All
            </Button>
          )}
          <Button size="sm" onClick={onComplete}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {batchResults.map((r, i) => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="aspect-square overflow-hidden relative">
              {r.status === "completed" && r.afterUrl ? (
                <img src={r.afterUrl} alt={r.label} className="h-full w-full object-cover" />
              ) : r.status === "failed" ? (
                <div className="h-full w-full bg-destructive/5 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive/50" />
                </div>
              ) : (
                <img src={r.beforeUrl} alt={r.label} className="h-full w-full object-cover opacity-50" />
              )}
              {r.status === "completed" && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="h-5 w-5 text-green-500 drop-shadow-md" />
                </div>
              )}
              {i === 0 && r.status === "completed" && (
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Master</Badge>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-card-foreground">{r.label || `Image ${i + 1}`}</p>
              <p className="text-xs text-muted-foreground capitalize">{r.status}</p>
              {r.status === "completed" && r.afterUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 w-full text-xs"
                  onClick={() => setExportImage({ url: r.afterUrl, name: r.label || `batch-${i + 1}` })}
                >
                  <Download className="mr-1 h-3 w-3" /> Download
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {exportImage && (
        <ExportModal
          open={!!exportImage}
          onClose={() => setExportImage(null)}
          imageUrl={exportImage.url}
          imageName={exportImage.name}
        />
      )}
    </div>
  );
}
