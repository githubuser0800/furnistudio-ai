import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PACKAGES = [
  { id: "25", credits: 25, price: 5, perCredit: "£0.20", savings: null, badge: null },
  { id: "50", credits: 50, price: 8, perCredit: "£0.16", savings: "20% off", badge: null },
  { id: "100", credits: 100, price: 12, perCredit: "£0.12", savings: "40% off", badge: "Best Value" },
];

interface CreditTopUpModalProps {
  open: boolean;
  onClose: () => void;
  creditsRemaining: number;
}

export default function CreditTopUpModal({ open, onClose, creditsRemaining }: CreditTopUpModalProps) {
  const [selected, setSelected] = useState("50");
  const { toast } = useToast();

  const handlePurchase = () => {
    toast({
      title: "Coming soon",
      description: "Stripe payments are being integrated. Check back shortly!",
    });
    onClose();
  };

  const pkg = PACKAGES.find((p) => p.id === selected);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            Top Up Credits
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            You have <span className="font-semibold text-foreground">{creditsRemaining}</span> credits remaining
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {PACKAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all relative ${
                selected === p.id
                  ? "border-accent ring-2 ring-accent/20 bg-accent/5"
                  : "border-border hover:border-accent/40"
              }`}
            >
              {p.badge && (
                <Badge className="absolute -top-2.5 right-3 bg-accent text-accent-foreground text-[10px]">
                  {p.badge}
                </Badge>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-card-foreground">{p.credits} credits</p>
                  <p className="text-sm text-muted-foreground">{p.perCredit} each</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  {p.savings && (
                    <Badge variant="secondary" className="text-[11px]">{p.savings}</Badge>
                  )}
                  <p className="text-xl font-bold text-foreground">£{p.price}</p>
                  {selected === p.id && (
                    <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                      <Check className="h-3 w-3 text-accent-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-border">
          <Button
            onClick={handlePurchase}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Buy {pkg?.credits} credits for £{pkg?.price}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground mt-2">
            One-time purchase · Stripe integration coming soon
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
