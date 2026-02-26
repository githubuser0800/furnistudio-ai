
-- Add favorite_templates and recent_templates to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_templates text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recent_templates text[] DEFAULT '{}';

-- Add camera_angle column to jobs for tracking
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS camera_angle text,
  ADD COLUMN IF NOT EXISTS resolution text DEFAULT '1k';

-- Allow users to update their own jobs (for status tracking)
CREATE POLICY "Users can update own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow users to delete own jobs
CREATE POLICY "Users can delete own jobs"
  ON public.jobs FOR DELETE
  USING (auth.uid() = user_id);
