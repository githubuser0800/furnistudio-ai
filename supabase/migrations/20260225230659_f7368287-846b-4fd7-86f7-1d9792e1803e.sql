
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company_name TEXT,
  credits_remaining INTEGER NOT NULL DEFAULT 10,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  default_resolution TEXT DEFAULT '1k',
  default_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create images table
CREATE TABLE public.images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url TEXT,
  filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own images" ON public.images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own images" ON public.images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own images" ON public.images
  FOR DELETE USING (auth.uid() = user_id);

-- Create jobs table
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_id UUID REFERENCES public.images(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  template_id TEXT,
  output_url TEXT,
  credits_used INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON public.jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for furniture images
INSERT INTO storage.buckets (id, name, public) VALUES ('furniture-images', 'furniture-images', false);

CREATE POLICY "Users can upload own images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'furniture-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own images" ON storage.objects
  FOR SELECT USING (bucket_id = 'furniture-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own images" ON storage.objects
  FOR DELETE USING (bucket_id = 'furniture-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
