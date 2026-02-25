import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const plans = [
  {
    name: "Free",
    monthly: 0,
    annual: 0,
    features: ["10 images/month", "1K resolution", "Basic backgrounds", "Email support"],
  },
  {
    name: "Starter",
    monthly: 9,
    annual: 7,
    features: ["50 images/month", "2K resolution", "Room scenes", "Priority email support"],
  },
  {
    name: "Pro",
    monthly: 29,
    annual: 23,
    popular: true,
    features: ["200 images/month", "4K resolution", "Batch processing", "Fabric variants", "Priority support"],
  },
  {
    name: "Business",
    monthly: 79,
    annual: 63,
    features: ["600 images/month", "4K resolution", "API access", "Custom branding", "Dedicated account manager"],
  },
];

const faqs = [
  { q: "Can I cancel anytime?", a: "Yes, you can cancel your subscription at any time. Your access continues until the end of the billing period." },
  { q: "What image formats are supported?", a: "We support JPG, PNG, and WebP uploads. Processed images are delivered in high-quality PNG format." },
  { q: "How does the credits system work?", a: "Each image processed costs 1–3 credits depending on resolution. Credits refresh at the start of each billing cycle." },
  { q: "Is there an API for bulk processing?", a: "Yes, our Business plan includes full API access for integrating FurniStudio into your existing workflow." },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center">
            <h1 className="mb-3 text-4xl font-bold text-foreground">Pricing</h1>
            <p className="mb-6 text-muted-foreground">Choose the plan that fits your business.</p>
            <div className="inline-flex items-center gap-3 rounded-full border border-border bg-secondary p-1">
              <button
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setAnnual(false)}
              >
                Monthly
              </button>
              <button
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setAnnual(true)}
              >
                Annual <span className="text-accent">(-20%)</span>
              </button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const price = annual ? plan.annual : plan.monthly;
              return (
                <div
                  key={plan.name}
                  className={`card-elevated relative rounded-xl border p-6 ${
                    plan.popular ? "border-accent ring-2 ring-accent" : "border-border"
                  } bg-card`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
                      Most Popular
                    </span>
                  )}
                  <h3 className="mb-1 text-lg font-semibold text-card-foreground">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-card-foreground">£{price}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <ul className="mb-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 shrink-0 text-accent" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${plan.popular ? "bg-accent text-accent-foreground hover:bg-gold-dark" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate("/signup")}
                  >
                    {plan.name === "Free" ? "Get Started Free" : "Start Trial"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="container mx-auto max-w-2xl px-4">
          <h2 className="mb-8 text-center text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b border-border pb-6">
                <h3 className="mb-2 font-semibold text-foreground">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
