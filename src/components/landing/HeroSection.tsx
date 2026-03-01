import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Image, Maximize, Clock } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";
import BeforeAfterSlider from "@/components/dashboard/BeforeAfterSlider";

const stats = [
  { icon: Image, value: "50,000+", label: "Images Generated" },
  { icon: Maximize, value: "4K", label: "Resolution" },
  { icon: Clock, value: "~30s", label: "Generation Time" },
];

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="hero-gradient relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(42_52%_55%/0.08),transparent_60%)]" />
      <div className="container relative mx-auto px-4 py-20 md:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-in-up">
            <div className="mb-4 inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent">
              Built for UK Furniture Retailers
            </div>
            <h1 className="mb-6 text-4xl font-extrabold font-heading leading-tight tracking-tight text-primary-foreground md:text-5xl lg:text-6xl">
              Transform Furniture Photos Into{" "}
              <span className="text-gradient-gold">Studio-Quality</span> Scenes
            </h1>
            <p className="mb-8 max-w-lg text-lg text-primary-foreground/70">
              AI-powered photography for UK furniture retailers. No expensive photoshoots. Just beautiful, marketplace-ready images.
            </p>

            {/* Social proof */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex -space-x-2">
                {["S", "J", "E", "M", "R"].map((letter, i) => (
                  <div
                    key={letter}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-accent/20 text-xs font-bold text-accent"
                    style={{ zIndex: 5 - i }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <p className="text-sm text-primary-foreground/60">
                Trusted by <span className="font-semibold text-primary-foreground/80">500+</span> UK retailers
              </p>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-gold-dark btn-glow"
                onClick={() => navigate("/signup")}
              >
                Start Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => navigate("/pricing")}
              >
                View Pricing
              </Button>
              <span className="text-xs text-primary-foreground/50">No credit card required</span>
            </div>

            {/* Stat counters */}
            <div className="mt-10 flex flex-wrap gap-8">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <s.icon className="h-4 w-4 text-accent" />
                  <div>
                    <p className="text-lg font-bold text-primary-foreground">{s.value}</p>
                    <p className="text-xs text-primary-foreground/50">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-in-up [animation-delay:200ms] opacity-0">
            <BeforeAfterSlider
              beforeSrc={heroImage}
              afterSrc={heroImage}
              beforeLabel="Original Photo"
              afterLabel="AI Staged"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
