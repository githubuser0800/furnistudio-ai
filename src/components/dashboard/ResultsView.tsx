import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, ArrowLeft } from "lucide-react";
import BeforeAfterSlider from "./BeforeAfterSlider";
import ExportModal from "./ExportModal";

interface ResultsViewProps {
  beforeUrl: string;
  afterUrl: string;
  creditsRemaining: number;
  onTryAnother: () => void;
  onBackToDashboard: () => void;
}

export default function ResultsView({
  beforeUrl,
  afterUrl,
  creditsRemaining,
  onTryAnother,
  onBackToDashboard,
}: ResultsViewProps) {
  const [showExport, setShowExport] = useState(false);

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
          {creditsRemaining} credits remaining
        </Badge>
      </div>

      <h2 className="text-xl font-bold text-foreground mb-4">Your Staged Result</h2>

      <BeforeAfterSlider beforeSrc={beforeUrl} afterSrc={afterUrl} />

      <div className="mt-6 flex gap-3">
        <Button
          onClick={() => setShowExport(true)}
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Download className="mr-2 h-4 w-4" />
          Download Image
        </Button>
        <Button variant="outline" onClick={onTryAnother} className="flex-1">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Another Style
        </Button>
      </div>

      <ExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        imageUrl={afterUrl}
        imageName={`furnistudio-staged-${Date.now()}`}
      />
    </div>
  );
}
