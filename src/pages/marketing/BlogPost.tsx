import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead, buildBlogPostSchema } from "@/components/SEOHead";
import { format } from "date-fns";
import { Clock, User, ArrowLeft, Twitter, Linkedin, Link2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: relatedPosts = [] } = useQuery({
    queryKey: ["blog-related", post?.category, post?.id],
    enabled: !!post,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .eq("category", post!.category)
        .neq("id", post!.id)
        .order("published_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  // Extract H2 headings for TOC
  const headings = useMemo(() => {
    if (!post?.content_markdown) return [];
    const matches = post.content_markdown.match(/^## (.+)$/gm);
    if (!matches) return [];
    return matches.map((h) => {
      const text = h.replace(/^## /, "");
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return { text, id };
    });
  }, [post?.content_markdown]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  const shareUrl = typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "";
  const shareTitle = encodeURIComponent(post?.title || "");

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-foreground mb-4">Post Not Found</h1>
        <p className="text-muted-foreground mb-6">The article you're looking for may have been moved or doesn't exist.</p>
        <Link to="/blog">
          <Button variant="outline">Browse All Posts</Button>
        </Link>
      </div>
    );
  }

  const ogImageUrl = post.og_image_url ||
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-image?title=${encodeURIComponent(post.title)}&description=${encodeURIComponent(post.excerpt || "")}`;

  return (
    <>
      <SEOHead
        title={post.meta_title || `${post.title} — Solera Blog`}
        description={post.meta_description || post.excerpt || ""}
        canonicalUrl={`https://solera.vin/blog/${post.slug}`}
        ogImage={ogImageUrl}
        ogType="article"
        jsonLd={buildBlogPostSchema({
          title: post.title,
          description: post.excerpt || "",
          slug: post.slug,
          publishedAt: post.published_at || post.created_at,
          author: post.author_name,
          image: ogImageUrl,
        })}
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Blog", url: "https://solera.vin/blog" },
          { name: post.title, url: `https://solera.vin/blog/${post.slug}` },
        ]}
      />

      {/* Header */}
      <section className="bg-primary py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/blog" className="inline-flex items-center gap-1 text-primary-foreground/70 hover:text-primary-foreground text-sm mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </Link>
          <Badge variant="secondary" className="mb-4">{post.category}</Badge>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-primary-foreground/80 text-sm">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" /> {post.author_name}
            </span>
            {post.published_at && (
              <span>{format(new Date(post.published_at), "MMMM d, yyyy")}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> {post.reading_time_minutes} min read
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex gap-12">
          {/* Main content */}
          <article className="flex-1 min-w-0 max-w-3xl">
            {/* Share buttons */}
            <div className="flex items-center gap-2 mb-8 pb-6 border-b border-border">
              <span className="text-sm text-muted-foreground mr-2">Share:</span>
              <a
                href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Twitter className="w-4 h-4 text-muted-foreground" />
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Linkedin className="w-4 h-4 text-muted-foreground" />
              </a>
              <button onClick={handleCopyLink} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <Link2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Markdown content */}
            <div className="prose prose-lg max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-primary prose-strong:text-foreground prose-blockquote:border-l-secondary prose-blockquote:text-muted-foreground prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-foreground/5">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => {
                    const text = String(children);
                    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                    return <h2 id={id}>{children}</h2>;
                  },
                }}
              >
                {post.content_markdown}
              </ReactMarkdown>
            </div>

            {/* Mid-article CTA */}
            <div className="my-12 p-6 rounded-xl bg-primary/5 border border-primary/20">
              <p className="font-display text-lg font-semibold text-foreground mb-2">
                Managing your winery on spreadsheets?
              </p>
              <p className="text-muted-foreground mb-4">
                Solera gives you lab tracking, cellar management, and TTB compliance in one platform — free to start.
              </p>
              <Link to="/coming-soon">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Start Free on Solera <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>

            {/* Tags */}
            {post.tags_array && post.tags_array.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
                {post.tags_array.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </article>

          {/* TOC sidebar — desktop only */}
          {headings.length > 0 && (
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky top-24">
                <h4 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                  Table of Contents
                </h4>
                <nav className="space-y-2">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className="block text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="mt-16 pt-12 border-t border-border">
            <h2 className="font-display text-2xl font-bold text-foreground mb-8">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.id}
                  to={`/blog/${rp.slug}`}
                  className="group rounded-xl border border-border bg-card p-5 hover:shadow-lg transition-shadow"
                >
                  <Badge variant="outline" className="mb-2 text-xs">
                    {rp.category}
                  </Badge>
                  <h3 className="font-display font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {rp.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {rp.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
