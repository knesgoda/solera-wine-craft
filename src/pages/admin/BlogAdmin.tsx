import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, Plus, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useNavigate } from "react-router-dom";

const CATEGORIES = [
  "Winery Management",
  "Harvest & Vineyard",
  "Cellar & Production",
  "Technology & AI",
  "Compliance & TTB",
  "Business & Finance",
  "Winemaking Tips",
];

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_markdown: string;
  author_name: string;
  category: string;
  tags_array: string[];
  published: boolean;
  published_at: string | null;
  reading_time_minutes: number;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  featured: boolean;
  created_at: string;
  updated_at: string;
};

export default function BlogAdmin() {
  const { isAtLeast } = useRoleAccess();
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  if (!isAtLeast("owner")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-display font-bold text-foreground">Not Authorized</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const verifyPassword = async () => {
    try {
      const response = await supabase.functions.invoke("verify-admin", {
        body: { password },
      });
      if (response.data?.verified) {
        setAuthenticated(true);
        loadPosts();
      } else {
        toast.error("Invalid password");
      }
    } catch {
      toast.error("Verification failed");
    }
  };

  const loadPosts = async () => {
    try {
      const response = await supabase.functions.invoke("verify-admin", {
        body: { password, action: "list-posts" },
      });
      if (response.data?.posts) {
        setPosts(response.data.posts);
      }
    } catch {
      toast.error("Failed to load posts");
    }
  };

  const savePost = async (post: Partial<BlogPost> & { id?: string }) => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("verify-admin", {
        body: { password, action: post.id ? "update-post" : "create-post", post },
      });
      if (response.data?.success) {
        toast.success(post.id ? "Post updated" : "Post created");
        setEditing(null);
        loadPosts();
      } else {
        toast.error(response.data?.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save post");
    }
    setLoading(false);
  };

  const togglePublish = async (post: BlogPost) => {
    await savePost({
      id: post.id,
      published: !post.published,
      published_at: !post.published ? new Date().toISOString() : post.published_at,
    });
  };

  const deletePost = async (id: string) => {
    if (!confirm("Delete this post permanently?")) return;
    try {
      await supabase.functions.invoke("verify-admin", {
        body: { password, action: "delete-post", postId: id },
      });
      toast.success("Post deleted");
      loadPosts();
    } catch {
      toast.error("Failed to delete");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SEOHead title="Blog Admin" noIndex />
        <div className="w-full max-w-sm p-8 bg-card rounded-xl border border-border shadow-lg">
          <h1 className="font-display text-2xl font-bold text-foreground mb-6 text-center">Blog Admin</h1>
          <div className="space-y-4">
            <div>
              <Label>Admin Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
                placeholder="Enter admin password"
              />
            </div>
            <Button onClick={verifyPassword} className="w-full bg-primary text-primary-foreground">
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <PostEditor
        post={editing}
        onSave={savePost}
        onCancel={() => setEditing(null)}
        loading={loading}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Blog Admin" noIndex />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground">Blog Admin</h1>
          <Button
            onClick={() =>
              setEditing({
                id: "",
                slug: "",
                title: "",
                excerpt: "",
                content_markdown: "",
                author_name: "Kevin Nesgoda",
                category: "Winery Management",
                tags_array: [],
                published: false,
                published_at: null,
                reading_time_minutes: 5,
                meta_title: null,
                meta_description: null,
                og_image_url: null,
                featured: false,
                created_at: "",
                updated_at: "",
              })
            }
            className="bg-primary text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-1" /> New Post
          </Button>
        </div>

        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground truncate">{post.title}</h3>
                  {post.featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>/{post.slug}</span>
                  <Badge variant={post.published ? "default" : "outline"} className="text-xs">
                    {post.published ? "Published" : "Draft"}
                  </Badge>
                  <span>{post.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(post)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => togglePublish(post)}>
                  {post.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deletePost(post.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No posts yet. Create your first one!</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PostEditor({
  post, onSave, onCancel, loading, showPreview, setShowPreview,
}: {
  post: BlogPost;
  onSave: (p: Partial<BlogPost> & { id?: string }) => void;
  onCancel: () => void;
  loading: boolean;
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;
}) {
  const [form, setForm] = useState({ ...post });
  const [tagsInput, setTagsInput] = useState(post.tags_array?.join(", ") || "");

  const handleSave = () => {
    if (!form.title || !form.slug) {
      toast.error("Title and slug are required");
      return;
    }
    onSave({
      ...form,
      id: post.id || undefined,
      tags_array: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
    });
  };

  const generateSlug = () => {
    const slug = form.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setForm({ ...form, slug });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Edit Post — Blog Admin" noIndex />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? "Edit" : "Preview"}
            </Button>
            <Button onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {showPreview ? (
          <div className="prose prose-lg max-w-none bg-card p-8 rounded-xl border border-border prose-headings:font-display">
            <h1>{form.title}</h1>
            <ReactMarkdown>{form.content_markdown}</ReactMarkdown>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <Label>Slug</Label>
                <div className="flex gap-2">
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                  <Button variant="outline" onClick={generateSlug} type="button">Auto</Button>
                </div>
              </div>
              <div><Label>Excerpt</Label><Textarea value={form.excerpt || ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={3} /></div>
              <div>
                <Label>Content (Markdown)</Label>
                <Textarea value={form.content_markdown} onChange={(e) => setForm({ ...form, content_markdown: e.target.value })} rows={20} className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Author</Label><Input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} /></div>
              <div><Label>Tags (comma-separated)</Label><Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} /></div>
              <div><Label>Reading Time (minutes)</Label><Input type="number" value={form.reading_time_minutes} onChange={(e) => setForm({ ...form, reading_time_minutes: parseInt(e.target.value) || 5 })} /></div>
              <div><Label>Meta Title</Label><Input value={form.meta_title || ""} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} /></div>
              <div><Label>Meta Description</Label><Textarea value={form.meta_description || ""} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} rows={2} /></div>
              <div><Label>OG Image URL</Label><Input value={form.og_image_url || ""} onChange={(e) => setForm({ ...form, og_image_url: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /><Label>Featured Post</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v, published_at: v && !form.published_at ? new Date().toISOString() : form.published_at })} /><Label>Published</Label></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
