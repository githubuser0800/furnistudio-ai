import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Mitchell",
    company: "Mitchell & Sons Furniture",
    quote: "FurniStudio saved us thousands on photography. We went from 2-day photoshoots to listing products the same day they arrive in the warehouse.",
    stars: 5,
  },
  {
    name: "James Thornton",
    company: "Thornton Living",
    quote: "The room scenes look so realistic our customers think we have a showroom. Conversion rates on our eBay listings jumped 34% in the first month.",
    stars: 5,
  },
  {
    name: "Emma Clarke",
    company: "Clarke Interiors",
    quote: "Batch processing 50 products in one sitting is a game-changer. What used to take our team a full week now takes an afternoon.",
    stars: 5,
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 md:py-28 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <h2 className="mb-3 text-3xl font-bold font-heading text-foreground md:text-4xl">
            Trusted by UK Furniture Retailers
          </h2>
          <p className="text-muted-foreground">
            See what our customers are saying.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className="card-elevated rounded-xl border border-border bg-card p-6 opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, s) => (
                  <Star key={s} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
              <blockquote className="mb-4 text-sm text-card-foreground leading-relaxed">
                "{t.quote}"
              </blockquote>
              <div>
                <p className="text-sm font-semibold text-card-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.company}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
