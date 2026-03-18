
-- Blog posts table
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text,
  content_markdown text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT 'Kevin Nesgoda',
  category text NOT NULL DEFAULT 'Winery Management',
  tags_array text[] NOT NULL DEFAULT '{}',
  published boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reading_time_minutes integer NOT NULL DEFAULT 5,
  meta_title text,
  meta_description text,
  og_image_url text,
  featured boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public can read published posts
CREATE POLICY "Anyone can read published blog posts"
  ON public.blog_posts FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Service role full access for admin
CREATE POLICY "Service role full access on blog_posts"
  ON public.blog_posts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
