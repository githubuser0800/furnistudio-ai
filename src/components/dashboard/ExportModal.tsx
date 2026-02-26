import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Download, Check } from "lucide-react";

const PRESETS = [
  { id: "amazon", name: "Amazon UK", res: "2000×2000", format: "JPEG 85%", desc: "White background, product fills 85%" },
  { id: "ebay", name: "eBay UK", res: "1600×1600", format: "JPEG 90%", desc: "Clean white background" },
  { id: "etsy", name: "Etsy", res: "2000×2000", format: "PNG", desc: "Transparency support" },
  { id: "wayfair", name: "Wayfair", res: "2000×2000", format: "JPEG HQ", desc: "300 DPI high quality" },
  { id: "social", name: "Social Media", res: "1080×1080", format: "JPEG 90%", desc: "Instagram/Facebook ready" },
  { id: "print", name: "Print Ready", res: "4096×4096", format: "PNG", desc: "Maximum quality" },
];

const RESOLUTIONS = ["Original", "4K (4096px)", "2K (2048px)", "1K (1024px)"];
const FORMATS = ["JPEG", "PNG", "WebP"];
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3"];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
}

export default function ExportModal({ open, onClose, imageUrl, imageName }: ExportModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [jpegQuality, setJpegQuality] = useState(90);
  const [customFormat, setCustomFormat] = useState("JPEG");
  const [customRes, setCustomRes] = useState("Original");
  const [customAspect, setCustomAspect] = useState("1:1");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const ext = selectedPreset
        ? PRESETS.find((p) => p.id === selectedPreset)?.format.includes("PNG") ? "png" : "jpg"
        : customFormat === "PNG" ? "png" : customFormat === "WebP" ? "webp" : "jpg";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${imageName.replace(/\.[^.]+$/, "")}-export.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(imageUrl, "_blank");
    }
    setDownloading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-card-foreground">Export Options</DialogTitle>
          <p className="text-sm text-muted-foreground">Choose a marketplace preset or customise</p>
        </DialogHeader>

        {/* Marketplace Presets */}
        <div className="mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Marketplace Presets</h3>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPreset(selectedPreset === p.id ? null : p.id)}
                className={`rounded-lg border-2 p-3 text-left transition-all ${
                  selectedPreset === p.id
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-card-foreground">{p.name}</p>
                  {selectedPreset === p.id && (
                    <div className="h-4 w-4 rounded-full bg-accent flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-accent-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{p.res} · {p.format}</p>
                <p className="text-[10px] text-muted-foreground">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Export */}
        {!selectedPreset && (
          <div className="mt-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Export</h3>
            
            <div>
              <p className="text-sm font-medium text-card-foreground mb-2">Resolution</p>
              <div className="flex flex-wrap gap-2">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setCustomRes(r)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-all ${
                      customRes === r ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-card-foreground mb-2">Format</p>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setCustomFormat(f)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-all ${
                      customFormat === f ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {customFormat === "JPEG" && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Quality</span>
                    <span>{jpegQuality}%</span>
                  </div>
                  <Slider
                    value={[jpegQuality]}
                    onValueChange={(v) => setJpegQuality(v[0])}
                    min={70}
                    max={100}
                    step={5}
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-card-foreground mb-2">Aspect Ratio</p>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setCustomAspect(a)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-all ${
                      customAspect === a ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Download button */}
        <div className="mt-5 pt-4 border-t border-border">
          <Button onClick={handleDownload} disabled={downloading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Downloading..." : "Download"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
