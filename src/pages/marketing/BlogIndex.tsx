import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { format } from "date-fns";
import { Clock, ArrowRight, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  "All",
  "Winery Management",
  "Harvest & Vineyard",
  "Cellar & Production",
  "Technology & AI",
  "Compliance & TTB",
  "Business & Finance",
  "Winemaking Tips",
];

export default function BlogIndex() {
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = activeCategory === "All"
    ? posts
    : posts.filter((p) => p.category === activeCategory);

  const featured = posts.find((p) => p.featured);
  const grid = filtered.filter((p) => p.id !== featured?.id);

  return (
    <>
      <SEOHead
        title="The Solera Blog — Insights for Modern Winemakers"
        description="Expert articles on winery management, harvest planning, cellar operations, TTB compliance, and winemaking technology from the Solera team."
        canonicalUrl="https://solera.vin/blog"
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Blog", url: "https://solera.vin/blog" },
        ]}
      />

      {/* Hero */}
      <section className="bg-primary py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-primary-foreground mb-4">
            The Solera Blog
          </h1>
          <p className="text-primary-foreground/80 text-lg md:text-xl max-w-2xl mx-auto">
            Insights for Modern Winemakers
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Featured Post */}
        {featured && (
          <Link
            to={`/blog/${featured.slug}`}
            className="block mb-12 group"
          >
            <div className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-lg">
              <div className="bg-primary/5 h-48 md:h-64 flex items-center justify-center">
                <span className="text-6xl opacity-20">📝</span>
              </div>
              <div className="p-6 md:p-8">
                <Badge variant="secondary" className="mb-3">
                  {featured.category}
                </Badge>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {featured.title}
                </h2>
                <p className="text-muted-foreground mb-4 max-w-3xl">
                  {featured.excerpt}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {featured.author_name}
                  </span>
                  {featured.published_at && (
                    <span>
                      {format(new Date(featured.published_at), "MMM d, yyyy")}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {featured.reading_time_minutes} min read
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Post grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-20 mb-4" />
                <div className="h-6 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {grid.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="bg-primary/5 h-40 flex items-center justify-center">
                  <span className="text-4xl opacity-20">📝</span>
                </div>
                <div className="p-5">
                  <Badge variant="outline" className="mb-2 text-xs">
                    {post.category}
                  </Badge>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{post.author_name}</span>
                      {post.published_at && (
                        <>
                          <span>·</span>
                          <span>{format(new Date(post.published_at), "MMM d, yyyy")}</span>
                        </>
                      )}
                    </div>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.reading_time_minutes}m
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && grid.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            No posts found in this category.
          </p>
        )}
      </div>
    </>
  );
}
