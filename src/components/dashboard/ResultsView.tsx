import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, ArrowLeft, Pencil, ArrowUpCircle } from "lucide-react";
import BeforeAfterSlider from "./BeforeAfterSlider";
import ExportModal from "./ExportModal";
import ImageEditPanel from "./ImageEditPanel";
import UpscaleModal from "./UpscaleModal";

interface ResultsViewProps {
  beforeUrl: string;
  afterUrl: string;
  creditsRemaining: number;
  onTryAnother: () => void;
  onBackToDashboard: () => void;
  jobId?: string;
  originalImageId?: string;
  onCreditsChange?: (credits: number) => void;
}

export default function ResultsView({
  beforeUrl,
  afterUrl,
  creditsRemaining,
  onTryAnother,
  onBackToDashboard,
  jobId,
  originalImageId,
  onCreditsChange,
}: ResultsViewProps) {
  const [showExport, setShowExport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showUpscale, setShowUpscale] = useState(false);
  const [currentAfterUrl, setCurrentAfterUrl] = useState(afterUrl);
  const [credits, setCredits] = useState(creditsRemaining);
  const [upscaleLabel, setUpscaleLabel] = useState<string | null>(null);

  const handleCreditsChange = (c: number) => {
    setCredits(c);
    onCreditsChange?.(c);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        <Badge variant="outline" className="px-3 py-1 text-sm">
          {credits} credits remaining
        </Badge>
      </div>

      <h2 className="text-xl font-bold text-foreground mb-4">Your Staged Result</h2>

      <BeforeAfterSlider beforeSrc={beforeUrl} afterSrc={currentAfterUrl} />

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          onClick={() => setShowExport(true)}
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 min-w-[120px]"
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
        {jobId && originalImageId && (
          <Button
            variant={showEdit ? "secondary" : "outline"}
            onClick={() => setShowEdit(!showEdit)}
            className="flex-1 min-w-[100px]"
          >
            <Pencil className="mr-2 h-4 w-4" />
            {showEdit ? "Hide Editor" : "Edit"}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => setShowUpscale(true)}
          className="flex-1 min-w-[100px]"
        >
          <ArrowUpCircle className="mr-2 h-4 w-4" />
          Upscale
          {upscaleLabel && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{upscaleLabel}</Badge>
          )}
        </Button>
        <Button variant="outline" onClick={onTryAnother}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Another
        </Button>
      </div>

      {/* Edit Panel */}
      {showEdit && jobId && originalImageId && (
        <div className="mt-6 p-4 rounded-xl border border-border bg-card">
          <ImageEditPanel
            jobId={jobId}
            originalImageId={originalImageId}
            currentImageUrl={currentAfterUrl}
            creditsRemaining={credits}
            onCreditsChange={handleCreditsChange}
            onImageChange={setCurrentAfterUrl}
          />
        </div>
      )}

      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        imageUrl={currentAfterUrl}
        imageName={`furnistudio-staged-${Date.now()}`}
      />

      <UpscaleModal
        open={showUpscale}
        onClose={() => setShowUpscale(false)}
        imageUrl={currentAfterUrl}
        imagePath={currentAfterUrl}
        creditsRemaining={credits}
        onCreditsChange={handleCreditsChange}
      />
    </div>
  );
}
