import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

const tiers = [
  { name: "Free", price: "£0", period: "/month", features: ["10 images/month", "1K resolution", "Basic backgrounds"], highlight: false },
  { name: "Starter", price: "£9", period: "/month", features: ["50 images/month", "2K resolution", "Room scenes"], highlight: false },
  { name: "Pro", price: "£29", period: "/month", features: ["200 images/month", "4K resolution", "Batch processing"], highlight: true },
  { name: "Business", price: "£79", period: "/month", features: ["600 images/month", "4K resolution", "API access"], highlight: false },
];

export default function PricingPreview() {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground">Start free. Scale as you grow.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`card-elevated relative rounded-xl border p-6 ${
                tier.highlight
                  ? "border-accent bg-card ring-2 ring-accent"
                  : "border-border bg-card"
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
                  Most Popular
                </span>
              )}
              <h3 className="mb-1 text-lg font-semibold text-card-foreground">{tier.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-card-foreground">{tier.price}</span>
                <span className="text-sm text-muted-foreground">{tier.period}</span>
              </div>
              <ul className="mb-6 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-accent" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full ${tier.highlight ? "bg-accent text-accent-foreground hover:bg-gold-dark" : ""}`}
                variant={tier.highlight ? "default" : "outline"}
                onClick={() => navigate("/pricing")}
              >
                {tier.name === "Free" ? "Get Started" : "View Plans"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
