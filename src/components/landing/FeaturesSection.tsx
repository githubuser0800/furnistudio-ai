import { Eraser, Home, Maximize, Palette, Layers, MapPin } from "lucide-react";

const features = [
  { icon: Eraser, title: "Background Removal", description: "Instantly remove cluttered backgrounds with AI precision." },
  { icon: Home, title: "Room Scenes", description: "Place furniture in beautiful, photorealistic room settings." },
  { icon: Maximize, title: "4K Quality", description: "Output images in stunning 4K resolution, print-ready." },
  { icon: Palette, title: "Fabric Variants", description: "Generate multiple fabric and colour options in one click." },
  { icon: Layers, title: "Batch Processing", description: "Process hundreds of images simultaneously, saving hours." },
  { icon: MapPin, title: "UK Optimised", description: "Tailored for UK marketplaces like eBay, Etsy, and Amazon UK." },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">
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
              className="card-elevated group rounded-xl border border-border bg-card p-6"
              style={{ animationDelay: `${i * 100}ms` }}
            >
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
