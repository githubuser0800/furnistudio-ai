import { Upload, Wand2, Download } from "lucide-react";

const steps = [
  { icon: Upload, step: "01", title: "Upload", description: "Drop your furniture photos into FurniStudio." },
  { icon: Wand2, step: "02", title: "Choose Style", description: "Pick a room scene, background, or enhancement." },
  { icon: Download, step: "03", title: "Download", description: "Get studio-quality images in seconds." },
];

export default function HowItWorksSection() {
  return (
    <section className="bg-secondary py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <h2 className="mb-3 text-3xl font-bold text-foreground md:text-4xl">How It Works</h2>
          <p className="text-muted-foreground">Three simple steps to professional images.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.step} className="text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <s.icon className="h-7 w-7" />
              </div>
              <span className="mb-2 block text-sm font-bold text-accent">STEP {s.step}</span>
              <h3 className="mb-2 text-xl font-semibold text-foreground">{s.title}</h3>
              <p className="text-muted-foreground">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
