import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Shield, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  { q: "What image formats are supported?", a: "We support JPEG, PNG, and WebP uploads. Processed images are delivered in high-quality PNG format at up to 4K resolution." },
  { q: "How does the credits system work?", a: "Each image generation costs 1 credit. Upscaling and edits also cost 1 credit each. Credits refresh at the start of each billing cycle." },
  { q: "Is there an API for bulk processing?", a: "Yes, our Business plan includes full API access for integrating FurniStudio into your existing workflow." },
  { q: "Do credits roll over?", a: "Credits do not roll over to the next month. They refresh at the start of each billing cycle." },
  { q: "Can I upgrade or downgrade?", a: "Yes, you can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the next billing cycle." },
  { q: "Is there a free trial?", a: "The Free plan gives you 10 images per month forever — no credit card required. You can upgrade anytime when you need more." },
];

const COMPARISON_FEATURES = [
  { label: "Images per month", free: "10", starter: "50", pro: "200", business: "600" },
  { label: "Max resolution", free: "1K", starter: "2K", pro: "4K", business: "4K" },
  { label: "Room scenes", free: false, starter: true, pro: true, business: true },
  { label: "Batch processing", free: false, starter: false, pro: true, business: true },
  { label: "Fabric variants", free: false, starter: false, pro: true, business: true },
  { label: "Image upscaling", free: false, starter: true, pro: true, business: true },
  { label: "Custom prompts", free: false, starter: true, pro: true, business: true },
  { label: "API access", free: false, starter: false, pro: false, business: true },
  { label: "Custom branding", free: false, starter: false, pro: false, business: true },
  { label: "Priority support", free: false, starter: true, pro: true, business: true },
];

const trustSignals = [
  "30-day money-back guarantee",
  "Cancel anytime",
  "No hidden fees",
  "Secure checkout",
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
            <h1 className="mb-3 text-4xl font-bold font-heading text-foreground">Pricing</h1>
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

          {/* Trust signals */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            {trustSignals.map((s) => (
              <div key={s} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-accent" />
                {s}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="border-t border-border py-16 bg-secondary">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-2xl font-bold font-heading text-foreground">Compare Plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">Feature</th>
                  {["Free", "Starter", "Pro", "Business"].map((name) => (
                    <th key={name} className="py-3 px-4 text-center text-sm font-semibold text-foreground">{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((row) => (
                  <tr key={row.label} className="border-b border-border/50">
                    <td className="py-3 px-4 text-sm text-foreground">{row.label}</td>
                    {(["free", "starter", "pro", "business"] as const).map((tier) => {
                      const val = row[tier];
                      return (
                        <td key={tier} className="py-3 px-4 text-center text-sm">
                          {typeof val === "boolean" ? (
                            val ? <Check className="h-4 w-4 text-accent mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                          ) : (
                            <span className="font-medium text-foreground">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ with Accordion */}
      <section className="py-16">
        <div className="container mx-auto max-w-2xl px-4">
          <h2 className="mb-8 text-center text-2xl font-bold font-heading text-foreground">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl border border-border bg-card px-4">
                <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border bg-secondary py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-3 text-2xl font-bold font-heading text-foreground">Not sure? Start free and upgrade anytime</h2>
          <p className="mb-6 text-muted-foreground">No credit card required. 10 free images every month.</p>
          <div className="flex flex-wrap justify-center gap-4">
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
              onClick={() => window.location.href = "mailto:hello@furnistudio.ai?subject=Enterprise%20Enquiry"}
            >
              Enterprise? Contact us
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
