import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowUpCircle, Sparkles, Download } from "lucide-react";
import BeforeAfterSlider from "./BeforeAfterSlider";

interface UpscaleModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  imagePath: string; // storage path
  creditsRemaining: number;
  onCreditsChange: (credits: number) => void;
}

export default function UpscaleModal({
  open,
  onClose,
  imageUrl,
  imagePath,
  creditsRemaining,
  onCreditsChange,
}: UpscaleModalProps) {
  const [scale, setScale] = useState<"2x" | "4x">("2x");
  const [sharpen, setSharpen] = useState(true);
  const [reduceNoise, setReduceNoise] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; label: string } | null>(null);
  const { toast } = useToast();

  const creditCost = scale === "4x" ? 1 : 0.5;
  const resLabel = scale === "4x" ? "16K (16384px)" : "8K (8192px)";
  const hasEnough = creditsRemaining >= (scale === "4x" ? 1 : 1);

  const handleUpscale = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("upscale-image", {
        body: {
          image_path: imagePath,
          scale,
          sharpen,
          reduce_noise: reduceNoise,
        },
      });

      if (error) throw new Error(error.message || "Upscale failed");
      if (data?.error) throw new Error(data.error);

      if (data?.success && data.output_url) {
        setResult({ url: data.output_url, label: data.scale_label });
        onCreditsChange(data.credits_remaining);
        toast({ title: "Image upscaled!", description: `Enhanced to ${data.scale_label} resolution` });
      }
    } catch (err: any) {
      toast({ title: "Upscale failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    try {
      const resp = await fetch(result.url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `upscaled-${result.label}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(result.url, "_blank");
    }
  };

  const handleClose = () => {
    setResult(null);
    setScale("2x");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-accent" />
            Enhance Image Quality
          </DialogTitle>
          <DialogDescription>
            Upscale your image to a higher resolution with AI enhancement.
          </DialogDescription>
        </DialogHeader>

        {/* Result view */}
        {result ? (
          <div className="space-y-4">
            <BeforeAfterSlider
              beforeSrc={imageUrl}
              afterSrc={result.url}
              beforeLabel="Original (4K)"
              afterLabel={`Upscaled (${result.label})`}
            />
            <div className="flex gap-3">
              <Button onClick={handleDownload} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
                <Download className="mr-2 h-4 w-4" />
                Download Upscaled
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Scale options */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Upscale Level</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setScale("2x")}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    scale === "2x"
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="text-sm font-bold text-foreground">2x Upscale</div>
                  <div className="text-xs text-muted-foreground mt-0.5">4K → 8K (8192px)</div>
                  <Badge variant="outline" className="mt-2 text-[10px]">0.5 credits</Badge>
                </button>
                <button
                  onClick={() => setScale("4x")}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    scale === "4x"
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="text-sm font-bold text-foreground">4x Upscale</div>
                  <div className="text-xs text-muted-foreground mt-0.5">4K → 16K (16384px)</div>
                  <Badge variant="outline" className="mt-2 text-[10px]">1 credit</Badge>
                </button>
              </div>
            </div>

            {/* Enhancement options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Enhancement Options</Label>
              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox checked={sharpen} onCheckedChange={(c) => setSharpen(!!c)} />
                  <div>
                    <span className="text-sm text-foreground">Sharpen details</span>
                    <p className="text-xs text-muted-foreground">Enhance fabric texture, wood grain, stitching</p>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox checked={reduceNoise} onCheckedChange={(c) => setReduceNoise(!!c)} />
                  <div>
                    <span className="text-sm text-foreground">Reduce noise</span>
                    <p className="text-xs text-muted-foreground">Clean up any grain or artifacts</p>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 cursor-not-allowed opacity-40">
                  <Checkbox checked={false} disabled />
                  <div>
                    <span className="text-sm text-foreground">Enhance faces</span>
                    <p className="text-xs text-muted-foreground">Not relevant for furniture</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Cost & action */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Cost: <span className="font-semibold text-foreground">{creditCost} credit{creditCost > 1 ? "s" : ""}</span>
                <span className="mx-1.5">·</span>
                <span>{creditsRemaining} remaining</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleUpscale}
                disabled={processing || !hasEnough}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {processing ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Enhancing...
                  </>
                ) : !hasEnough ? (
                  "Not enough credits"
                ) : (
                  <>
                    <ArrowUpCircle className="mr-2 h-4 w-4" />
                    Upscale Now
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
