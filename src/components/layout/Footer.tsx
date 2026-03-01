import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function Footer() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({ title: "Subscribed!", description: "You'll receive our latest updates." });
    setEmail("");
  };

  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                <span className="text-xs font-bold text-accent-foreground">FS</span>
              </div>
              <span className="text-lg font-bold">FurniStudio</span>
            </div>
            <p className="text-sm text-primary-foreground/70 mb-4">
              AI-powered furniture photography for UK retailers.
            </p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-primary-foreground/20 px-2.5 py-0.5 text-xs text-primary-foreground/60">
                Made in the UK
              </span>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Product</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li><Link to="/pricing" className="hover:text-primary-foreground transition-colors">Pricing</Link></li>
              <li><Link to="/signup" className="hover:text-primary-foreground transition-colors">Get Started</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li><a href="mailto:hello@furnistudio.ai" className="hover:text-primary-foreground transition-colors">Contact</a></li>
              <li><a href="mailto:hello@furnistudio.ai?subject=Privacy%20Policy" className="hover:text-primary-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="mailto:hello@furnistudio.ai?subject=Terms%20of%20Service" className="hover:text-primary-foreground transition-colors">Terms of Service</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Stay Updated</h4>
            <form onSubmit={handleNewsletter} className="flex gap-2">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 h-9 text-sm"
              />
              <Button type="submit" size="sm" className="bg-accent text-accent-foreground hover:bg-gold-dark shrink-0 h-9">
                Subscribe
              </Button>
            </form>
          </div>
        </div>
        <div className="mt-8 border-t border-primary-foreground/10 pt-6 text-center text-sm text-primary-foreground/50">
          © {new Date().getFullYear()} FurniStudio. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
