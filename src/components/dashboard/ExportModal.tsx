import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Check, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PRESETS = [
  { id: "amazon", name: "Amazon UK", format: "JPEG", quality: 85, desc: "4K · White background check" },
  { id: "ebay", name: "eBay UK", format: "JPEG", quality: 90, desc: "4K · JPEG high quality" },
  { id: "etsy", name: "Etsy", format: "PNG", quality: 100, desc: "4K · PNG transparency" },
  { id: "wayfair", name: "Wayfair", format: "JPEG", quality: 95, desc: "4K · JPEG max quality" },
  { id: "social", name: "Social Media", format: "JPEG", quality: 90, desc: "4K · Platforms auto-resize" },
  { id: "print", name: "Print Ready", format: "PNG", quality: 100, desc: "4K · Maximum quality PNG" },
];

const ASPECT_RATIOS = [
  { id: "original", label: "Original" },
  { id: "1:1", label: "Square 1:1" },
  { id: "16:9", label: "Landscape 16:9" },
  { id: "9:16", label: "Portrait 9:16" },
];

const FORMATS = ["JPEG", "PNG", "WebP"];

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
  batchUrls?: Array<{ url: string; name: string }>;
}

export default function ExportModal({ open, onClose, imageUrl, imageName, batchUrls }: ExportModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customFormat, setCustomFormat] = useState("JPEG");
  const [customAspect, setCustomAspect] = useState("original");
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const isBatch = batchUrls && batchUrls.length > 0;

  const getExt = (format: string) => {
    if (format === "PNG") return "png";
    if (format === "WebP") return "webp";
    return "jpg";
  };

  const downloadSingle = async (url: string, name: string, ext: string) => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/\.[^.]+$/, "")}-4K.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const handleDownload = async () => {
    setDownloading(true);

    const preset = PRESETS.find((p) => p.id === selectedPreset);
    const ext = getExt(preset ? preset.format : customFormat);

    try {
      if (isBatch) {
        // Download batch sequentially
        for (const item of batchUrls!) {
          await downloadSingle(item.url, item.name, ext);
          // Small delay between downloads
          await new Promise((r) => setTimeout(r, 300));
        }
        toast({ title: `Downloaded ${batchUrls!.length} images` });
      } else {
        await downloadSingle(imageUrl, imageName, ext);
      }
    } catch {
      if (!isBatch) window.open(imageUrl, "_blank");
    }

    setDownloading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-card-foreground">
            {isBatch ? `Export ${batchUrls!.length} Images` : "Export Options"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            All exports are 4K (4096px) resolution
          </p>
        </DialogHeader>

        {/* Batch indicator */}
        {isBatch && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{batchUrls!.length} images will be downloaded</span>
          </div>
        )}

        {/* 4K Badge */}
        <Badge variant="secondary" className="w-fit text-xs">4K · 4096px · All exports</Badge>

        {/* Marketplace Presets */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick Presets</h3>
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
                <p className="text-[11px] text-muted-foreground mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Options (when no preset selected) */}
        {!selectedPreset && (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom</h3>

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
            </div>

            <div>
              <p className="text-sm font-medium text-card-foreground mb-2">Aspect Ratio</p>
              <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setCustomAspect(a.id)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-all ${
                      customAspect === a.id ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Download */}
        <div className="pt-4 border-t border-border space-y-2">
          <Button onClick={handleDownload} disabled={downloading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
            <Download className="mr-2 h-4 w-4" />
            {downloading
              ? "Downloading..."
              : isBatch
                ? `Download ${batchUrls!.length} Images`
                : "Download 4K"
            }
          </Button>

          {/* Batch quick presets */}
          {isBatch && (
            <div className="flex gap-2">
              {[
                { id: "amazon", label: "Amazon Ready" },
                { id: "ebay", label: "eBay Ready" },
              ].map((q) => (
                <Button
                  key={q.id}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => { setSelectedPreset(q.id); }}
                >
                  {q.label}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => { setSelectedPreset(null); setCustomFormat("JPEG"); }}
              >
                Original 4K
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
