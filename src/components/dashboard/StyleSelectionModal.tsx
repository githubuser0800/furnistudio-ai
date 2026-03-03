import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Check, Star, Pen, Heart, Clock, Camera, ChevronDown, ChevronRight, Search, Sun, Monitor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import {
  CATEGORIES,
  ALL_TEMPLATES,
  CAMERA_ANGLE_GROUPS,
  ALL_CAMERA_ANGLES,
  ASPECT_RATIOS,
  PLATFORM_PRESETS,
  LIGHTING_MOODS,
  CUSTOM_PROMPT_CHIPS,
  FIXED_RESOLUTION,
  CREDIT_COST,
  VARIATION_OPTIONS,
  type Template,
} from "@/constants/styleModalData";

interface StyleSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (templateId: string, resolution: string, customPrompt?: string, aspectRatio?: string, cameraAngle?: string, variations?: number) => void;
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
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");
  const [selectedAngle, setSelectedAngle] = useState("eye_level");
  const [variations, setVariations] = useState(1);
  const [customPrompt, setCustomPrompt] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLighting, setSelectedLighting] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const currentCredits = CREDIT_COST * variations;
  const isCustom = selectedTemplate === "custom";
  const isVirtual = selectedTemplate?.startsWith("virtual_") ?? false;
  const canGenerate =
    (selectedTemplate && !isCustom && creditsRemaining >= currentCredits && !loading) ||
    (isCustom && customPrompt.trim().length > 0 && creditsRemaining >= currentCredits && !loading);

  const selectedTemplateData = useMemo(
    () => ALL_TEMPLATES.find((t) => t.id === selectedTemplate),
    [selectedTemplate]
  );

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return ALL_TEMPLATES.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Load favorites and recents
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("favorite_templates, recent_templates").eq("id", user.id).single();
      if (data) {
        setFavorites(data.favorite_templates || []);
        setRecents(data.recent_templates || []);
      }
    })();
  }, [open]);

  // Reset search when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedLighting(null);
      setSelectedPlatform(null);
    }
  }, [open]);

  const toggleFavorite = async (templateId: string) => {
    const next = favorites.includes(templateId)
      ? favorites.filter((f) => f !== templateId)
      : [...favorites, templateId];
    setFavorites(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ favorite_templates: next }).eq("id", user.id);
    }
  };

  const handleChipClick = (text: string) => {
    setCustomPrompt((prev) => {
      const trimmed = prev.trim();
      if (trimmed.length === 0) return text;
      return `${trimmed}, ${text.toLowerCase()}`;
    });
  };

  const handlePlatformSelect = (presetId: string) => {
    if (selectedPlatform === presetId) {
      setSelectedPlatform(null);
      return;
    }
    setSelectedPlatform(presetId);
    const preset = PLATFORM_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setSelectedAspectRatio(preset.aspectRatio);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    // Update recents
    const templateForRecents = isVirtual ? selectedTemplate : selectedTemplate;
    const newRecents = [templateForRecents, ...recents.filter((r) => r !== templateForRecents)].slice(0, 5);
    setRecents(newRecents);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ recent_templates: newRecents }).eq("id", user.id);
    }

    // Build the prompt
    const angleData = ALL_CAMERA_ANGLES.find((a) => a.id === selectedAngle);
    const anglePrompt = angleData?.prompt || "";
    const lightingMood = LIGHTING_MOODS.find((m) => m.id === selectedLighting);
    const lightingAppend = lightingMood?.promptAppend || "";

    if (isVirtual) {
      // Virtual templates route through custom path
      const virtualTemplate = ALL_TEMPLATES.find((t) => t.id === selectedTemplate);
      if (!virtualTemplate?.virtualPrompt) return;
      let prompt = virtualTemplate.virtualPrompt;
      if (lightingAppend) prompt += lightingAppend;
      if (anglePrompt) prompt += `. ${anglePrompt}`;
      onGenerate("custom", FIXED_RESOLUTION, prompt, selectedAspectRatio, selectedAngle, variations);
    } else if (isCustom) {
      const fullPrompt = anglePrompt ? `${customPrompt}. ${anglePrompt}` : customPrompt;
      onGenerate("custom", FIXED_RESOLUTION, fullPrompt, selectedAspectRatio, selectedAngle, variations);
    } else {
      // Standard template
      let prompt = anglePrompt || undefined;
      if (lightingAppend) {
        prompt = prompt ? `${prompt}${lightingAppend}` : lightingAppend.slice(2); // remove leading ", "
      }
      onGenerate(selectedTemplate, FIXED_RESOLUTION, prompt || undefined, selectedAspectRatio, selectedAngle, variations);
    }
  };

  const favoriteTemplates = ALL_TEMPLATES.filter((t) => favorites.includes(t.id));
  const recentTemplates = ALL_TEMPLATES.filter((t) => recents.includes(t.id));
  const QUICK_PICKS = ALL_TEMPLATES.filter((t) => ["scandinavian", "white_background", "showroom_floor"].includes(t.id));

  const toggleCategory = (label: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  const renderTemplateCard = (t: Template) => (
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
        <img src={t.image} alt={t.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold text-card-foreground leading-tight flex items-center gap-1">
          {t.name}
          {t.popular && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
          {t.virtualPrompt && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">Custom</Badge>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{t.description}</p>
      </div>
      {selectedTemplate === t.id && (
        <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-accent flex items-center justify-center">
          <Check className="h-3 w-3 text-accent-foreground" />
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); toggleFavorite(t.id); }}
        className="absolute top-1.5 left-1.5 h-6 w-6 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/60 transition-colors"
      >
        <Heart className={`h-3 w-3 ${favorites.includes(t.id) ? "text-red-400 fill-red-400" : "text-white"}`} />
      </button>
    </button>
  );

  // Get display name for summary
  const getTemplateName = () => {
    if (isCustom) return "Custom Prompt";
    return selectedTemplateData?.name || "None";
  };

  const getAngleName = () => {
    return ALL_CAMERA_ANGLES.find((a) => a.id === selectedAngle)?.label || selectedAngle;
  };

  const getLightingName = () => {
    if (!selectedLighting) return null;
    return LIGHTING_MOODS.find((m) => m.id === selectedLighting)?.label || null;
  };

  const activePlatformPreset = PLATFORM_PRESETS.find((p) => p.id === selectedPlatform);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-card-foreground">Choose a Room Style</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Staging <span className="font-medium text-foreground">{imageName}</span>
          </p>
        </DialogHeader>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        <div className="mt-4 space-y-5">
          {filteredTemplates ? (
            /* Search Results */
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Search Results ({filteredTemplates.length})
              </h3>
              {filteredTemplates.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {filteredTemplates.map(renderTemplateCard)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No templates match your search</p>
              )}
            </div>
          ) : (
            <>
              {/* Quick Picks - always visible */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-2 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-accent" /> Quick Picks
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {QUICK_PICKS.map(renderTemplateCard)}
                </div>
              </div>

              {/* Favorites */}
              {favoriteTemplates.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleCategory("Favorites")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent mb-2 hover:opacity-80 transition-opacity"
                  >
                    {expandedCategories.has("Favorites") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <Heart className="h-3 w-3 fill-accent" /> Favorites
                  </button>
                  {expandedCategories.has("Favorites") && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                      {favoriteTemplates.map(renderTemplateCard)}
                    </div>
                  )}
                </div>
              )}

              {/* Recently Used */}
              {recentTemplates.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleCategory("Recent")}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 hover:text-foreground transition-colors"
                  >
                    {expandedCategories.has("Recent") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <Clock className="h-3 w-3" /> Recent
                  </button>
                  {expandedCategories.has("Recent") && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                      {recentTemplates.map(renderTemplateCard)}
                    </div>
                  )}
                </div>
              )}

              {/* Template Grid by Category - Collapsible */}
              {CATEGORIES.map((cat) => (
                <div key={cat.label}>
                  <button
                    onClick={() => toggleCategory(cat.label)}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 hover:text-foreground transition-colors"
                  >
                    {expandedCategories.has(cat.label) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {cat.label} ({cat.templates.length})
                  </button>
                  {expandedCategories.has(cat.label) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                      {cat.templates.map(renderTemplateCard)}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Custom Prompt Option */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Custom</h3>
            <button
              onClick={() => setSelectedTemplate("custom")}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                isCustom ? "border-accent ring-2 ring-accent/30 bg-accent/5" : "border-border hover:border-accent/50"
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
                  {CUSTOM_PROMPT_CHIPS.map((cat) => (
                    <div key={cat.label}>
                      <span className="text-[11px] font-medium text-muted-foreground">{cat.label}:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {cat.chips.map((chip) => (
                          <button
                            key={chip}
                            onClick={() => handleChipClick(chip)}
                            className="px-2.5 py-1 rounded-full border border-border text-xs text-foreground hover:bg-accent/10 hover:border-accent/40 transition-colors"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lighting Mood - shown for non-custom templates */}
        {selectedTemplate && !isCustom && (
          <div className="mt-5">
            <p className="text-sm font-medium text-card-foreground mb-2 flex items-center gap-1.5">
              <Sun className="h-4 w-4 text-muted-foreground" /> Lighting Mood
            </p>
            <div className="flex flex-wrap gap-2">
              {LIGHTING_MOODS.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => setSelectedLighting(selectedLighting === mood.id ? null : mood.id)}
                  className={`rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-all ${
                    selectedLighting === mood.id
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/40"
                  }`}
                >
                  {mood.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Camera Angle - grouped */}
        <div className="mt-5">
          <p className="text-sm font-medium text-card-foreground mb-2 flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-muted-foreground" /> Camera Angle
          </p>
          <div className="space-y-3">
            {CAMERA_ANGLE_GROUPS.map((group) => (
              <div key={group.label}>
                <span className="text-[11px] font-medium text-muted-foreground mb-1.5 block">{group.label}</span>
                <div className="flex flex-wrap gap-2">
                  {group.angles.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAngle(a.id)}
                      title={a.description}
                      className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                        selectedAngle === a.id
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted-foreground hover:border-accent/40"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aspect Ratio + Platform Presets + Variations */}
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-card-foreground mb-2">Aspect Ratio</p>
              <div className="flex gap-2 flex-wrap">
                {ASPECT_RATIOS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAspectRatio(a.id); setSelectedPlatform(null); }}
                    className={`rounded-lg border-2 px-3 py-2.5 text-center transition-all min-w-[52px] ${
                      selectedAspectRatio === a.id ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    <p className="text-sm font-bold">{a.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-card-foreground mb-2">Variations</p>
              <div className="flex gap-2">
                {VARIATION_OPTIONS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVariations(v)}
                    className={`flex-1 rounded-lg border-2 px-2 py-2.5 text-center transition-all ${
                      variations === v ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    <p className="text-sm font-bold">{v}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Platform Presets */}
          <div>
            <p className="text-sm font-medium text-card-foreground mb-2 flex items-center gap-1.5">
              <Monitor className="h-4 w-4 text-muted-foreground" /> Platform Presets
            </p>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePlatformSelect(preset.id)}
                  className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all ${
                    selectedPlatform === preset.id
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/40"
                  }`}
                >
                  {preset.label}
                  <span className="ml-1.5 opacity-60">{preset.aspectRatio}</span>
                </button>
              ))}
            </div>
            {activePlatformPreset && (
              <p className="text-xs text-muted-foreground mt-1.5">{activePlatformPreset.tip}</p>
            )}
          </div>
        </div>

        {/* 4K badge */}
        <div className="mt-3">
          <Badge variant="secondary" className="text-xs">All outputs are 4K (4096px)</Badge>
        </div>

        {/* Generation Summary Card */}
        {selectedTemplate && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-card-foreground mb-1.5">Generation Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
              <div>
                <span className="text-muted-foreground">Template: </span>
                <span className="text-foreground font-medium">{getTemplateName()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Angle: </span>
                <span className="text-foreground font-medium">{getAngleName()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ratio: </span>
                <span className="text-foreground font-medium">{selectedAspectRatio}</span>
              </div>
              {getLightingName() && (
                <div>
                  <span className="text-muted-foreground">Lighting: </span>
                  <span className="text-foreground font-medium">{getLightingName()}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Variations: </span>
                <span className="text-foreground font-medium">{variations}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Cost: </span>
                <span className="text-foreground font-medium">{currentCredits} credit{currentCredits > 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 pt-4 border-t border-border gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-sm px-3 py-1">
              {currentCredits} credit{currentCredits > 1 ? "s" : ""}
            </Badge>
            <span className="text-sm text-muted-foreground">{creditsRemaining} remaining</span>
            {creditsRemaining < currentCredits && (
              <span className="text-xs text-destructive font-medium">Not enough credits</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="min-h-[44px]">Cancel</Button>
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="bg-accent text-accent-foreground hover:bg-accent/90 min-h-[44px]"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {loading ? "Generating..." : variations > 1 ? `Generate ${variations} Variations` : "Generate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
