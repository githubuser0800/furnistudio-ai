import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Check, Star, Pen } from "lucide-react";

import scandinavianImg from "@/assets/templates/scandinavian.jpg";
import bedroomImg from "@/assets/templates/bedroom.jpg";
import officeImg from "@/assets/templates/office.jpg";
import diningImg from "@/assets/templates/dining.jpg";
import industrialImg from "@/assets/templates/industrial.jpg";
import britishImg from "@/assets/templates/british.jpg";

// Reuse some images as placeholders for new templates — they map to the correct prompt on the backend
const CATEGORIES = [
  {
    label: "Living Room",
    templates: [
      { id: "scandinavian", name: "Modern Scandinavian", description: "Light oak floors, white walls, floor-to-ceiling windows", image: scandinavianImg, popular: true },
      { id: "contemporary_grey", name: "Contemporary Grey", description: "Warm grey walls, sheer curtains, textured rug", image: scandinavianImg },
      { id: "cozy_british", name: "Cozy British", description: "Fireplace, Persian rug, velvet curtains, fresh flowers", image: britishImg },
      { id: "luxury_penthouse", name: "Luxury Penthouse", description: "City skyline, marble floors, golden hour lighting", image: industrialImg },
      { id: "minimalist_white", name: "Minimalist White", description: "Pure white walls, concrete floor, stark light", image: diningImg },
    ],
  },
  {
    label: "Bedroom",
    templates: [
      { id: "serene_bedroom", name: "Serene Bedroom", description: "Soft white walls, plush carpet, morning light", image: bedroomImg, popular: true },
      { id: "boutique_hotel", name: "Boutique Hotel", description: "Dark green walls, brass pendant, moody lighting", image: bedroomImg },
      { id: "light_airy", name: "Light & Airy", description: "White shiplap, bleached oak, rattan accents, plants", image: bedroomImg },
    ],
  },
  {
    label: "Dining",
    templates: [
      { id: "modern_dining", name: "Modern Dining", description: "Statement pendant, dark oak floor, garden view", image: diningImg },
      { id: "rustic_farmhouse", name: "Rustic Farmhouse", description: "Exposed beams, whitewashed walls, vintage pendants", image: diningImg },
    ],
  },
  {
    label: "Office",
    templates: [
      { id: "modern_office", name: "Modern Home Office", description: "Clean white walls, large window, built-in shelving", image: officeImg },
      { id: "creative_studio", name: "Creative Studio", description: "White brick, concrete floor, industrial windows", image: officeImg },
    ],
  },
  {
    label: "Studio / Product",
    templates: [
      { id: "white_background", name: "Pure White Background", description: "Even lighting, no shadows, 85% fill — for Amazon/eBay", image: scandinavianImg, popular: true },
      { id: "grey_studio", name: "Grey Studio", description: "Seamless grey, three-point lighting, professional", image: industrialImg },
      { id: "showroom_floor", name: "Showroom Floor", description: "Polished concrete, track lighting, blurred background", image: industrialImg },
    ],
  },
];

const CUSTOM_SCENES = ["City apartment", "Country cottage", "Beach house", "Industrial loft", "Victorian home"];
const CUSTOM_LIGHTING = ["Morning light", "Golden hour", "Bright daylight", "Cozy evening"];
const CUSTOM_FLOORING = ["Oak hardwood", "Dark walnut", "Concrete", "Carpet", "Marble"];

const RESOLUTIONS = [
  { id: "1k", label: "1K", credits: 1 },
  { id: "2k", label: "2K", credits: 2 },
  { id: "4k", label: "4K", credits: 3 },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
  { id: "4:3", label: "4:3" },
  { id: "3:2", label: "3:2" },
];

interface StyleSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (templateId: string, resolution: string, customPrompt?: string, aspectRatio?: string) => void;
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
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");
  const [customPrompt, setCustomPrompt] = useState("");

  const currentCredits = RESOLUTIONS.find((r) => r.id === selectedResolution)?.credits || 1;
  const isCustom = selectedTemplate === "custom";
  const canGenerate =
    (selectedTemplate && !isCustom && creditsRemaining >= currentCredits && !loading) ||
    (isCustom && customPrompt.trim().length > 0 && creditsRemaining >= currentCredits && !loading);

  const handleChipClick = (text: string) => {
    setCustomPrompt((prev) => {
      const trimmed = prev.trim();
      if (trimmed.length === 0) return text;
      return `${trimmed}, ${text.toLowerCase()}`;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-card-foreground">
            Choose a Room Style
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Staging <span className="font-medium text-foreground">{imageName}</span>
          </p>
        </DialogHeader>

        {/* Template Grid by Category */}
        <div className="mt-4 space-y-5">
          {CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {cat.label}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {cat.templates.map((t) => (
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
                    <div className="p-2">
                      <p className="text-xs font-semibold text-card-foreground leading-tight flex items-center gap-1">
                        {t.name}
                        {(t as any).popular && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                        {t.description}
                      </p>
                    </div>
                    {selectedTemplate === t.id && (
                      <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                        <Check className="h-3 w-3 text-accent-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Custom Prompt Option */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Custom
            </h3>
            <button
              onClick={() => setSelectedTemplate("custom")}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                isCustom
                  ? "border-accent ring-2 ring-accent/30 bg-accent/5"
                  : "border-border hover:border-accent/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Pen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-card-foreground">Write Your Own Prompt</span>
                {isCustom && (
                  <div className="ml-auto h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                    <Check className="h-3 w-3 text-accent-foreground" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Describe the exact scene you want</p>
            </button>

            {isCustom && (
              <div className="mt-3 space-y-3">
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value.slice(0, 500))}
                  placeholder="e.g. A bright coastal living room with ocean view, white linen curtains, light wood floors..."
                  className="min-h-[80px] text-sm"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Click suggestions below to add them</span>
                  <span>{customPrompt.length}/500</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground">Scenes:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {CUSTOM_SCENES.map((s) => (
                        <button key={s} onClick={() => handleChipClick(s)} className="px-2.5 py-1 rounded-full border border-border text-xs text-foreground hover:bg-accent/10 hover:border-accent/40 transition-colors">{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground">Lighting:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {CUSTOM_LIGHTING.map((s) => (
                        <button key={s} onClick={() => handleChipClick(s)} className="px-2.5 py-1 rounded-full border border-border text-xs text-foreground hover:bg-accent/10 hover:border-accent/40 transition-colors">{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground">Flooring:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {CUSTOM_FLOORING.map((s) => (
                        <button key={s} onClick={() => handleChipClick(s)} className="px-2.5 py-1 rounded-full border border-border text-xs text-foreground hover:bg-accent/10 hover:border-accent/40 transition-colors">{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resolution + Aspect Ratio */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Resolution */}
          <div>
            <p className="text-sm font-medium text-card-foreground mb-2">Resolution</p>
            <div className="flex gap-2">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedResolution(r.id)}
                  className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-center transition-all ${
                    selectedResolution === r.id
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/40"
                  }`}
                >
                  <p className="text-sm font-bold">{r.label}</p>
                  <p className="text-[11px] mt-0.5">{r.credits} cr</p>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <p className="text-sm font-medium text-card-foreground mb-2">Aspect Ratio</p>
            <div className="flex gap-2 flex-wrap">
              {ASPECT_RATIOS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAspectRatio(a.id)}
                  className={`rounded-lg border-2 px-3 py-2.5 text-center transition-all min-w-[52px] ${
                    selectedAspectRatio === a.id
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/40"
                  }`}
                >
                  <p className="text-sm font-bold">{a.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1">
              Cost: {currentCredits} credit{currentCredits > 1 ? "s" : ""}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {creditsRemaining} remaining
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedTemplate &&
                onGenerate(
                  selectedTemplate,
                  selectedResolution,
                  isCustom ? customPrompt : undefined,
                  selectedAspectRatio
                )
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
