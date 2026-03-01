import { Shield, Lock, MapPin, Server, XCircle } from "lucide-react";

const signals = [
  { icon: Lock, label: "256-bit SSL" },
  { icon: Shield, label: "GDPR Compliant" },
  { icon: MapPin, label: "UK-Based" },
  { icon: Server, label: "99.9% Uptime" },
  { icon: XCircle, label: "Cancel Anytime" },
];

export default function TrustSignals() {
  return (
    <section className="border-y border-border bg-muted/30 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {signals.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-muted-foreground">
              <s.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
