import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check } from "lucide-react";

import scandinavianImg from "@/assets/templates/scandinavian.jpg";
import bedroomImg from "@/assets/templates/bedroom.jpg";
import officeImg from "@/assets/templates/office.jpg";
import diningImg from "@/assets/templates/dining.jpg";
import industrialImg from "@/assets/templates/industrial.jpg";
import britishImg from "@/assets/templates/british.jpg";

const TEMPLATES = [
  {
    id: "scandinavian",
    name: "Modern Scandinavian",
    description: "Light oak floors, natural daylight, minimal decor",
    image: scandinavianImg,
  },
  {
    id: "bedroom",
    name: "Cozy Traditional Bedroom",
    description: "Warm lighting, plush textiles, evening ambiance",
    image: bedroomImg,
  },
  {
    id: "office",
    name: "Contemporary Office",
    description: "Polished concrete, city view, modern aesthetic",
    image: officeImg,
  },
  {
    id: "dining",
    name: "Minimalist Dining",
    description: "White marble, pendant lighting, architectural",
    image: diningImg,
  },
  {
    id: "industrial",
    name: "Industrial Loft",
    description: "Exposed brick, steel windows, Edison lighting",
    image: industrialImg,
  },
  {
    id: "british",
    name: "Classic British",
    description: "Persian rugs, fireplace, velvet curtains",
    image: britishImg,
  },
];

const RESOLUTIONS = [
  { id: "1k", label: "1K", credits: 1 },
  { id: "2k", label: "2K", credits: 2 },
  { id: "4k", label: "4K", credits: 3 },
];

interface StyleSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (templateId: string, resolution: string) => void;
  creditsRemaining: number;
  loading: boolean;
  imageName: string;
}

export default function StyleSelectionModal({
  open,
  onClose,
  onGenerate,
  creditsRemaining,
  loading,
  imageName,
}: StyleSelectionModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedResolution, setSelectedResolution] = useState("1k");

  const currentCredits =
    RESOLUTIONS.find((r) => r.id === selectedResolution)?.credits || 1;
  const canGenerate =
    selectedTemplate && creditsRemaining >= currentCredits && !loading;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-card-foreground">
            Choose a Room Style
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Staging <span className="font-medium text-foreground">{imageName}</span>
          </p>
        </DialogHeader>

        {/* Template Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`group relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                selectedTemplate === t.id
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-border hover:border-accent/50"
              }`}
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={t.image}
                  alt={t.name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="p-2.5">
                <p className="text-sm font-semibold text-card-foreground leading-tight">
                  {t.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                  {t.description}
                </p>
              </div>
              {selectedTemplate === t.id && (
                <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-accent flex items-center justify-center">
                  <Check className="h-4 w-4 text-accent-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Resolution Selector */}
        <div className="mt-5">
          <p className="text-sm font-medium text-card-foreground mb-2">
            Output Resolution
          </p>
          <div className="flex gap-2">
            {RESOLUTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedResolution(r.id)}
                className={`flex-1 rounded-lg border-2 px-4 py-3 text-center transition-all ${
                  selectedResolution === r.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-accent/40"
                }`}
              >
                <p className="text-base font-bold">{r.label}</p>
                <p className="text-xs mt-0.5">
                  {r.credits} credit{r.credits > 1 ? "s" : ""}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1">
              Cost: {currentCredits} credit{currentCredits > 1 ? "s" : ""}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {creditsRemaining} credits remaining
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedTemplate &&
                onGenerate(selectedTemplate, selectedResolution)
              }
              disabled={!canGenerate}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {loading ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
