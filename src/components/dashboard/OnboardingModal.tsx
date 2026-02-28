import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Upload, Paintbrush, PartyPopper, ArrowRight, X } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onStartUpload: () => void;
}

const STEPS = [
  {
    icon: Upload,
    title: "Upload a furniture photo",
    description: "Drop any product image — sofa, chair, table, bed. We'll handle the rest.",
    hint: "JPG, PNG or WebP up to 20MB",
  },
  {
    icon: Paintbrush,
    title: "Choose a room style",
    description: "Pick from 15+ professionally designed templates, or describe your own scene.",
    hint: "Try 'Modern Scandinavian' — our most popular",
  },
  {
    icon: Sparkles,
    title: "Generate!",
    description: "AI places your furniture into the scene in under 30 seconds. 4K output, every time.",
    hint: "1 credit per image",
  },
  {
    icon: PartyPopper,
    title: "Your first image is ready!",
    description: "Download, edit, or regenerate with a different style. It's that simple.",
    hint: "",
  },
];

export default function OnboardingModal({ open, onClose, onStartUpload }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome screen

  const handleShowMe = () => setCurrentStep(0);
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
      onStartUpload();
    }
  };

  if (!open) return null;

  // Welcome screen
  if (currentStep === -1) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md bg-card border-border text-center p-8">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-xl font-bold text-card-foreground mb-2">
              Transform furniture photos into studio-quality images
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Upload a product photo, pick a room style, and get a professional staged image in seconds.
            </p>
            <div className="flex gap-3 w-full">
              <Button
                onClick={handleShowMe}
                className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
              >
                Show me how
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={onClose} className="flex-1">
                Skip
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step screens
  const step = STEPS[currentStep];
  const Icon = step.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-card border-border p-8">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Step indicators */}
        <div className="flex justify-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep ? "w-8 bg-accent" : i < currentStep ? "w-4 bg-accent/40" : "w-4 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="flex flex-col items-center text-center">
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-4 ${
            currentStep === STEPS.length - 1 ? "bg-accent/20" : "bg-muted"
          }`}>
            <Icon className={`h-7 w-7 ${currentStep === STEPS.length - 1 ? "text-accent" : "text-muted-foreground"}`} />
          </div>

          <Badge variant="secondary" className="mb-3 text-[10px]">Step {currentStep + 1} of {STEPS.length}</Badge>

          <h2 className="text-lg font-bold text-card-foreground mb-2">{step.title}</h2>
          <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
          {step.hint && (
            <p className="text-xs text-accent">{step.hint}</p>
          )}

          <Button
            onClick={handleNext}
            className="mt-6 w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {currentStep === STEPS.length - 1 ? "Get Started!" : "Next"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
