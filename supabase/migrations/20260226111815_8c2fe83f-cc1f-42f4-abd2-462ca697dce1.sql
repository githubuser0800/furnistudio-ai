
-- Product sets table for grouping batch-processed images
CREATE TABLE public.product_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Set',
  template_id text,
  resolution text DEFAULT '1k',
  image_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.product_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sets" ON public.product_sets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sets" ON public.product_sets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sets" ON public.product_sets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sets" ON public.product_sets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_product_sets_updated_at
  BEFORE UPDATE ON public.product_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add set_id and label columns to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS set_id uuid REFERENCES public.product_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label text;

-- Add label column to images for user-provided labels
ALTER TABLE public.images
  ADD COLUMN IF NOT EXISTS label text;
