import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface Profile {
  full_name: string;
  email: string;
  company_name: string;
  default_resolution: string;
  default_template: string | null;
  subscription_tier: string;
  credits_remaining: number;
}

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const defaultTab = searchParams.get("tab") || "profile";

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data as Profile);
    })();
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!profile) return false;
    if (!profile.full_name?.trim()) errs.full_name = "Name is required";
    if (profile.full_name && profile.full_name.length > 100) errs.full_name = "Max 100 characters";
    if (profile.company_name && profile.company_name.length > 100) errs.company_name = "Max 100 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!profile || !validate()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name.trim(),
      company_name: profile.company_name?.trim() || null,
      default_resolution: profile.default_resolution,
      default_template: profile.default_template,
    }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved" });
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold font-heading text-foreground">Settings</h1>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="space-y-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={profile.full_name || ""}
                    onChange={(e) => { setProfile({ ...profile, full_name: e.target.value }); setErrors((prev) => ({ ...prev, full_name: "" })); }}
                    maxLength={100}
                  />
                  {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={profile.email || ""} disabled className="bg-muted" />
                </div>
                <div>
                  <Label>Company Name</Label>
                  <Input
                    value={profile.company_name || ""}
                    onChange={(e) => { setProfile({ ...profile, company_name: e.target.value }); setErrors((prev) => ({ ...prev, company_name: "" })); }}
                    placeholder="Your furniture company"
                    maxLength={100}
                  />
                  {errors.company_name && <p className="text-xs text-destructive mt-1">{errors.company_name}</p>}
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-gold-dark">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="space-y-4">
                <div>
                  <Label>Default Resolution</Label>
                  <Select value={profile.default_resolution} onValueChange={(v) => setProfile({ ...profile, default_resolution: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1k">1K</SelectItem>
                      <SelectItem value="2k">2K</SelectItem>
                      <SelectItem value="4k">4K</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default Style Template</Label>
                  <Select value={profile.default_template || "modern"} onValueChange={(v) => setProfile({ ...profile, default_template: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Modern Living Room</SelectItem>
                      <SelectItem value="scandinavian">Scandinavian</SelectItem>
                      <SelectItem value="industrial">Industrial Loft</SelectItem>
                      <SelectItem value="minimal">Minimal White</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>Auto-upscale all exports</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Automatically upscale when downloading (costs extra credits per download)</p>
                  </div>
                  <Switch
                    checked={localStorage.getItem("furnistudio_auto_upscale") === "true"}
                    onCheckedChange={(c) => {
                      localStorage.setItem("furnistudio_auto_upscale", c ? "true" : "false");
                      toast({ title: c ? "Auto-upscale enabled" : "Auto-upscale disabled" });
                    }}
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-gold-dark">
                  {saving ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="billing" className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="text-xl font-bold capitalize text-foreground">{profile.subscription_tier}</p>
                </div>
                <Badge className="bg-accent text-accent-foreground px-3 py-1">
                  {profile.credits_remaining} credits
                </Badge>
              </div>
              <Button variant="outline" onClick={() => navigate("/pricing")}>Upgrade Plan</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
