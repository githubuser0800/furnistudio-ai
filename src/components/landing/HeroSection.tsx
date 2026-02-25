import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="hero-gradient relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(42_48%_58%/0.08),transparent_60%)]" />
      <div className="container relative mx-auto px-4 py-20 md:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-in-up">
            <div className="mb-4 inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent">
              🇬🇧 Built for UK Furniture Retailers
            </div>
            <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight text-primary-foreground md:text-5xl lg:text-6xl">
              Transform Furniture Photos Into{" "}
              <span className="text-gradient-gold">Studio-Quality</span> Images in Seconds
            </h1>
            <p className="mb-8 max-w-lg text-lg text-primary-foreground/70">
              AI-powered photography for UK furniture retailers. No expensive photoshoots. Just beautiful, marketplace-ready images.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-gold-dark"
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
            </div>
          </div>
          <div className="animate-fade-in-up [animation-delay:200ms] opacity-0">
            <div className="relative overflow-hidden rounded-xl shadow-2xl">
              <img
                src={heroImage}
                alt="FurniStudio AI furniture photo transformation - before and after"
                className="w-full object-cover"
              />
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-primary-foreground/10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
