import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Undo2,
  RotateCcw,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const EDIT_GROUPS = [
  {
    label: "Lighting",
    options: [
      { id: "warmer", label: "Warmer", instruction: "Make the lighting warmer with more golden/amber tones" },
      { id: "cooler", label: "Cooler", instruction: "Make the lighting cooler with more blue/white tones" },
      { id: "brighter", label: "Brighter", instruction: "Make the overall scene brighter and more illuminated" },
      { id: "darker", label: "Darker", instruction: "Make the scene darker and moodier with more dramatic shadows" },
    ],
  },
  {
    label: "Environment",
    options: [
      { id: "plants", label: "Add plants", instruction: "Add green plants to the scene" },
      { id: "lamp", label: "Add lamp", instruction: "Add a stylish floor lamp to the scene" },
      { id: "rug", label: "Add rug", instruction: "Add a textured area rug beneath the furniture" },
      { id: "remove_props", label: "Remove props", instruction: "Remove all props and decorative items, keep only the furniture and the room" },
    ],
  },
  {
    label: "Camera",
    options: [
      { id: "zoom_in", label: "Zoom in", instruction: "Zoom in closer to the furniture piece" },
      { id: "zoom_out", label: "Zoom out", instruction: "Zoom out to show more of the room" },
      { id: "more_blur", label: "More blur", instruction: "Increase the background blur to isolate the furniture more" },
      { id: "sharper", label: "Sharper", instruction: "Make the background sharper and more in focus" },
    ],
  },
];

interface EditHistoryEntry {
  url: string;
  instruction: string;
  path: string;
}

interface ImageEditPanelProps {
  jobId: string;
  originalImageId: string;
  currentImageUrl: string;
  creditsRemaining: number;
  onCreditsChange: (credits: number) => void;
  onImageChange: (url: string) => void;
}

export default function ImageEditPanel({
  jobId,
  originalImageId,
  currentImageUrl,
  creditsRemaining,
  onCreditsChange,
  onImageChange,
}: ImageEditPanelProps) {
  const [history, setHistory] = useState<EditHistoryEntry[]>([
    { url: currentImageUrl, instruction: "Original generation", path: "" },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customEdit, setCustomEdit] = useState("");
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();

  const editCount = history.length - 1;
  const maxEdits = 10;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const toggleOption = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Build combined instruction from selections + custom text
  const selectedInstructions = EDIT_GROUPS.flatMap((g) =>
    g.options.filter((o) => selected.has(o.id))
  );
  const summaryParts = selectedInstructions.map((o) => o.label);
  if (customEdit.trim()) summaryParts.push(`Custom: ${customEdit.trim().slice(0, 60)}${customEdit.trim().length > 60 ? "…" : ""}`);
  const hasEdits = summaryParts.length > 0;

  const buildPrompt = (): string => {
    const parts = selectedInstructions.map((o) => o.instruction);
    if (customEdit.trim()) parts.push(customEdit.trim());
    return parts.join(". ") + ".";
  };

  const performEdit = async (instruction: string) => {
    if (editCount >= maxEdits) {
      toast({ title: "Edit limit reached", description: "Maximum 10 edits per image.", variant: "destructive" });
      return;
    }
    if (creditsRemaining < 1) {
      toast({ title: "Insufficient credits", description: "You need at least 1 credit for an edit.", variant: "destructive" });
      return;
    }

    setEditing(true);
    try {
      const { data, error } = await supabase.functions.invoke("edit-image", {
        body: {
          job_id: jobId,
          edit_instruction: instruction,
          original_image_id: originalImageId,
        },
      });

      if (error) throw new Error(error.message || "Edit failed");
      if (data?.error) throw new Error(data.error);

      if (data?.success && data.output_url) {
        const newHistory = [
          ...history.slice(0, historyIndex + 1),
          { url: data.output_url, instruction, path: data.output_path },
        ];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        onImageChange(data.output_url);
        onCreditsChange(data.credits_remaining);
        // Clear selections after successful edit
        setSelected(new Set());
        setCustomEdit("");
      }
    } catch (err: any) {
      toast({ title: "Edit failed", description: err.message, variant: "destructive" });
    } finally {
      setEditing(false);
    }
  };

  const handleApply = () => {
    if (!hasEdits) return;
    performEdit(buildPrompt());
  };

  const handleUndo = () => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    onImageChange(history[newIndex].url);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    onImageChange(history[newIndex].url);
  };

  const handleReset = () => {
    setHistoryIndex(0);
    onImageChange(history[0].url);
  };

  return (
    <div className="space-y-4">
      {/* Edit History Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo || editing}>
            <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
          </Button>
          <Button variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo || editing}>
            <ChevronRight className="h-3.5 w-3.5 mr-1" /> Redo
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={historyIndex === 0 || editing}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        </div>
        <Badge variant="outline" className="text-xs">
          {editCount}/{maxEdits} edits · 0.5 cr each
        </Badge>
      </div>

      {/* Edit History Steps */}
      {history.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {history.map((entry, i) => (
            <button
              key={i}
              onClick={() => {
                setHistoryIndex(i);
                onImageChange(entry.url);
              }}
              className={`shrink-0 px-2 py-1 rounded-md text-[10px] border transition-all ${
                i === historyIndex
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-border text-muted-foreground hover:border-accent/40"
              }`}
            >
              {i === 0 ? "Original" : `Edit ${i}`}
            </button>
          ))}
        </div>
      )}

      {/* Checkbox Groups */}
      <div className="space-y-3">
        {EDIT_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {group.options.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <Checkbox
                    checked={selected.has(option.id)}
                    onCheckedChange={() => toggleOption(option.id)}
                    disabled={editing || editCount >= maxEdits}
                  />
                  <span className="text-sm text-foreground group-hover:text-accent transition-colors">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Custom Text Input */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Custom Instructions
        </p>
        <Textarea
          value={customEdit}
          onChange={(e) => setCustomEdit(e.target.value.slice(0, 500))}
          placeholder="e.g., Change walls to light blue, add window on left"
          className="min-h-[80px] text-sm"
          disabled={editing || editCount >= maxEdits}
        />
        <p className="text-[10px] text-muted-foreground mt-1 text-right">{customEdit.length}/500</p>
      </div>

      {/* Summary */}
      {hasEdits && (
        <div className="rounded-lg border border-border bg-muted/30 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Edits to apply
          </p>
          <p className="text-xs text-foreground leading-relaxed">
            {summaryParts.map((s, i) => (
              <span key={i}>
                {i > 0 && <span className="text-muted-foreground"> · </span>}
                {s}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* Apply Button */}
      <Button
        onClick={handleApply}
        disabled={!hasEdits || editing || editCount >= maxEdits || creditsRemaining < 1}
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 min-h-[44px]"
      >
        {editing ? (
          <>
            <div className="h-4 w-4 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin mr-2" />
            Applying edits...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Apply All Edits — 0.5 credits
          </>
        )}
      </Button>

      {/* Editing Overlay */}
      {editing && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-accent/30 bg-accent/5">
          <div className="h-5 w-5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
          <span className="text-sm text-accent font-medium">Applying edit...</span>
        </div>
      )}
    </div>
  );
}
