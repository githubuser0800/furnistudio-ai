import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/layout/Navbar";
import { Upload, Image as ImageIcon, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserImage {
  id: string;
  filename: string;
  original_url: string | null;
  created_at: string;
}

interface Profile {
  credits_remaining: number;
  subscription_tier: string;
}

export default function Dashboard() {
  const [images, setImages] = useState<UserImage[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profileData }, { data: imagesData }] = await Promise.all([
      supabase.from("profiles").select("credits_remaining, subscription_tier").eq("id", user.id).single(),
      supabase.from("images").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    if (profileData) setProfile(profileData);
    if (imagesData) setImages(imagesData);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("furniture-images").upload(filePath, file);
      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        continue;
      }
      await supabase.from("images").insert({
        user_id: user.id,
        filename: file.name,
        original_url: filePath,
      });
    }
    setUploading(false);
    fetchData();
    toast({ title: "Upload complete", description: `${files.length} image(s) uploaded.` });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { icon: typeof Clock; label: string; className: string }> = {
      pending: { icon: Clock, label: "Pending", className: "bg-muted text-muted-foreground" },
      processing: { icon: AlertCircle, label: "Processing", className: "bg-accent/20 text-accent" },
      completed: { icon: CheckCircle, label: "Completed", className: "bg-green-100 text-green-700" },
    };
    const s = map[status] || map.pending;
    return (
      <Badge variant="secondary" className={s.className}>
        <s.icon className="mr-1 h-3 w-3" /> {s.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Upload and manage your furniture images</p>
          </div>
          {profile && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="px-3 py-1 text-sm">
                {profile.credits_remaining} credits remaining
              </Badge>
              <Badge className="bg-accent text-accent-foreground capitalize px-3 py-1">
                {profile.subscription_tier}
              </Badge>
            </div>
          )}
        </div>

        {/* Upload Zone */}
        <div
          className={`mb-10 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
            dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Upload className={`mb-4 h-10 w-10 ${dragOver ? "text-accent" : "text-muted-foreground"}`} />
          <p className="mb-1 text-lg font-medium text-foreground">
            {uploading ? "Uploading..." : "Drop furniture images here or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground">JPG, PNG, WebP up to 10MB each</p>
        </div>

        {/* Images Grid */}
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">No images yet</p>
            <p className="text-sm text-muted-foreground/60">Upload your first furniture photo to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {images.map((img) => (
              <div key={img.id} className="card-elevated group overflow-hidden rounded-xl border border-border bg-card">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-card-foreground">{img.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(img.created_at).toLocaleDateString("en-GB")}
                  </p>
                  {statusBadge("pending")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
