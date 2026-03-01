import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import CTABanner from "@/components/landing/CTABanner";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingPreview from "@/components/landing/PricingPreview";
import TrustSignals from "@/components/landing/TrustSignals";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <CTABanner />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingPreview />
      <TrustSignals />
      <Footer />
    </div>
  );
};

export default Index;
