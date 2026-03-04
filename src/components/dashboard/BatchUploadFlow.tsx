import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  X,
  Plus,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Download,
  Check,
  FolderPlus,
  Pencil,
  Clock,
  Save,
  LayoutGrid,
  RotateCcw,
  Bug,
  Copy,
  ChevronDown,
} from "lucide-react";
import StyleSelectionModal from "./StyleSelectionModal";
import ExportModal from "./ExportModal";
import ShotPickerGrid from "./ShotPickerGrid";
import ShotLightbox from "./ShotLightbox";
import { SEATING_SHOT_LIST, type SeatingShot } from "@/constants/seatingShots";
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

const TEMPLATE_NAMES: Record<string, string> = {
  scandinavian: "Scandinavian", contemporary_grey: "Contemporary Grey", cozy_british: "Cozy British",
  luxury_penthouse: "Luxury Penthouse", minimalist_white: "Minimalist White", serene_bedroom: "Serene Bedroom",
  boutique_hotel: "Boutique Hotel", light_airy: "Light & Airy", modern_dining: "Modern Dining",
  rustic_farmhouse: "Rustic Farmhouse", modern_office: "Home Office", creative_studio: "Creative Studio",
  white_background: "White Background", grey_studio: "Grey Studio", showroom_floor: "Showroom Floor", custom: "Custom",
};

const SHOT_BACKEND_LABELS: Record<SeatingShot["id"], string> = {
  hero: "3/4 Angle",
  front: "Full Product",
  side: "Side View",
  rear: "Back View",
  topdown: "Top View",
  fabric: "Close-up: Fabric",
  stitching: "Close-up: Detail",
  leg: "Close-up: Detail",
  lifestyle: "Lifestyle",
};

const SHOT_PROMPT_SUFFIX: Partial<Record<SeatingShot["id"], string>> = {
  leg: "Focus on the leg and foot detail",
};

interface StagedFile {
  file: File;
  preview: string;
  label: string;
  imageId?: string;
  uploaded: boolean;
  detectedLabel?: string;
}

interface ShotDebugInfo {
  final_prompt: string;
  model_used: string;
  num_reference_images: number;
  product_analysis_included: boolean;
  product_analysis_length: number;
  product_analysis_preview: string | null;
  label: string | null;
  camera_angle: string | null;
  master_background_used: boolean;
  master_background_path: string | null;
  prompt_path: string;
  custom_prompt_included: boolean;
  custom_prompt_value: string | null;
  total_parts_count: number;
  image_parts_count: number;
  text_parts_count: number;
  generation_time_ms: number;
  gemini_finish_reason: string;
  gemini_safety_ratings: any[];
  gemini_token_count: { prompt: number; output: number; total: number };
  batch_index: number | null;
  batch_total: number | null;
}

interface BatchResult {
  imageId: string;
  label: string;
  beforeUrl: string;
  afterUrl: string;
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  shotId?: string;
  debug?: ShotDebugInfo;
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
  const [step, setStep] = useState<
    "upload" | "detect" | "shots" | "style" | "analysing" | "processing" | "results"
  >("upload");
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");
  const [exportImage, setExportImage] = useState<{ url: string; name: string } | null>(null);
  const [batchExportMode, setBatchExportMode] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedTemplateLabel, setSelectedTemplateLabel] = useState("");
  const [savingToFolder, setSavingToFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Shot list mode state
  const [shotListMode, setShotListMode] = useState(false);
  const [selectedShots, setSelectedShots] = useState<string[]>(["hero"]);

  // Batch context for retry
  const [batchContext, setBatchContext] = useState<{
    templateId: string;
    resolution: string;
    productAnalysis: string | null;
    masterBackgroundPath: string | null;
    allImageIds: string[];
    totalShots: number;
  } | null>(null);

  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);
  const [expandedDebug, setExpandedDebug] = useState<Set<string>>(new Set());

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Timer for processing step
  useEffect(() => {
    if (step !== "processing" || !startTime) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [step, startTime]);

  const estimatedSeconds = processingTotal * 25;
  const remainingSeconds = Math.max(0, estimatedSeconds - elapsed);
  const formatTime = (s: number) => s < 60 ? `~${s}s remaining` : `~${Math.ceil(s / 60)}m remaining`;

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    const maxFiles = 10;
    const newFiles = Array.from(fileList).slice(0, maxFiles - files.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      label: "Full Product",
      uploaded: false,
    }));
    setFiles((prev) => [...prev, ...newFiles].slice(0, maxFiles));
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

    if (shotListMode) {
      // In shot list mode, skip detection → go to shot picker
      setStep("shots");
      return;
    }

    // Smart shot detection for normal batch mode
    const uploadedIds = updated.filter((f) => f.uploaded && f.imageId).map((f) => f.imageId!);
    if (uploadedIds.length > 0) {
      setStep("detect");
      setDetecting(true);
      try {
        const { data } = await supabase.functions.invoke("detect-shot-type", {
          body: { image_ids: uploadedIds },
        });
        if (data?.success && data.detections) {
          const detected = data.detections as Array<{ image_id: string; detected_type: string; confidence: string }>;
          const detectedFiles = updated.map((f) => {
            const det = detected.find((d) => d.image_id === f.imageId);
            if (det) return { ...f, label: det.detected_type, detectedLabel: det.detected_type };
            return f;
          });
          setFiles(detectedFiles);
        }
      } catch (err) {
        console.error("Shot detection failed:", err);
      }
      setDetecting(false);
    } else {
      setStep("style");
      setShowStyleModal(true);
    }
  };

  // Shot-list-aware generation: generates selected seating shots using one master batch flow
  const handleShotListGenerate = async (
    templateId: string,
    resolution: string,
    customPrompt?: string,
    aspectRatio?: string,
  ) => {
    setShowStyleModal(false);

    const sourceFile = files.find((f) => f.uploaded && f.imageId);
    if (!sourceFile) return;

    const allImageIds = files
      .filter((f) => f.uploaded && f.imageId)
      .map((f) => f.imageId!);

    // ── Phase 1: Analyse product ──
    setStep("analysing");
    setProcessingStatus("Analysing your product...");
    let productAnalysis: string | null = null;

    try {
      console.log("[ShotList] Phase 1: Analysing product with", allImageIds.length, "images");
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        "analyse-product",
        { body: { image_ids: allImageIds } }
      );

      if (analysisError || !analysisData?.success) {
        console.warn("[ShotList] Product analysis failed, continuing without it:", analysisError || analysisData?.error);
      } else {
        productAnalysis = analysisData.product_analysis;
        console.log("[ShotList] Product analysis complete:", productAnalysis?.substring(0, 200));
      }
    } catch (err) {
      console.warn("[ShotList] Product analysis call failed:", err);
    }

    // ── Phase 2: Generate shots ──
    setStep("processing");
    setStartTime(Date.now());
    setElapsed(0);
    setSelectedTemplateLabel(TEMPLATE_NAMES[templateId] || "Custom");

    const selectedShotItems = SEATING_SHOT_LIST.filter((s) => selectedShots.includes(s.id));
    // Hero MUST always be index 0 (master shot). Then room shots sorted by number, then close-ups last.
    const shots = [...selectedShotItems].sort((a, b) => {
      if (a.id === "hero") return -1;
      if (b.id === "hero") return 1;
      // Close-ups go after all room shots
      const aIsCloseUp = a.group === "Close-Ups";
      const bIsCloseUp = b.group === "Close-Ups";
      if (aIsCloseUp && !bIsCloseUp) return 1;
      if (!aIsCloseUp && bIsCloseUp) return -1;
      return a.number - b.number;
    });

    if (shots.length === 0) return;

    setProcessingTotal(shots.length);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const setName = `Shot List — ${TEMPLATE_NAMES[templateId] || "Custom"} - ${new Date().toLocaleDateString("en-GB")}`;
    const { data: setRecord } = await supabase
      .from("product_sets" as any)
      .insert({
        user_id: user.id,
        name: setName,
        template_id: templateId,
        resolution,
        image_count: shots.length,
      } as any)
      .select()
      .single();

    const setId = (setRecord as any)?.id;
    const results: BatchResult[] = [];
    let currentCredits = creditsRemaining;
    let masterBackgroundPath: string | null = null;

    // Store batch context for retry
    setBatchContext({
      templateId,
      resolution,
      productAnalysis: productAnalysis,
      masterBackgroundPath: null, // will be updated after shot 1
      allImageIds,
      totalShots: shots.length,
    });

    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const backendLabel = SHOT_BACKEND_LABELS[shot.id] || shot.label;

      setProcessingIndex(i + 1);
      if (i === 0) {
        setProcessingStatus(`Creating master room shot — ${shot.label}`);
      } else {
        setProcessingStatus(`Shot ${i + 1} of ${shots.length} — ${shot.label}`);
      }

      try {
        const isCloseUp = shot.group === "Close-Ups";

        // Room shots (not close-ups) after shot 1 need the master background
        if (i > 0 && !isCloseUp && !masterBackgroundPath) {
          throw new Error("Missing master_background_path from shot 1 response");
        }

        const shotPrompt = [
          shot.promptHint,
          SHOT_PROMPT_SUFFIX[shot.id],
          customPrompt,
        ]
          .filter(Boolean)
          .join(". ");

        const additionalIds = allImageIds.filter((id) => id !== sourceFile.imageId);

        const payload = {
          image_id: sourceFile.imageId,
          reference_image_ids: allImageIds,
          additional_image_ids: additionalIds,
          ...(productAnalysis ? { product_analysis: productAnalysis } : {}),
          template_id: templateId,
          resolution,
          custom_prompt: shotPrompt,
          ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
          camera_angle: shot.cameraAngle,
          ...(setId ? { set_id: setId } : {}),
          label: backendLabel,
          batch_index: isCloseUp ? 0 : i, // Close-ups are independent (index 0)
          batch_total: shots.length,
          // Close-ups: independent generation, no master background
          ...(isCloseUp
            ? { generation_strategy: "closeup" }
            : i > 0 && masterBackgroundPath
              ? { master_background_path: masterBackgroundPath }
              : {}),
        };

        console.log(
          `[ShotList] generate-staging payload ${i + 1}/${shots.length} (${shot.label})`,
          payload
        );

        const { data, error } = await supabase.functions.invoke("generate-staging", {
          body: payload,
        });

        if (error || data?.error) {
          results.push({
            imageId: sourceFile.imageId!,
            label: shot.label,
            beforeUrl: sourceFile.preview,
            afterUrl: "",
            jobId: "",
            status: "failed",
            shotId: shot.id,
          });
        } else if (data?.success) {
          currentCredits = data.credits_remaining;
          onCreditsChange(currentCredits);

          if (i === 0) {
            masterBackgroundPath = data.master_background_path || data.output_path || null;
            setBatchContext((prev) => prev ? { ...prev, masterBackgroundPath } : prev);
          }

          results.push({
            imageId: sourceFile.imageId!,
            label: shot.label,
            beforeUrl: sourceFile.preview,
            afterUrl: data.output_url,
            jobId: data.job_id,
            status: "completed",
            shotId: shot.id,
            debug: data.debug || undefined,
          });
        }
      } catch {
        results.push({
          imageId: sourceFile.imageId!,
          label: shot.label,
          beforeUrl: sourceFile.preview,
          afterUrl: "",
          jobId: "",
          status: "failed",
          shotId: shot.id,
        });
      }

      setBatchResults([...results]);
    }

    setStep("results");
    toast({
      title: "Shot list complete",
      description: `${results.filter((r) => r.status === "completed").length} of ${shots.length} shots generated.`,
    });
  };

  const handleRetryShot = async (result: BatchResult) => {
    if (!result.shotId) return;
    const shot = SEATING_SHOT_LIST.find((s) => s.id === result.shotId);
    if (!shot) return;

    // Update status to processing
    setBatchResults((prev) =>
      prev.map((r) => (r.shotId === result.shotId ? { ...r, status: "processing" as const } : r))
    );

    const sourceFile = files.find((f) => f.uploaded && f.imageId);
    if (!sourceFile) return;
    const allImageIds = batchContext?.allImageIds || files.filter((f) => f.uploaded && f.imageId).map((f) => f.imageId!);
    const additionalIds = allImageIds.filter((id) => id !== sourceFile.imageId);
    const backendLabel = SHOT_BACKEND_LABELS[shot.id] || shot.label;

    // Determine batch index from current results
    const shotIndex = batchResults.findIndex((r) => r.shotId === result.shotId);
    const isHero = shot.id === "hero";
    const isCloseUp = shot.group === "Close-Ups";

    try {
      const shotPrompt = [shot.promptHint, SHOT_PROMPT_SUFFIX[shot.id]].filter(Boolean).join(". ");
      const payload = {
        image_id: sourceFile.imageId,
        reference_image_ids: allImageIds,
        additional_image_ids: additionalIds,
        ...(batchContext?.productAnalysis ? { product_analysis: batchContext.productAnalysis } : {}),
        template_id: batchContext?.templateId || "scandinavian",
        resolution: batchContext?.resolution || "4k",
        custom_prompt: shotPrompt,
        camera_angle: shot.cameraAngle,
        label: backendLabel,
        batch_index: isCloseUp ? 0 : (shotIndex >= 0 ? shotIndex : 0),
        batch_total: batchContext?.totalShots || batchResults.length,
        // Close-ups: independent generation, no master background
        ...(isCloseUp
          ? { generation_strategy: "closeup" }
          : !isHero && batchContext?.masterBackgroundPath
            ? { master_background_path: batchContext.masterBackgroundPath }
            : {}),
      };

      console.log(`[ShotList] Retry "${shot.label}" payload:`, payload);

      const { data, error } = await supabase.functions.invoke("generate-staging", {
        body: payload,
      });

      if (error || data?.error) {
        setBatchResults((prev) =>
          prev.map((r) => (r.shotId === result.shotId ? { ...r, status: "failed" as const } : r))
        );
      } else if (data?.success) {
        onCreditsChange(data.credits_remaining);
        setBatchResults((prev) =>
          prev.map((r) =>
            r.shotId === result.shotId
              ? { ...r, status: "completed" as const, afterUrl: data.output_url, jobId: data.job_id, debug: data.debug || undefined }
              : r
          )
        );
      }
    } catch {
      setBatchResults((prev) =>
        prev.map((r) => (r.shotId === result.shotId ? { ...r, status: "failed" as const } : r))
      );
    }
  };

  const handleBatchGenerate = async (
    templateId: string,
    resolution: string,
    customPrompt?: string,
    aspectRatio?: string,
    cameraAngle?: string,
  ) => {
    // If in shot list mode, use the shot-list-aware generator
    if (shotListMode) {
      handleShotListGenerate(templateId, resolution, customPrompt, aspectRatio);
      return;
    }

    setShowStyleModal(false);
    setStep("processing");
    setStartTime(Date.now());
    setElapsed(0);
    setSelectedTemplateLabel(TEMPLATE_NAMES[templateId] || "Custom");

    const uploadedFiles = files.filter((f) => f.uploaded && f.imageId);
    setProcessingTotal(uploadedFiles.length);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const setName = `${TEMPLATE_NAMES[templateId] || "Custom"} - ${new Date().toLocaleDateString("en-GB")}`;

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
      const viewLabel = f.label || `image ${i + 1}`;

      if (i === 0) {
        setProcessingStatus(`Creating room environment...`);
      } else {
        setProcessingStatus(`Image ${i + 1} of ${uploadedFiles.length} — ${viewLabel}`);
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
            ...(i > 0 && masterBackgroundPath ? { master_background_path: masterBackgroundPath } : {}),
          },
        });

        if (error || data?.error) {
          results.push({ imageId: f.imageId!, label: f.label, beforeUrl: f.preview, afterUrl: "", jobId: "", status: "failed", debug: data?.debug || undefined });
        } else if (data?.success) {
          currentCredits = data.credits_remaining;
          onCreditsChange(currentCredits);
          if (i === 0 && data.master_background_path) masterBackgroundPath = data.master_background_path;
          results.push({ imageId: f.imageId!, label: f.label, beforeUrl: f.preview, afterUrl: data.output_url, jobId: data.job_id, status: "completed", debug: data.debug || undefined });
        }
      } catch {
        results.push({ imageId: f.imageId!, label: f.label, beforeUrl: f.preview, afterUrl: "", jobId: "", status: "failed" });
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
      } catch { /* skip */ }
    }
  };

  const handleQuickDownload = async (r: BatchResult) => {
    try {
      const resp = await fetch(r.afterUrl);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${r.label || "staged"}-4K.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(r.afterUrl, "_blank");
    }
  };

  const handleSaveToFolder = async () => {
    setSavingToFolder(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingToFolder(false); return; }

    const folderName = `${selectedTemplateLabel} - ${new Date().toLocaleDateString("en-GB")}`;
    const { data: folder } = await (supabase as any).from("folders").insert({
      user_id: user.id,
      name: folderName,
      color: "#6366f1",
    }).select().single();

    if (folder) {
      const imageIds = files.filter((f) => f.uploaded && f.imageId).map((f) => f.imageId!);
      const jobIds = batchResults.filter((r) => r.status === "completed" && r.jobId).map((r) => r.jobId);
      await Promise.all([
        imageIds.length > 0 ? (supabase as any).from("images").update({ folder_id: folder.id }).in("id", imageIds) : Promise.resolve(),
        jobIds.length > 0 ? (supabase as any).from("jobs").update({ folder_id: folder.id }).in("id", jobIds) : Promise.resolve(),
      ]);
      toast({ title: "Saved to folder", description: `Created "${folderName}" in your library` });
    }
    setSavingToFolder(false);
  };

  // ========================
  // STEP 1: UPLOAD
  // ========================
  if (step === "upload") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">
            {shotListMode ? "Upload your product photos" : "Drop your product images here"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {shotListMode
              ? "Upload up to 10 images · AI uses all as product references for every shot"
              : "Upload up to 10 images · Auto-detects shot types"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex justify-center gap-2">
          <Button
            variant={shotListMode ? "outline" : "default"}
            size="sm"
            onClick={() => {
              setShotListMode(false);
              setFiles([]);
            }}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Multi-Image Batch
          </Button>
          <Button
            variant={shotListMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShotListMode(true);
              setFiles((prev) => prev.slice(0, 10));
            }}
          >
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> Seating Shot List
          </Button>
        </div>

        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-10 hover:border-accent/50 transition-colors"
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
          <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Click to browse or drag & drop</p>
          <p className="text-xs text-muted-foreground mt-1">
            {shotListMode ? "JPG, PNG, WebP · up to 10 reference images" : "JPG, PNG, WebP · up to 10 images"}
          </p>
        </div>

        {files.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="px-3 py-1">
                {shotListMode ? `${files.length}/10 references` : `${files.length}/10 images`}
              </Badge>
            </div>
            <div className={`grid gap-3 ${shotListMode ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-5"}`}>
              {files.map((f, i) => (
                <div key={`${f.file.name}-${f.file.size}-${f.file.lastModified}`} className="relative rounded-xl border border-border bg-card overflow-hidden">
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
                    <p className="text-[10px] text-muted-foreground truncate">{f.file.name}</p>
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
          </>
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
          <div className="flex justify-end">
            <Button
              onClick={handleUploadAll}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Upload className="mr-2 h-4 w-4" />
              {shotListMode ? "Upload & Choose Shots" : `Upload ${files.length} image${files.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ========================
  // STEP: SHOT PICKER (shot list mode only)
  // ========================
  if (step === "shots") {
    return (
      <ShotPickerGrid
        selected={selectedShots}
        onChange={setSelectedShots}
        onConfirm={() => {
          setStep("style");
          setShowStyleModal(true);
        }}
        onBack={() => setStep("upload")}
        creditsRemaining={creditsRemaining}
      />
    );
  }

  // ========================
  // STEP 2: CONFIRM SHOT TYPES
  // ========================
  if (step === "detect") {
    const uploadedFiles = files.filter((f) => f.uploaded && f.imageId);
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">
            {detecting ? "Detecting shot types..." : "Check shot types are correct:"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {detecting ? "AI is analyzing your images" : "Click a label to change it"}
          </p>
        </div>

        {detecting && (
          <div className="flex justify-center py-8">
            <div className="h-12 w-12 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
          </div>
        )}

        {!detecting && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {uploadedFiles.map((f) => (
                <div key={f.imageId || `${f.file.name}-${f.file.size}`} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="aspect-square overflow-hidden relative">
                    <img src={f.preview} alt={f.file.name} className="h-full w-full object-cover" />
                    {f.detectedLabel && f.label === f.detectedLabel && (
                      <div className="absolute top-1.5 right-1.5">
                        <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                          <Check className="h-3 w-3 text-accent-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <Select value={f.label} onValueChange={(val) => updateLabel(files.indexOf(f), val)}>
                      <SelectTrigger className="text-xs h-7">
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
                    {f.detectedLabel && f.label !== f.detectedLabel && (
                      <button
                        onClick={() => updateLabel(files.indexOf(f), f.detectedLabel!)}
                        className="mt-1 text-[10px] text-accent hover:underline"
                      >
                        Reset: {f.detectedLabel}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button
                onClick={() => { setStep("style"); setShowStyleModal(true); }}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Continue
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ========================
  // STEP 3: CHOOSE STYLE
  // ========================
  if (step === "style") {
    const readyCount = shotListMode ? selectedShots.length : files.filter((f) => f.uploaded).length;
    return (
      <div className="space-y-6">
        <div className="text-center py-6">
          <Sparkles className="h-10 w-10 text-accent mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground">Choose a style</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {shotListMode
              ? `${readyCount} shots selected from shot list`
              : `${readyCount} images ready`}
          </p>
          <Button className="mt-4 bg-accent text-accent-foreground" onClick={() => setShowStyleModal(true)}>
            Open Style Selection
          </Button>
        </div>
        <StyleSelectionModal
          open={showStyleModal}
          onClose={() => { setShowStyleModal(false); setStep(shotListMode ? "shots" : "detect"); }}
          onGenerate={(templateId, resolution, customPrompt, aspectRatio, cameraAngle) => {
            handleBatchGenerate(templateId, resolution, customPrompt, aspectRatio, cameraAngle);
          }}
          creditsRemaining={creditsRemaining}
          loading={false}
          imageName={shotListMode ? `${readyCount} shots (shot list)` : `${readyCount} images (batch)`}
        />
      </div>
    );
  }

  // ========================
  // STEP 4b: ANALYSING PRODUCT
  // ========================
  if (step === "analysing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-1">Analysing your product…</h3>
          <p className="text-sm text-muted-foreground">
            Studying all {files.filter(f => f.uploaded).length} uploaded images to understand every detail
          </p>
        </div>
      </div>
    );
  }

  // ========================
  // STEP 5: PROGRESS
  // ========================
  if (step === "processing") {
    const pct = processingTotal > 0 ? (processingIndex / processingTotal) * 100 : 0;
    const progressItems = shotListMode
      ? SEATING_SHOT_LIST.filter((s) => selectedShots.includes(s.id))
      : files.filter((f) => f.uploaded);

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-accent" />
        </div>

        <h2 className="text-lg font-bold text-foreground mb-1">
          {shotListMode ? "Generating shot list..." : "Creating product set..."}
        </h2>
        <p className="text-sm font-medium text-accent mb-1">{processingStatus}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> {formatTime(remainingSeconds)}
        </p>

        <div className="w-72 mt-4">
          <Progress value={pct} />
          <p className="text-xs text-muted-foreground mt-1.5">
            {shotListMode ? `Shot ${processingIndex} of ${processingTotal}` : `Image ${processingIndex} of ${processingTotal}`}
          </p>
        </div>

        {/* Thumbnails / shot cards appearing as completed */}
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-5 gap-2 max-w-md">
          {shotListMode
            ? progressItems.map((item, i) => {
                const shot = item as SeatingShot;
                const result = batchResults.find((r) => r.shotId === shot.id);
                return (
                  <div key={shot.id} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-card flex items-center justify-center">
                    {result?.status === "completed" && result.afterUrl ? (
                      <img src={result.afterUrl} alt={shot.label} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center p-1">
                        <Badge variant="outline" className="text-[8px] px-1">{shot.number}</Badge>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {result?.status === "completed" && <CheckCircle className="h-5 w-5 text-accent drop-shadow-md" />}
                      {result?.status === "failed" && <AlertCircle className="h-5 w-5 text-destructive" />}
                      {!result && i < processingIndex && (
                        <div className="h-5 w-5 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-background/70 px-1 py-0.5 text-center">
                      <span className="text-[8px] text-foreground truncate block">{shot.label.split("—")[0].trim()}</span>
                    </div>
                  </div>
                );
              })
            : (progressItems as StagedFile[]).map((f, i) => {
                const result = batchResults[i];
                return (
                  <div key={f.imageId || `${f.file.name}-${f.file.size}`} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    {result?.status === "completed" && result.afterUrl ? (
                      <img src={result.afterUrl} alt={f.label} className="h-full w-full object-cover" />
                    ) : (
                      <img src={f.preview} alt={f.label} className="h-full w-full object-cover opacity-40" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {result?.status === "completed" && <CheckCircle className="h-5 w-5 text-accent drop-shadow-md" />}
                      {result?.status === "failed" && <AlertCircle className="h-5 w-5 text-destructive" />}
                      {!result && i < processingIndex && (
                        <div className="h-5 w-5 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-background/70 px-1 py-0.5 text-center">
                      <span className="text-[9px] text-foreground truncate block">{f.label}</span>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
    );
  }

  // ========================
  // STEP 6: RESULTS
  // ========================
  const completedResults = batchResults.filter((r) => r.status === "completed");
  const failedCount = batchResults.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {completedResults.length} {shotListMode ? "shot" : "image"}{completedResults.length !== 1 ? "s" : ""} generated
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedTemplateLabel}{failedCount > 0 ? ` · ${failedCount} failed` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {completedResults.length > 1 && (
            <>
              <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                <Download className="mr-1.5 h-4 w-4" /> Download All
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBatchExportMode(true)}>
                <Download className="mr-1.5 h-4 w-4" /> Export All...
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleSaveToFolder} disabled={savingToFolder}>
            <FolderPlus className="mr-1.5 h-4 w-4" /> {savingToFolder ? "Saving..." : "Save to Folder"}
          </Button>
          <Button
            variant={debugMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => setDebugMode(!debugMode)}
          >
            <Bug className="mr-1.5 h-4 w-4" /> {debugMode ? "Hide Debug" : "Debug"}
          </Button>
          {debugMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const allDebug = batchResults
                  .filter((r) => r.debug)
                  .map((r) => ({ shotId: r.shotId, label: r.label, status: r.status, debug: r.debug }));
                navigator.clipboard.writeText(JSON.stringify(allDebug, null, 2));
                toast({ title: "Copied", description: "All debug info copied to clipboard" });
              }}
            >
              <Copy className="mr-1.5 h-4 w-4" /> Copy All Debug
            </Button>
          )}
          <Button size="sm" onClick={onComplete}>Done</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {batchResults.map((r, idx) => (
          <div key={r.jobId || r.shotId || r.imageId + idx} className="rounded-xl border border-border bg-card overflow-hidden group">
            <div className="aspect-square overflow-hidden relative">
              {r.status === "completed" && r.afterUrl ? (
                <img
                  src={r.afterUrl}
                  alt={r.label}
                  className="h-full w-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                  onClick={() => {
                    const completedIndices = batchResults
                      .map((br, i) => br.status === "completed" && br.afterUrl ? i : -1)
                      .filter((i) => i >= 0);
                    const lightboxIdx = completedIndices.indexOf(idx);
                    if (lightboxIdx >= 0) {
                      setLightboxIndex(lightboxIdx);
                      setLightboxOpen(true);
                    }
                  }}
                />
              ) : r.status === "failed" ? (
                <div className="h-full w-full bg-destructive/5 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive/50" />
                </div>
              ) : r.status === "processing" ? (
                <div className="h-full w-full bg-accent/5 flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
                </div>
              ) : (
                <img src={r.beforeUrl} alt={r.label} className="h-full w-full object-cover opacity-50" />
              )}
              {r.status === "completed" && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="h-5 w-5 text-accent drop-shadow-md" />
                </div>
              )}
              {idx === 0 && r.status === "completed" && (
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    {shotListMode ? "Hero" : "Master"}
                  </Badge>
                </div>
              )}
              {shotListMode && r.shotId && (
                <div className="absolute top-2 left-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-background/80">
                    {SEATING_SHOT_LIST.find((s) => s.id === r.shotId)?.number}
                  </Badge>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-card-foreground">{r.label || `Image ${idx + 1}`}</p>
              {r.status === "completed" && r.afterUrl && (
                <div className="flex gap-1 mt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-xs h-8"
                    onClick={() => handleQuickDownload(r)}
                  >
                    <Download className="mr-1 h-3 w-3" /> 4K JPEG
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-xs h-8"
                    onClick={() => setExportImage({ url: r.afterUrl, name: r.label || `batch-${idx + 1}` })}
                  >
                    <Pencil className="mr-1 h-3 w-3" /> Export
                  </Button>
                </div>
              )}
              {r.status === "failed" && (
                <div className="mt-2">
                  <p className="text-xs text-destructive mb-1">Generation failed</p>
                  {shotListMode && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 w-full"
                      onClick={() => handleRetryShot(r)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Retry
                    </Button>
                  )}
                </div>
              )}
              {/* Debug info expandable */}
              {debugMode && r.debug && (
                <div className="mt-2 border-t border-border pt-2">
                  <button
                    onClick={() => {
                      const key = r.shotId || r.jobId || String(idx);
                      setExpandedDebug((prev) => {
                        const next = new Set(prev);
                        next.has(key) ? next.delete(key) : next.add(key);
                        return next;
                      });
                    }}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground w-full"
                  >
                    <Bug className="h-3 w-3" />
                    <span>Debug Info</span>
                    <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${expandedDebug.has(r.shotId || r.jobId || String(idx)) ? "rotate-180" : ""}`} />
                  </button>
                  {expandedDebug.has(r.shotId || r.jobId || String(idx)) && (
                    <div className="mt-1.5 space-y-1 text-[9px] font-mono text-muted-foreground max-h-60 overflow-y-auto">
                      <div><span className="text-foreground">Model:</span> {r.debug.model_used}</div>
                      <div><span className="text-foreground">Time:</span> {r.debug.generation_time_ms}ms</div>
                      <div><span className="text-foreground">Label:</span> {r.debug.label}</div>
                      <div><span className="text-foreground">Camera:</span> {r.debug.camera_angle}</div>
                      <div><span className="text-foreground">Prompt path:</span> {r.debug.prompt_path}</div>
                      <div><span className="text-foreground">Ref images:</span> {r.debug.num_reference_images}</div>
                      <div><span className="text-foreground">Parts:</span> {r.debug.total_parts_count} total ({r.debug.image_parts_count} img, {r.debug.text_parts_count} text)</div>
                      <div><span className="text-foreground">Analysis:</span> {r.debug.product_analysis_included ? `Yes (${r.debug.product_analysis_length} chars)` : "SKIPPED"}</div>
                      {r.debug.product_analysis_preview && (
                        <div className="break-words"><span className="text-foreground">Analysis preview:</span> {r.debug.product_analysis_preview}</div>
                      )}
                      <div><span className="text-foreground">Master BG:</span> {r.debug.master_background_used ? r.debug.master_background_path : "No"}</div>
                      <div><span className="text-foreground">Custom prompt:</span> {r.debug.custom_prompt_included ? "Yes" : "No"}</div>
                      {r.debug.custom_prompt_value && (
                        <div className="break-words"><span className="text-foreground">Custom prompt text:</span> {r.debug.custom_prompt_value.substring(0, 200)}...</div>
                      )}
                      <div><span className="text-foreground">Finish:</span> {r.debug.gemini_finish_reason}</div>
                      <div><span className="text-foreground">Tokens:</span> prompt={r.debug.gemini_token_count.prompt} output={r.debug.gemini_token_count.output}</div>
                      <div className="pt-1 border-t border-border">
                        <details>
                          <summary className="cursor-pointer text-foreground">Full prompt ({r.debug.final_prompt.length} chars)</summary>
                          <pre className="mt-1 whitespace-pre-wrap break-words text-[8px] max-h-40 overflow-y-auto bg-muted p-1.5 rounded">
                            {r.debug.final_prompt}
                          </pre>
                        </details>
                      </div>
                    </div>
                  )}
                </div>
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

      {batchExportMode && (
        <ExportModal
          open={batchExportMode}
          onClose={() => setBatchExportMode(false)}
          imageUrl=""
          imageName={selectedTemplateLabel || "batch"}
          batchUrls={completedResults.map((r) => ({ url: r.afterUrl, name: r.label || "image" }))}
        />
      )}

      <ShotLightbox
        images={batchResults
          .filter((r) => r.status === "completed" && r.afterUrl)
          .map((r) => ({ url: r.afterUrl, label: r.label || "Image" }))}
        currentIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
