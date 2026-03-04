import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SEATING_SHOT_LIST,
  SEATING_GROUPS,
  type SeatingShot,
} from "@/constants/seatingShots";
import {
  Camera,
  Eye,
  Sofa,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";

interface ShotPickerGridProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  onConfirm: () => void;
  onBack: () => void;
  creditsRemaining: number;
}

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "Standard Views": <Camera className="h-4 w-4" />,
  "Close-Ups": <Eye className="h-4 w-4" />,
  Lifestyle: <Sofa className="h-4 w-4" />,
};

export default function ShotPickerGrid({
  selected,
  onChange,
  onConfirm,
  onBack,
  creditsRemaining,
}: ShotPickerGridProps) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  const selectAll = () => onChange(SEATING_SHOT_LIST.map((s) => s.id));
  const clearAll = () => onChange([]);
  const selectGroup = (group: string) =>
    onChange(SEATING_SHOT_LIST.filter((s) => s.group === group).map((s) => s.id));

  const cost = selected.length;
  const canAfford = cost <= creditsRemaining;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">
          Choose Your Shots
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Industry-standard 9-shot seating photography workflow
        </p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button variant="outline" size="sm" onClick={selectAll}>
          <CheckSquare className="mr-1.5 h-3.5 w-3.5" /> Select All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectGroup("Standard Views")}
        >
          Standard Views Only
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectGroup("Close-Ups")}
        >
          Close-Ups Only
        </Button>
        <Button variant="outline" size="sm" onClick={clearAll}>
          <Square className="mr-1.5 h-3.5 w-3.5" /> Clear All
        </Button>
      </div>

      {/* Shot groups */}
      {SEATING_GROUPS.map((group) => {
        const shots = SEATING_SHOT_LIST.filter((s) => s.group === group);
        return (
          <div key={group}>
            <div className="flex items-center gap-2 mb-3">
              {GROUP_ICONS[group]}
              <h3 className="text-sm font-semibold text-foreground">{group}</h3>
              <Badge variant="outline" className="text-[10px] px-1.5">
                {shots.filter((s) => selected.includes(s.id)).length}/
                {shots.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {shots.map((shot) => {
                const isSelected = selected.includes(shot.id);
                return (
                  <button
                    key={shot.id}
                    onClick={() => toggle(shot.id)}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? "border-accent bg-accent/5 shadow-sm"
                        : "border-border bg-card hover:border-accent/40"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge
                        variant={isSelected ? "default" : "outline"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {shot.number}
                      </Badge>
                      <Checkbox
                        checked={isSelected}
                        className="pointer-events-none"
                      />
                    </div>
                    <p className="text-sm font-medium text-card-foreground leading-tight mb-1">
                      {shot.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {shot.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-3">
          <p className="text-sm text-foreground font-medium">
            {selected.length} of 9 shots selected —{" "}
            <span className={canAfford ? "text-accent" : "text-destructive"}>
              {cost} credit{cost !== 1 ? "s" : ""}
            </span>
          </p>
          {!canAfford && (
            <Badge variant="destructive" className="text-[10px]">
              Not enough credits
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            onClick={onConfirm}
            disabled={selected.length === 0 || !canAfford}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Continue with {selected.length} shot{selected.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
