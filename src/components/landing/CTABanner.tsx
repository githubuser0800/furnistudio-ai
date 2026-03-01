import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function CTABanner() {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden">
      <div className="hero-gradient py-16 md:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(42_52%_55%/0.1),transparent_70%)]" />
        <div className="container relative mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold font-heading text-primary-foreground md:text-4xl">
            Ready to Transform Your Product Photography?
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-primary-foreground/70">
            Join hundreds of UK furniture retailers already saving time and money with AI-powered staging.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-gold-dark btn-glow"
              onClick={() => navigate("/signup")}
            >
              Start Free Today <ArrowRight className="ml-2 h-4 w-4" />
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
      </div>
    </section>
  );
}
