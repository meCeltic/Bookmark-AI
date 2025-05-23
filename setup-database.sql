-- Create the bookmarks table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  favicon TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up RLS (Row Level Security)
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own bookmarks
CREATE POLICY "Users can view their own bookmarks" 
  ON public.bookmarks FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own bookmarks
CREATE POLICY "Users can insert their own bookmarks" 
  ON public.bookmarks FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own bookmarks
CREATE POLICY "Users can update their own bookmarks" 
  ON public.bookmarks FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own bookmarks
CREATE POLICY "Users can delete their own bookmarks" 
  ON public.bookmarks FOR DELETE 
  USING (auth.uid() = user_id);
