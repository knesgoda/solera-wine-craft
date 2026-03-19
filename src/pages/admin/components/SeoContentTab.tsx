import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

interface Props {
  api: (action: string, payload?: any) => Promise<any>;
}

const STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  draft: { bg: "#94a3b8", label: "Draft" },
  planned: { bg: "#C8902A", label: "Planned" },
  published: { bg: "#22c55e", label: "Published" },
};

export function SeoContentTab({ api }: Props) {
  const queryClient = useQueryClient();
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [postForm, setPostForm] = useState({
    title: "", slug: "", target_keyword: "", published: false, published_at: "",
    current_ranking: 0, weekly_clicks: 0, weekly_impressions: 0, excerpt: "",
  });
  const [editingKw, setEditingKw] = useState<string | null>(null);
  const [kwForm, setKwForm] = useState({ keyword: "", target_page: "", current_ranking: 0, notes: "" });

  // Changelog / Roadmap state
  const [showChangelogDialog, setShowChangelogDialog] = useState(false);
  const [editingChangelog, setEditingChangelog] = useState<any>(null);
  const [clForm, setClForm] = useState({ version: "", released_at: "", entries_json: "[]" });
  const [showRoadmapDialog, setShowRoadmapDialog] = useState(false);
  const [editingRoadmap, setEditingRoadmap] = useState<any>(null);
  const [rmForm, setRmForm] = useState({ title: "", status: "planned", votes: 0, description: "" });

  const { data: blogData, isLoading: blogLoading } = useQuery({
    queryKey: ["admin-seo-blog"],
    queryFn: () => api("seo-blog-list"),
  });

  const { data: kwData, isLoading: kwLoading } = useQuery({
    queryKey: ["admin-keywords"],
    queryFn: () => api("admin-keywords-list"),
  });

  const { data: metricsData } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => api("admin-metrics-list"),
  });

  const { data: changelogData, isLoading: clLoading } = useQuery({
    queryKey: ["admin-changelogs"],
    queryFn: () => api("list-changelogs"),
  });

  const { data: roadmapData, isLoading: rmLoading } = useQuery({
    queryKey: ["admin-roadmap"],
    queryFn: () => api("list-roadmap"),
  });

  const saveBlogMutation = useMutation({
    mutationFn: () => {
      const payload = { ...postForm, id: editingPost?.id, published_at: postForm.published_at || null };
      return api("seo-blog-upsert", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seo-blog"] });
      toast.success(editingPost ? "Post updated" : "Post created");
      setShowPostDialog(false);
      setEditingPost(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBlogMutation = useMutation({
    mutationFn: (id: string) => api("seo-blog-delete", { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seo-blog"] });
      toast.success("Post deleted");
    },
  });

  const saveKwMutation = useMutation({
    mutationFn: () => api("admin-keywords-upsert", { id: editingKw, ...kwForm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-keywords"] });
      toast.success("Keyword saved");
      setEditingKw(null);
    },
  });

  // Changelog mutations
  const saveChangelogMutation = useMutation({
    mutationFn: () => {
      let entries;
      try { entries = JSON.parse(clForm.entries_json); } catch { entries = []; }
      const payload = { version: clForm.version, released_at: clForm.released_at || new Date().toISOString().slice(0, 10), entries_json: entries };
      return editingChangelog ? api("update-changelog", { id: editingChangelog.id, ...payload }) : api("create-changelog", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-changelogs"] });
      toast.success("Changelog saved");
      setShowChangelogDialog(false);
      setEditingChangelog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteChangelogMutation = useMutation({
    mutationFn: (id: string) => api("delete-changelog", { id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-changelogs"] }); toast.success("Deleted"); },
  });

  // Roadmap mutations
  const saveRoadmapMutation = useMutation({
    mutationFn: () => {
      const payload = { ...rmForm, votes: rmForm.votes || 0 };
      return editingRoadmap ? api("update-roadmap", { id: editingRoadmap.id, ...payload }) : api("create-roadmap", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roadmap"] });
      toast.success("Roadmap item saved");
      setShowRoadmapDialog(false);
      setEditingRoadmap(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRoadmapMutation = useMutation({
    mutationFn: (id: string) => api("delete-roadmap", { id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-roadmap"] }); toast.success("Deleted"); },
  });

  const openPostForm = (post?: any) => {
    if (post) {
      setEditingPost(post);
      setPostForm({
        title: post.title || "", slug: post.slug || "", target_keyword: post.target_keyword || "",
        published: post.published || false, published_at: post.published_at?.slice(0, 10) || "",
        current_ranking: post.current_ranking || 0, weekly_clicks: post.weekly_clicks || 0,
        weekly_impressions: post.weekly_impressions || 0, excerpt: post.excerpt || "",
      });
    } else {
      setEditingPost(null);
      setPostForm({ title: "", slug: "", target_keyword: "", published: false, published_at: "", current_ranking: 0, weekly_clicks: 0, weekly_impressions: 0, excerpt: "" });
    }
    setShowPostDialog(true);
  };

  const posts = blogData?.posts || [];
  const keywords = kwData?.keywords || [];
  const latestMetric = (metricsData?.metrics || [])[0];
  const changelogs = changelogData?.changelogs || [];
  const roadmapItems = roadmapData?.items || [];

  const getStatus = (p: any) => {
    if (p.published) return "published";
    if (p.published_at) return "planned";
    return "draft";
  };

  const ROADMAP_STATUS: Record<string, { bg: string; label: string }> = {
    planned: { bg: "#94a3b8", label: "Planned" },
    "in-progress": { bg: "#C8902A", label: "In Progress" },
    shipped: { bg: "#22c55e", label: "Shipped" },
  };

  return (
    <div className="space-y-8">
      {/* Blog Post Tracker */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#6B1B2A" }}>Blog Post Tracker</h2>
          <Button size="sm" onClick={() => openPostForm()}><Plus className="h-4 w-4 mr-1" /> New Post</Button>
        </div>
        <Card className="bg-white shadow-sm">
          <CardContent className="p-0">
            {blogLoading ? <Skeleton className="h-48 w-full m-4" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead><TableHead>Target Keyword</TableHead><TableHead>Status</TableHead>
                    <TableHead>Publish Date</TableHead><TableHead>Ranking</TableHead><TableHead>Clicks</TableHead>
                    <TableHead>Impressions</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((p: any) => {
                    const status = getStatus(p);
                    const style = STATUS_STYLES[status];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium max-w-xs truncate">{p.title}</TableCell>
                        <TableCell className="text-xs">{p.target_keyword || "—"}</TableCell>
                        <TableCell><Badge style={{ background: style.bg, color: "#fff", border: "none" }}>{style.label}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.published_at ? new Date(p.published_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>{p.current_ranking || "—"}</TableCell>
                        <TableCell>{p.weekly_clicks || "—"}</TableCell>
                        <TableCell>{p.weekly_impressions || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openPostForm(p)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteBlogMutation.mutate(p.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Post Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingPost ? "Edit Post" : "New Post"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={postForm.slug} onChange={(e) => setPostForm({ ...postForm, slug: e.target.value })} /></div>
            <div><Label>Target Keyword</Label><Input value={postForm.target_keyword} onChange={(e) => setPostForm({ ...postForm, target_keyword: e.target.value })} /></div>
            <div><Label>Excerpt</Label><Textarea value={postForm.excerpt} onChange={(e) => setPostForm({ ...postForm, excerpt: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Publish Date</Label><Input type="date" value={postForm.published_at} onChange={(e) => setPostForm({ ...postForm, published_at: e.target.value })} /></div>
              <div><Label>Current Ranking</Label><Input type="number" value={postForm.current_ranking} onChange={(e) => setPostForm({ ...postForm, current_ranking: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Weekly Clicks</Label><Input type="number" value={postForm.weekly_clicks} onChange={(e) => setPostForm({ ...postForm, weekly_clicks: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Weekly Impressions</Label><Input type="number" value={postForm.weekly_impressions} onChange={(e) => setPostForm({ ...postForm, weekly_impressions: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={postForm.published} onChange={(e) => setPostForm({ ...postForm, published: e.target.checked })} />
              <Label>Published</Label>
            </div>
            <Button onClick={() => saveBlogMutation.mutate()} disabled={saveBlogMutation.isPending} className="w-full">
              {editingPost ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Changelog & Roadmap */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#6B1B2A" }}>Changelog</h2>
          <Button size="sm" onClick={() => {
            setEditingChangelog(null);
            setClForm({ version: "", released_at: new Date().toISOString().slice(0, 10), entries_json: '["New feature description"]' });
            setShowChangelogDialog(true);
          }}><Plus className="h-4 w-4 mr-1" /> Add Entry</Button>
        </div>
        <Card className="bg-white shadow-sm">
          <CardContent className="p-0">
            {clLoading ? <Skeleton className="h-32 w-full m-4" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead><TableHead>Released</TableHead><TableHead>Items</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changelogs.map((cl: any) => {
                    const entries = Array.isArray(cl.entries_json) ? cl.entries_json : [];
                    return (
                      <TableRow key={cl.id}>
                        <TableCell className="font-medium">{cl.version}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(cl.released_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <ul className="list-disc list-inside text-xs space-y-0.5">
                            {entries.map((e: any, i: number) => <li key={i}>{typeof e === "string" ? e : e.text || JSON.stringify(e)}</li>)}
                          </ul>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingChangelog(cl);
                              setClForm({ version: cl.version, released_at: cl.released_at?.slice(0, 10) || "", entries_json: JSON.stringify(entries, null, 2) });
                              setShowChangelogDialog(true);
                            }}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteChangelogMutation.mutate(cl.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Changelog Dialog */}
      <Dialog open={showChangelogDialog} onOpenChange={setShowChangelogDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingChangelog ? "Edit Changelog" : "New Changelog Entry"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Version</Label><Input value={clForm.version} onChange={e => setClForm({ ...clForm, version: e.target.value })} placeholder="e.g. 1.2.0" /></div>
            <div><Label>Released Date</Label><Input type="date" value={clForm.released_at} onChange={e => setClForm({ ...clForm, released_at: e.target.value })} /></div>
            <div><Label>Entries (JSON array of strings)</Label><Textarea value={clForm.entries_json} onChange={e => setClForm({ ...clForm, entries_json: e.target.value })} rows={4} /></div>
            <Button onClick={() => saveChangelogMutation.mutate()} disabled={saveChangelogMutation.isPending} className="w-full">
              {editingChangelog ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Roadmap */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#6B1B2A" }}>Roadmap</h2>
          <Button size="sm" onClick={() => {
            setEditingRoadmap(null);
            setRmForm({ title: "", status: "planned", votes: 0, description: "" });
            setShowRoadmapDialog(true);
          }}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
        </div>
        <Card className="bg-white shadow-sm">
          <CardContent className="p-0">
            {rmLoading ? <Skeleton className="h-32 w-full m-4" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Votes</TableHead><TableHead>Description</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roadmapItems.map((item: any) => {
                    const st = ROADMAP_STATUS[item.status] || ROADMAP_STATUS.planned;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell><Badge style={{ background: st.bg, color: "#fff", border: "none" }}>{st.label}</Badge></TableCell>
                        <TableCell>{item.votes}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{item.description || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingRoadmap(item);
                              setRmForm({ title: item.title, status: item.status, votes: item.votes || 0, description: item.description || "" });
                              setShowRoadmapDialog(true);
                            }}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteRoadmapMutation.mutate(item.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Roadmap Dialog */}
      <Dialog open={showRoadmapDialog} onOpenChange={setShowRoadmapDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingRoadmap ? "Edit Roadmap Item" : "New Roadmap Item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={rmForm.title} onChange={e => setRmForm({ ...rmForm, title: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={rmForm.status} onValueChange={v => setRmForm({ ...rmForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Votes</Label><Input type="number" value={rmForm.votes} onChange={e => setRmForm({ ...rmForm, votes: parseInt(e.target.value) || 0 })} /></div>
            <div><Label>Description</Label><Textarea value={rmForm.description} onChange={e => setRmForm({ ...rmForm, description: e.target.value })} rows={3} /></div>
            <Button onClick={() => saveRoadmapMutation.mutate()} disabled={saveRoadmapMutation.isPending} className="w-full">
              {editingRoadmap ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyword Targets */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>Keyword Targets</h2>
        <Card className="bg-white shadow-sm">
          <CardContent className="p-0">
            {kwLoading ? <Skeleton className="h-32 w-full m-4" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead><TableHead>Target Page</TableHead><TableHead>Current Ranking</TableHead><TableHead>Notes</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map((kw: any) => (
                    <TableRow key={kw.id}>
                      {editingKw === kw.id ? (
                        <>
                          <TableCell><Input value={kwForm.keyword} onChange={(e) => setKwForm({ ...kwForm, keyword: e.target.value })} /></TableCell>
                          <TableCell><Input value={kwForm.target_page} onChange={(e) => setKwForm({ ...kwForm, target_page: e.target.value })} /></TableCell>
                          <TableCell><Input type="number" value={kwForm.current_ranking} onChange={(e) => setKwForm({ ...kwForm, current_ranking: parseInt(e.target.value) || 0 })} /></TableCell>
                          <TableCell><Input value={kwForm.notes} onChange={(e) => setKwForm({ ...kwForm, notes: e.target.value })} /></TableCell>
                          <TableCell><Button size="sm" onClick={() => saveKwMutation.mutate()}>Save</Button></TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{kw.keyword}</TableCell>
                          <TableCell className="text-xs">{kw.target_page}</TableCell>
                          <TableCell>{kw.current_ranking || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{kw.notes || "—"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingKw(kw.id);
                              setKwForm({ keyword: kw.keyword, target_page: kw.target_page || "", current_ranking: kw.current_ranking || 0, notes: kw.notes || "" });
                            }}><Pencil className="h-3 w-3" /></Button>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Search Console Snapshot */}
      {latestMetric && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>Search Console Snapshot</h2>
          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div><span className="text-xs text-muted-foreground">Week of</span><p className="font-semibold">{latestMetric.week_of}</p></div>
                <div><span className="text-xs text-muted-foreground">Impressions</span><p className="font-semibold">{latestMetric.sc_impressions}</p></div>
                <div><span className="text-xs text-muted-foreground">Clicks</span><p className="font-semibold">{latestMetric.sc_clicks}</p></div>
                <div><span className="text-xs text-muted-foreground">Avg Position</span><p className="font-semibold">{latestMetric.sc_avg_position}</p></div>
              </div>
              {latestMetric.sc_top_queries && (latestMetric.sc_top_queries as any[]).length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead><TableHead>Clicks</TableHead><TableHead>Impressions</TableHead><TableHead>Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(latestMetric.sc_top_queries as any[]).map((q: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{q.query}</TableCell><TableCell>{q.clicks}</TableCell><TableCell>{q.impressions}</TableCell><TableCell>{q.position}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                <ExternalLink className="h-3 w-3 inline mr-1" />Update in Weekly Strategy tab
              </p>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
