import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sun,
  Snowflake,
  SunDim,
  Moon,
  Leaf,
  Trash2,
  ZoomIn,
  ZoomOut,
  Aperture,
  Focus,
  Undo2,
  RotateCcw,
  Sparkles,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const QUICK_EDITS = [
  { label: "Warmer lighting", icon: Sun, instruction: "Make the lighting warmer with more golden/amber tones" },
  { label: "Cooler lighting", icon: Snowflake, instruction: "Make the lighting cooler with more blue/white tones" },
  { label: "Brighter", icon: SunDim, instruction: "Make the overall scene brighter and more illuminated" },
  { label: "Darker/Moodier", icon: Moon, instruction: "Make the scene darker and moodier with more dramatic shadows" },
  { label: "Add plants", icon: Leaf, instruction: "Add green plants to the scene - a large potted plant and a smaller one" },
  { label: "Remove props", icon: Trash2, instruction: "Remove all props and decorative items from the scene, keep only the furniture and the room" },
  { label: "Zoom in", icon: ZoomIn, instruction: "Zoom in closer to the furniture piece, making it fill more of the frame" },
  { label: "Zoom out", icon: ZoomOut, instruction: "Zoom out to show more of the room environment around the furniture" },
  { label: "More background blur", icon: Aperture, instruction: "Increase the background blur (shallower depth of field) to isolate the furniture more" },
  { label: "Sharper background", icon: Focus, instruction: "Make the background sharper and more in focus throughout the scene" },
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
  const [customEdit, setCustomEdit] = useState("");
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();

  const currentEntry = history[historyIndex];
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const editCount = history.length - 1;
  const maxEdits = 10;

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
      // Use the current image's job_id - for edits we pass the original job
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
        // Truncate any redo history and add new entry
        const newHistory = [
          ...history.slice(0, historyIndex + 1),
          { url: data.output_url, instruction, path: data.output_path },
        ];
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        onImageChange(data.output_url);
        onCreditsChange(data.credits_remaining);
      }
    } catch (err: any) {
      toast({ title: "Edit failed", description: err.message, variant: "destructive" });
    } finally {
      setEditing(false);
    }
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

  const handleCustomSubmit = () => {
    if (!customEdit.trim()) return;
    performEdit(customEdit.trim());
    setCustomEdit("");
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

      {/* Quick Edit Buttons */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Quick Edits</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_EDITS.map((edit) => {
            const Icon = edit.icon;
            return (
              <button
                key={edit.label}
                onClick={() => performEdit(edit.instruction)}
                disabled={editing || editCount >= maxEdits}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground hover:border-accent/50 hover:bg-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon className="h-3 w-3 text-muted-foreground" />
                {edit.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Edit Input */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Custom Edit</p>
        <div className="flex gap-2">
          <Textarea
            value={customEdit}
            onChange={(e) => setCustomEdit(e.target.value.slice(0, 300))}
            placeholder="e.g. Make the walls lighter grey, add a floor lamp on the right..."
            className="min-h-[60px] text-sm flex-1"
            disabled={editing || editCount >= maxEdits}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
          />
          <Button
            onClick={handleCustomSubmit}
            disabled={!customEdit.trim() || editing || editCount >= maxEdits}
            className="bg-accent text-accent-foreground hover:bg-accent/90 self-end"
            size="sm"
          >
            {editing ? (
              <Sparkles className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{customEdit.length}/300</p>
      </div>

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
