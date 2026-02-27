
-- Create folders table for organizing projects
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Folder',
  color TEXT DEFAULT '#6366f1',
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders" ON public.folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own folders" ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE USING (auth.uid() = user_id);

-- Add folder_id to images table
ALTER TABLE public.images ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

-- Add folder_id to jobs table
ALTER TABLE public.jobs ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

-- Add folder_id to product_sets table
ALTER TABLE public.product_sets ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster folder lookups
CREATE INDEX idx_images_folder_id ON public.images(folder_id);
CREATE INDEX idx_jobs_folder_id ON public.jobs(folder_id);
CREATE INDEX idx_product_sets_folder_id ON public.product_sets(folder_id);
CREATE INDEX idx_folders_user_id ON public.folders(user_id);
CREATE INDEX idx_folders_parent_id ON public.folders(parent_id);
