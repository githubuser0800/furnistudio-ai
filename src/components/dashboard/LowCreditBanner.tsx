import { AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LowCreditBannerProps {
  creditsRemaining: number;
  maxCredits: number;
  onTopUp: () => void;
}

export default function LowCreditBanner({ creditsRemaining, maxCredits, onTopUp }: LowCreditBannerProps) {
  const percentage = maxCredits > 0 ? (creditsRemaining / maxCredits) * 100 : 100;

  if (percentage > 20) return null;

  const isCritical = percentage <= 10;

  return (
    <div
      className={`mb-6 flex items-center justify-between rounded-xl border px-4 py-3 ${
        isCritical
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">
          {isCritical
            ? `Only ${creditsRemaining} credits left!`
            : `Running low on credits (${creditsRemaining} remaining)`}
        </span>
      </div>
      <Button
        size="sm"
        onClick={onTopUp}
        className={
          isCritical
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-amber-500 text-white hover:bg-amber-600"
        }
      >
        <Zap className="mr-1 h-3 w-3" /> Top Up Now
      </Button>
    </div>
  );
}
