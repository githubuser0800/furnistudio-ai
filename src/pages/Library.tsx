import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Image as ImageIcon,
  Download,
  Trash2,
  Sparkles,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  Package,
  Pencil,
  Check,
  FolderPlus,
  Folder,
  FolderOpen,
  ArrowLeft,
  Search,
  Clock,
  MoreHorizontal,
  Palette,
  X,
} from "lucide-react";
import ExportModal from "@/components/dashboard/ExportModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FolderItem {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  created_at: string;
  imageCount: number;
  jobCount: number;
}

interface UploadedImage {
  id: string;
  filename: string;
  original_url: string | null;
  created_at: string;
  folder_id: string | null;
  generation_count?: number;
}

interface GeneratedImage {
  id: string;
  created_at: string;
  template_id: string | null;
  output_url: string | null;
  image_id: string | null;
  credits_used: number;
  status: string;
  set_id: string | null;
  label: string | null;
  folder_id: string | null;
}

interface ProductSet {
  id: string;
  name: string;
  template_id: string | null;
  image_count: number;
  created_at: string;
  folder_id: string | null;
  jobs: GeneratedImage[];
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

const FOLDER_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#64748b",
];

export default function Library() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedImage[]>([]);
  const [generated, setGenerated] = useState<GeneratedImage[]>([]);
  const [productSets, setProductSets] = useState<ProductSet[]>([]);
  const [uploadUrls, setUploadUrls] = useState<Record<string, string>>({});
  const [generatedUrls, setGeneratedUrls] = useState<Record<string, string>>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState<{ type: "folder" | "set"; id: string } | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [exportImage, setExportImage] = useState<{ url: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("New Folder");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [recentImages, setRecentImages] = useState<Array<{ id: string; url: string; name: string; type: "upload" | "generated" }>>([]);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: foldersData }, { data: imagesData }, { data: jobsData }, { data: setsData }] = await Promise.all([
      supabase.from("folders" as any).select("*").eq("user_id", user.id).order("name"),
      supabase.from("images").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("jobs").select("*").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }),
      supabase.from("product_sets" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    // Build folder items with counts
    const allImages = (imagesData || []) as UploadedImage[];
    const allJobs = (jobsData || []) as GeneratedImage[];

    if (foldersData) {
      const folderItems: FolderItem[] = (foldersData as any[]).map((f) => ({
        ...f,
        color: f.color || FOLDER_COLORS[0],
        imageCount: allImages.filter((i) => (i as any).folder_id === f.id).length,
        jobCount: allJobs.filter((j) => (j as any).folder_id === f.id).length,
      }));
      setFolders(folderItems);
    }

    // Generation counts
    const genCounts: Record<string, number> = {};
    allJobs.forEach((j) => {
      if (j.image_id) genCounts[j.image_id] = (genCounts[j.image_id] || 0) + 1;
    });

    // Filter by current folder
    const filteredImages = allImages
      .filter((i) => (i as any).folder_id === currentFolderId)
      .map((img) => ({ ...img, generation_count: genCounts[img.id] || 0 }));
    setUploads(filteredImages);

    const standaloneJobs = allJobs.filter((j) => !j.set_id && (j as any).folder_id === currentFolderId);
    setGenerated(standaloneJobs);

    // Product sets in current folder
    if (setsData) {
      const sets: ProductSet[] = (setsData as any[])
        .filter((s) => s.folder_id === currentFolderId)
        .map((s) => ({
          ...s,
          jobs: allJobs.filter((j) => j.set_id === s.id),
        }));
      setProductSets(sets);
    }

    // Sign URLs for filtered images
    const uploadPaths = filteredImages.filter((i) => i.original_url).map((i) => i.original_url!);
    if (uploadPaths.length > 0) {
      const { data: signed } = await supabase.storage.from("furniture-images").createSignedUrls(uploadPaths, 3600);
      if (signed) {
        const map: Record<string, string> = {};
        filteredImages.forEach((img) => {
          const s = signed.find((si) => si.path === img.original_url);
          if (s?.signedUrl) map[img.id] = s.signedUrl;
        });
        setUploadUrls(map);
      }
    } else {
      setUploadUrls({});
    }

    const allOutputPaths = [...standaloneJobs, ...((setsData as any[]) || []).flatMap((s: any) => allJobs.filter((j) => j.set_id === s.id))]
      .filter((j) => j.output_url)
      .map((j) => j.output_url!);
    if (allOutputPaths.length > 0) {
      const { data: signed } = await supabase.storage.from("furniture-images").createSignedUrls(allOutputPaths, 3600);
      if (signed) {
        const map: Record<string, string> = {};
        [...standaloneJobs, ...allJobs].forEach((j) => {
          const s = signed.find((si) => si.path === j.output_url);
          if (s?.signedUrl) map[j.id] = s.signedUrl;
        });
        setGeneratedUrls(map);
      }
    } else {
      setGeneratedUrls({});
    }

    // Recent images (last 10 across all folders)
    const recentUploads = allImages.slice(0, 5);
    const recentJobs = allJobs.slice(0, 5);
    const recentUploadPaths = recentUploads.filter((i) => i.original_url).map((i) => i.original_url!);
    const recentJobPaths = recentJobs.filter((j) => j.output_url).map((j) => j.output_url!);
    const allRecentPaths = [...recentUploadPaths, ...recentJobPaths];
    if (allRecentPaths.length > 0) {
      const { data: signed } = await supabase.storage.from("furniture-images").createSignedUrls(allRecentPaths, 3600);
      if (signed) {
        const recent: Array<{ id: string; url: string; name: string; type: "upload" | "generated" }> = [];
        recentUploads.forEach((img) => {
          const s = signed.find((si) => si.path === img.original_url);
          if (s?.signedUrl) recent.push({ id: img.id, url: s.signedUrl, name: img.filename, type: "upload" });
        });
        recentJobs.forEach((j) => {
          const s = signed.find((si) => si.path === j.output_url);
          if (s?.signedUrl) recent.push({ id: j.id, url: s.signedUrl, name: j.label || TEMPLATE_NAMES[j.template_id || ""] || "Generated", type: "generated" });
        });
        setRecentImages(recent.slice(0, 10));
      }
    }
  }, [currentFolderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateFolder = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("folders" as any).insert({
      user_id: user.id,
      name: newFolderName.trim() || "New Folder",
      color: newFolderColor,
      parent_id: currentFolderId,
    } as any);
    setShowNewFolder(false);
    setNewFolderName("New Folder");
    fetchData();
    toast({ title: "Folder created" });
  };

  const handleRename = async () => {
    if (!editingName || !editNameValue.trim()) return;
    if (editingName.type === "folder") {
      await supabase.from("folders" as any).update({ name: editNameValue.trim() } as any).eq("id", editingName.id);
    } else {
      await supabase.from("product_sets" as any).update({ name: editNameValue.trim() } as any).eq("id", editingName.id);
    }
    setEditingName(null);
    fetchData();
  };

  const handleDeleteFolder = async (folderId: string) => {
    // Move contents to parent (unfiled)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Use raw queries to update folder_id since it's not yet in generated types
    const supabaseAny = supabase as any;
    await Promise.all([
      supabaseAny.from("images").update({ folder_id: null }).eq("folder_id", folderId),
      supabaseAny.from("jobs").update({ folder_id: null }).eq("folder_id", folderId),
      supabaseAny.from("product_sets").update({ folder_id: null }).eq("folder_id", folderId),
    ]);
    await supabase.from("folders" as any).delete().eq("id", folderId);
    if (currentFolderId === folderId) setCurrentFolderId(null);
    fetchData();
    toast({ title: "Folder deleted" });
  };

  const handleChangeFolderColor = async (folderId: string, color: string) => {
    await supabase.from("folders" as any).update({ color } as any).eq("id", folderId);
    fetchData();
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;
    const ids = Array.from(selectedItems);
    await supabase.from("images").delete().in("id", ids);
    setSelectedItems(new Set());
    fetchData();
    toast({ title: `${ids.length} item(s) deleted` });
  };

  const handleMoveToFolder = async (targetFolderId: string | null) => {
    if (selectedItems.size === 0) return;
    const ids = Array.from(selectedItems);
    await (supabase as any).from("images").update({ folder_id: targetFolderId }).in("id", ids);
    setSelectedItems(new Set());
    fetchData();
    toast({ title: `Moved ${ids.length} item(s)` });
  };

  const handleDownloadSet = async (set: ProductSet) => {
    for (const job of set.jobs) {
      if (generatedUrls[job.id]) {
        try {
          const resp = await fetch(generatedUrls[job.id]);
          const blob = await resp.blob();
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${set.name}-${job.label || job.id.slice(0, 6)}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch { /* skip */ }
      }
    }
  };

  // Filter by search
  const filteredUploads = searchQuery
    ? uploads.filter((u) => u.filename.toLowerCase().includes(searchQuery.toLowerCase()))
    : uploads;

  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const childFolders = folders.filter((f) => f.parent_id === currentFolderId);
  const breadcrumb: FolderItem[] = [];
  if (currentFolder) {
    let f: FolderItem | undefined = currentFolder;
    while (f) {
      breadcrumb.unshift(f);
      f = folders.find((p) => p.id === f!.parent_id);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Projects</h1>
            <p className="text-sm text-muted-foreground">
              {folders.length} folders · {uploads.length} images in current view
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48 h-9"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowNewFolder(true)}>
              <FolderPlus className="mr-1.5 h-4 w-4" /> New Folder
            </Button>
          </div>
        </div>

        {/* New Folder Dialog */}
        {showNewFolder && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-1 h-9"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
              <div className="flex gap-1">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewFolderColor(c)}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${newFolderColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button size="sm" onClick={handleCreateFolder}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-1 text-sm">
          <button
            onClick={() => setCurrentFolderId(null)}
            className={`px-2 py-1 rounded-md transition-colors ${!currentFolderId ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            My Projects
          </button>
          {breadcrumb.map((f) => (
            <div key={f.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                onClick={() => setCurrentFolderId(f.id)}
                className={`px-2 py-1 rounded-md transition-colors ${currentFolderId === f.id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f.name}
              </button>
            </div>
          ))}
        </div>

        {/* Selection Actions Bar */}
        {selectedItems.size > 0 && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <span className="text-sm text-muted-foreground">{selectedItems.size} selected</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Folder className="mr-1 h-3 w-3" /> Move to...
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleMoveToFolder(null)}>
                  📁 Root (unfiled)
                </DropdownMenuItem>
                {folders.map((f) => (
                  <DropdownMenuItem key={f.id} onClick={() => handleMoveToFolder(f.id)}>
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: f.color }} />
                    {f.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="destructive" onClick={handleDeleteSelected}>
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedItems(new Set())}>Clear</Button>
          </div>
        )}

        {/* Recent Section (only at root) */}
        {!currentFolderId && !searchQuery && recentImages.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Recent
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {recentImages.map((img) => (
                <div key={img.id} className="shrink-0 w-20 rounded-lg border border-border overflow-hidden">
                  <div className="aspect-square">
                    <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-1">
                    <p className="text-[9px] text-muted-foreground truncate">{img.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Folders Grid */}
        {childFolders.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Folders</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {childFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="group rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-accent/50 transition-all"
                  onClick={() => setCurrentFolderId(folder.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <FolderOpen className="h-8 w-8" style={{ color: folder.color }} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => { setEditingName({ type: "folder", id: folder.id }); setEditNameValue(folder.name); }}>
                          <Pencil className="mr-2 h-3 w-3" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <DropdownMenuItem>
                              <Palette className="mr-2 h-3 w-3" /> Color
                            </DropdownMenuItem>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <div className="flex gap-1 p-2">
                              {FOLDER_COLORS.map((c) => (
                                <button
                                  key={c}
                                  onClick={() => handleChangeFolderColor(folder.id, c)}
                                  className="h-5 w-5 rounded-full border border-border"
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFolder(folder.id)}>
                          <Trash2 className="mr-2 h-3 w-3" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {editingName?.type === "folder" && editingName.id === folder.id ? (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        className="h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleRename()}
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={handleRename}>
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-card-foreground truncate">{folder.name}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {folder.imageCount + folder.jobCount} items
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Product Sets */}
        {productSets.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-accent" /> Sets
            </h3>
            <div className="space-y-3">
              {productSets.map((set) => (
                <div key={set.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedSets((p) => { const n = new Set(p); n.has(set.id) ? n.delete(set.id) : n.add(set.id); return n; })}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    {expandedSets.has(set.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      {set.jobs[0] && generatedUrls[set.jobs[0].id] ? (
                        <img src={generatedUrls[set.jobs[0].id]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingName?.type === "set" && editingName.id === set.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} className="h-7 text-sm" autoFocus onKeyDown={(e) => e.key === "Enter" && handleRename()} />
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleRename}><Check className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-card-foreground truncate">{set.name}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{set.jobs.length} images</span>
                        <span>·</span>
                        <span>{TEMPLATE_NAMES[set.template_id || ""] || "Custom"}</span>
                        <span>·</span>
                        <span>{new Date(set.created_at).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditingName({ type: "set", id: set.id }); setEditNameValue(set.name); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleDownloadSet(set)}>
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </button>
                  {expandedSets.has(set.id) && (
                    <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {set.jobs.map((job) => (
                        <div key={job.id} className="rounded-lg border border-border overflow-hidden">
                          <div className="aspect-square bg-muted overflow-hidden">
                            {generatedUrls[job.id] ? (
                              <img src={generatedUrls[job.id]} alt={job.label || ""} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center"><Layers className="h-6 w-6 text-muted-foreground/30" /></div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium text-card-foreground truncate">{job.label || "Untitled"}</p>
                            {generatedUrls[job.id] && (
                              <Button size="sm" variant="ghost" className="mt-1 w-full text-[11px] h-6" onClick={() => setExportImage({ url: generatedUrls[job.id], name: job.label || `set-${job.id.slice(0, 6)}` })}>
                                <Download className="mr-1 h-2.5 w-2.5" /> Export
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images Grid */}
        {filteredUploads.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Images</h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredUploads.map((img) => (
                <div key={img.id} className="group relative rounded-xl border border-border bg-card overflow-hidden">
                  <div className="absolute top-2 left-2 z-10">
                    <Checkbox
                      checked={selectedItems.has(img.id)}
                      onCheckedChange={() => setSelectedItems((p) => { const n = new Set(p); n.has(img.id) ? n.delete(img.id) : n.add(img.id); return n; })}
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
                          <Sparkles className="mr-0.5 h-2.5 w-2.5" />{img.generation_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Images (standalone) */}
        {generated.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Generated</h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {generated.map((job) => (
                <div key={job.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                    {generatedUrls[job.id] ? (
                      <img src={generatedUrls[job.id]} alt="Generated" className="h-full w-full object-cover" />
                    ) : (
                      <Layers className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-card-foreground truncate">{TEMPLATE_NAMES[job.template_id || ""] || "Custom"}</p>
                    <span className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleDateString("en-GB")}</span>
                    {generatedUrls[job.id] && (
                      <Button size="sm" variant="ghost" className="mt-2 w-full text-xs" onClick={() => setExportImage({ url: generatedUrls[job.id], name: `staged-${job.id.slice(0, 8)}` })}>
                        <Download className="mr-1 h-3 w-3" /> Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {childFolders.length === 0 && filteredUploads.length === 0 && generated.length === 0 && productSets.length === 0 && (
          <div className="flex flex-col items-center py-16">
            <Folder className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              {currentFolderId ? "This folder is empty" : "No projects yet"}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">Upload images from the Dashboard to get started</p>
          </div>
        )}
      </div>

      {exportImage && (
        <ExportModal open={!!exportImage} onClose={() => setExportImage(null)} imageUrl={exportImage.url} imageName={exportImage.name} />
      )}
    </div>
  );
}
