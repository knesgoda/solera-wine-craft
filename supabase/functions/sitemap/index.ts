import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: posts } = await supabase
      .from("blog_posts")
      .select("slug, published_at, updated_at")
      .eq("published", true)
      .order("published_at", { ascending: false });

    const baseUrl = "https://solera.vin";
    const now = new Date().toISOString().slice(0, 10);

    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "weekly" },
      { loc: "/features", priority: "0.9", changefreq: "monthly" },
      { loc: "/pricing", priority: "0.9", changefreq: "monthly" },
      { loc: "/compare", priority: "0.8", changefreq: "monthly" },
      { loc: "/about", priority: "0.7", changefreq: "monthly" },
      { loc: "/faq", priority: "0.7", changefreq: "monthly" },
      { loc: "/changelog", priority: "0.6", changefreq: "weekly" },
      { loc: "/privacy", priority: "0.3", changefreq: "yearly" },
      { loc: "/terms", priority: "0.3", changefreq: "yearly" },
      { loc: "/blog", priority: "0.8", changefreq: "weekly" },
      { loc: "/contact", priority: "0.6", changefreq: "monthly" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

    for (const page of staticPages) {
      xml += `  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    }

    for (const post of (posts || [])) {
      const lastmod = (post.updated_at || post.published_at || now).slice(0, 10);
      xml += `  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    xml += `</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders,
      },
    });
  } catch (e) {
    console.error("sitemap error:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
});
