import { Eraser, Home, Maximize, Palette, Layers, MapPin } from "lucide-react";

const features = [
  { icon: Eraser, title: "Background Removal", description: "Remove cluttered backgrounds instantly with AI precision. Clean, professional results every time." },
  { icon: Home, title: "16 Room Scenes", description: "Place furniture in photorealistic rooms — from Scandinavian minimalism to luxury penthouses." },
  { icon: Maximize, title: "4K Resolution", description: "Output images in stunning 4K resolution, print-ready and marketplace-optimised for Amazon, eBay, and Etsy." },
  { icon: Palette, title: "Fabric Variants", description: "Generate multiple fabric and colour options in one click. Perfect for showing range without re-shooting." },
  { icon: Layers, title: "Batch Processing", description: "Process up to 10 images simultaneously with consistent styling. Save hours of editing time." },
  { icon: MapPin, title: "UK Optimised", description: "Tailored presets for UK marketplaces. Export-ready for eBay UK, Etsy, Amazon UK, and Wayfair." },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <h2 className="mb-3 text-3xl font-bold font-heading text-foreground md:text-4xl">
            Everything You Need
          </h2>
          <p className="mx-auto max-w-lg text-muted-foreground">
            Professional-grade tools designed specifically for furniture photography.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="card-elevated group rounded-xl border border-border bg-card p-6 opacity-0 animate-fade-in-up relative overflow-hidden"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-accent transition-all duration-300 group-hover:w-full" />
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-card-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
