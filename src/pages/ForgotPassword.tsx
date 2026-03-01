import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 hero-gradient flex-col items-center justify-center px-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(42_52%_55%/0.08),transparent_60%)]" />
        <div className="relative text-center">
          <Mail className="h-16 w-16 text-accent mx-auto mb-6" />
          <h2 className="text-3xl font-bold font-heading text-primary-foreground mb-4">
            We'll get you back in
          </h2>
          <p className="text-primary-foreground/70 max-w-sm">
            Enter your email and we'll send you a secure link to reset your password.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center bg-secondary px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">FS</span>
              </div>
              <span className="text-2xl font-bold text-foreground">FurniStudio</span>
            </Link>
            <h1 className="text-2xl font-bold font-heading text-foreground">Reset your password</h1>
            <p className="text-sm text-muted-foreground">We'll send you a link to reset it</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            {sent ? (
              <div className="text-center space-y-4">
                <p className="text-foreground">Check your email for a password reset link.</p>
                <Link to="/login">
                  <Button variant="outline" className="w-full">Back to login</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.co.uk" />
                </div>
                <Button type="submit" className="w-full bg-primary" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            )}

            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-accent hover:underline">Back to login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
