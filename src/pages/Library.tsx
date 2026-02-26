import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/layout/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Image as ImageIcon,
  Download,
  Trash2,
  Sparkles,
  Calendar,
  Layers,
} from "lucide-react";
import ExportModal from "@/components/dashboard/ExportModal";

interface UploadedImage {
  id: string;
  filename: string;
  original_url: string | null;
  created_at: string;
  generation_count?: number;
}

interface GeneratedImage {
  id: string;
  created_at: string;
  template_id: string | null;
  resolution: string | null;
  output_url: string | null;
  image_id: string | null;
  credits_used: number;
  status: string;
}

const TEMPLATE_NAMES: Record<string, string> = {
  scandinavian: "Modern Scandinavian",
  contemporary_grey: "Contemporary Grey",
  cozy_british: "Cozy British",
  luxury_penthouse: "Luxury Penthouse",
  minimalist_white: "Minimalist White",
  serene_bedroom: "Serene Bedroom",
  boutique_hotel: "Boutique Hotel",
  light_airy: "Light & Airy",
  modern_dining: "Modern Dining",
  rustic_farmhouse: "Rustic Farmhouse",
  modern_office: "Modern Home Office",
  creative_studio: "Creative Studio",
  white_background: "Pure White Background",
  grey_studio: "Grey Studio",
  showroom_floor: "Showroom Floor",
  custom: "Custom Prompt",
};

export default function Library() {
  const [uploads, setUploads] = useState<UploadedImage[]>([]);
  const [generated, setGenerated] = useState<GeneratedImage[]>([]);
  const [uploadUrls, setUploadUrls] = useState<Record<string, string>>({});
  const [generatedUrls, setGeneratedUrls] = useState<Record<string, string>>({});
  const [selectedUploads, setSelectedUploads] = useState<Set<string>>(new Set());
  const [selectedGenerated, setSelectedGenerated] = useState<Set<string>>(new Set());
  const [exportImage, setExportImage] = useState<{ url: string; name: string } | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: imagesData }, { data: jobsData }] = await Promise.all([
      supabase.from("images").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("jobs").select("*").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }),
    ]);

    // Count generations per upload
    const genCounts: Record<string, number> = {};
    jobsData?.forEach((j) => {
      if (j.image_id) genCounts[j.image_id] = (genCounts[j.image_id] || 0) + 1;
    });

    if (imagesData) {
      setUploads(imagesData.map((img) => ({ ...img, generation_count: genCounts[img.id] || 0 })));
      const paths = imagesData.filter((i) => i.original_url).map((i) => i.original_url!);
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from("furniture-images").createSignedUrls(paths, 3600);
        if (signed) {
          const map: Record<string, string> = {};
          imagesData.forEach((img) => {
            const s = signed.find((si) => si.path === img.original_url);
            if (s?.signedUrl) map[img.id] = s.signedUrl;
          });
          setUploadUrls(map);
        }
      }
    }

    if (jobsData) {
      setGenerated(jobsData as GeneratedImage[]);
      const outputPaths = jobsData.filter((j) => j.output_url).map((j) => j.output_url!);
      if (outputPaths.length > 0) {
        const { data: signed } = await supabase.storage.from("furniture-images").createSignedUrls(outputPaths, 3600);
        if (signed) {
          const map: Record<string, string> = {};
          jobsData.forEach((j) => {
            const s = signed.find((si) => si.path === j.output_url);
            if (s?.signedUrl) map[j.id] = s.signedUrl;
          });
          setGeneratedUrls(map);
        }
      }
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleUploadSelection = (id: string) => {
    setSelectedUploads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGeneratedSelection = (id: string) => {
    setSelectedGenerated((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteUploads = async () => {
    if (selectedUploads.size === 0) return;
    const ids = Array.from(selectedUploads);
    const { error } = await supabase.from("images").delete().in("id", ids);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${ids.length} image(s) deleted` });
      setSelectedUploads(new Set());
      fetchData();
    }
  };

  const handleDownloadGenerated = async (url: string, name: string) => {
    setExportImage({ url, name });
  };

  const handleDirectDownload = async (url: string, filename: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Image Library</h1>
          <p className="text-sm text-muted-foreground">{uploads.length} uploads · {generated.length} generated</p>
        </div>

        <Tabs defaultValue="uploads">
          <TabsList className="mb-6">
            <TabsTrigger value="uploads">Uploads ({uploads.length})</TabsTrigger>
            <TabsTrigger value="generated">Generated ({generated.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="uploads">
            {selectedUploads.size > 0 && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className="text-sm text-muted-foreground">{selectedUploads.size} selected</span>
                <Button size="sm" variant="destructive" onClick={handleDeleteUploads}>
                  <Trash2 className="mr-1 h-3 w-3" /> Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedUploads(new Set())}>Clear</Button>
              </div>
            )}
            {uploads.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <ImageIcon className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">No uploads yet</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {uploads.map((img) => (
                  <div key={img.id} className="group relative rounded-xl border border-border bg-card overflow-hidden">
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={selectedUploads.has(img.id)}
                        onCheckedChange={() => toggleUploadSelection(img.id)}
                        className="bg-background/80"
                      />
                    </div>
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {uploadUrls[img.id] ? (
                        <img src={uploadUrls[img.id]} alt={img.filename} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-card-foreground">{img.filename}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(img.created_at).toLocaleDateString("en-GB")}
                        </span>
                        {(img.generation_count ?? 0) > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                            {img.generation_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="generated">
            {selectedGenerated.size > 0 && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className="text-sm text-muted-foreground">{selectedGenerated.size} selected</span>
                <Button size="sm" variant="ghost" onClick={() => setSelectedGenerated(new Set())}>Clear</Button>
              </div>
            )}
            {generated.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <Layers className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">No generated images yet</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {generated.map((job) => (
                  <div key={job.id} className="group relative rounded-xl border border-border bg-card overflow-hidden">
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={selectedGenerated.has(job.id)}
                        onCheckedChange={() => toggleGeneratedSelection(job.id)}
                        className="bg-background/80"
                      />
                    </div>
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {generatedUrls[job.id] ? (
                        <img src={generatedUrls[job.id]} alt="Generated" className="h-full w-full object-cover" />
                      ) : (
                        <Layers className="h-10 w-10 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-card-foreground truncate">
                        {TEMPLATE_NAMES[job.template_id || ""] || job.template_id || "Unknown"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{new Date(job.created_at).toLocaleDateString("en-GB")}</span>
                        {job.resolution && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{job.resolution}</Badge>}
                      </div>
                      {generatedUrls[job.id] && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 w-full text-xs"
                          onClick={() => handleDownloadGenerated(generatedUrls[job.id], `staged-${job.id.slice(0, 8)}.jpg`)}
                        >
                          <Download className="mr-1 h-3 w-3" /> Download
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {exportImage && (
        <ExportModal
          open={!!exportImage}
          onClose={() => setExportImage(null)}
          imageUrl={exportImage.url}
          imageName={exportImage.name}
        />
      )}
    </div>
  );
}
