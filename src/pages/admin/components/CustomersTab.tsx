import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useNavigate } from "react-router-dom";
import {
  Eye, StickyNote, Plus, Search, ChevronLeft, ChevronRight,
  Copy, ArrowUpRight, Send,
} from "lucide-react";

interface Props {
  api: (action: string, payload?: any) => Promise<any>;
  password: string;
}

const TIER_LABELS: Record<string, string> = {
  hobbyist: "Hobbyist", small_boutique: "Pro", mid_size: "Growth", enterprise: "Enterprise",
};

const LIFECYCLE_COLORS: Record<string, string> = {
  new: "#3b82f6", active: "#22c55e", "at-risk": "#eab308", churned: "#ef4444",
};

const PAGE_SIZE = 25;

export function CustomersTab({ api, password }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("main");
  const [newNote, setNewNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => api("customer-list"),
  });

  const { data: orgDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-org-detail", selectedOrgId],
    queryFn: () => api("org-detail", { orgId: selectedOrgId }),
    enabled: !!selectedOrgId,
  });

  const { data: upsellData } = useQuery({
    queryKey: ["admin-upsell"],
    queryFn: () => api("upsell-queue"),
    enabled: activeSubTab === "upsell",
  });

  const addNoteMutation = useMutation({
    mutationFn: () => api("org-notes-create", { orgId: selectedOrgId, note: newNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-org-detail", selectedOrgId] });
      setNewNote("");
      toast.success("Note added");
    },
  });

  const customers = (data?.customers || [])
    .filter((c: any) => {
      if (search && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (tierFilter !== "all" && (c.tier || "hobbyist") !== tierFilter) return false;
      if (lifecycleFilter !== "all" && c.lifecycle !== lifecycleFilter) return false;
      return true;
    });

  const totalPages = Math.ceil(customers.length / PAGE_SIZE);
  const pageCustomers = customers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const openDrawer = (orgId: string) => {
    setSelectedOrgId(orgId);
    setDrawerOpen(true);
  };

  const handleImpersonate = () => {
    if (!orgDetail?.org) return;
    startImpersonation(orgDetail.org.id, orgDetail.org.name);
    navigate("/dashboard");
  };

  return (
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="flex gap-2">
        <Button variant={activeSubTab === "main" ? "default" : "outline"} size="sm" onClick={() => setActiveSubTab("main")}>
          All Customers
        </Button>
        <Button variant={activeSubTab === "upsell" ? "default" : "outline"} size="sm" onClick={() => setActiveSubTab("upsell")}>
          Upsell Queue
        </Button>
      </div>

      {activeSubTab === "upsell" ? (
        <Card className="bg-white shadow-sm">
          <CardHeader><CardTitle className="text-sm">Upsell Opportunities</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Org</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Flag Reason</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(upsellData?.flagged || []).map((org: any) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell><Badge variant="outline">{TIER_LABELS[org.tier] || org.tier}</Badge></TableCell>
                    <TableCell className="text-xs">{org.flags.join(", ")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{org.lastActive ? new Date(org.lastActive).toLocaleDateString() : "Never"}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => {
                        api("org-notes-create", { orgId: org.id, note: `Marked as contacted for upsell on ${new Date().toLocaleDateString()}` });
                        toast.success("Marked as contacted");
                      }}>
                        <Send className="h-3 w-3 mr-1" /> Mark Contacted
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(upsellData?.flagged || []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No upsell candidates</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search org name…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(0); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Tier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="hobbyist">Hobbyist</SelectItem>
                <SelectItem value="small_boutique">Pro</SelectItem>
                <SelectItem value="mid_size">Growth</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lifecycleFilter} onValueChange={(v) => { setLifecycleFilter(v); setPage(0); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Lifecycle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="new">New &lt;7d</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="at-risk">At-Risk 14d</SelectItem>
                <SelectItem value="churned">Churned 30d+</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{customers.length} orgs</span>
          </div>

          {/* Table */}
          <Card className="bg-white shadow-sm">
            <CardContent className="p-0">
              {isLoading ? <Skeleton className="h-64 w-full m-4" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Org Name</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Vintages</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead>Imports</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageCustomers.map((c: any) => (
                      <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDrawer(c.id)}>
                        <TableCell className="font-medium">
                          {c.name} {c.hasNotes && <span title="Has notes">📝</span>}
                        </TableCell>
                        <TableCell><Badge variant="outline">{TIER_LABELS[c.tier || "hobbyist"]}</Badge></TableCell>
                        <TableCell>{c.userCount}</TableCell>
                        <TableCell>{c.vintageCount}</TableCell>
                        <TableCell>{c.taskCount}</TableCell>
                        <TableCell>{c.importCount}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.lastActive ? new Date(c.lastActive).toLocaleDateString() : "Never"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge style={{ background: LIFECYCLE_COLORS[c.lifecycle] || "#ccc", color: "#fff", border: "none" }}>
                            {c.lifecycle}
                          </Badge>
                        </TableCell>
                        <TableCell><Eye className="h-4 w-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Org Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[520px] sm:w-[580px] overflow-auto" style={{ maxWidth: "90vw" }}>
          {detailLoading ? (
            <div className="space-y-4 p-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
          ) : orgDetail?.org ? (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-lg">{orgDetail.org.name}</SheetTitle>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{TIER_LABELS[orgDetail.org.tier || "hobbyist"]}</Badge>
                  {orgDetail.org.type && <Badge variant="secondary">{orgDetail.org.type}</Badge>}
                </div>
              </SheetHeader>

              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="timeline">Activity</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Created:</span> {new Date(orgDetail.org.created_at).toLocaleDateString()}</div>
                    <div><span className="text-muted-foreground">Stripe ID:</span> {orgDetail.org.stripe_customer_id || "—"}</div>
                    <div><span className="text-muted-foreground">Modules:</span> {(orgDetail.org.enabled_modules || []).join(", ") || "—"}</div>
                    <div><span className="text-muted-foreground">Vintages:</span> {orgDetail.vintages?.length}</div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Users ({orgDetail.users?.length})</h4>
                    {orgDetail.users?.map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between py-1 text-sm border-b last:border-0">
                        <span>{u.first_name} {u.last_name} · <span className="text-muted-foreground">{u.email}</span></span>
                        <span className="text-xs text-muted-foreground">{u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : "Never"}</span>
                      </div>
                    ))}
                  </div>

                  <Button variant="outline" className="w-full" onClick={handleImpersonate}>
                    <Eye className="h-4 w-4 mr-2" /> View as this org
                  </Button>
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  <div className="space-y-2">
                    {(orgDetail.timeline || []).map((evt: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#6B1B2A" }} />
                        <div>
                          <p>{evt.label}</p>
                          <p className="text-xs text-muted-foreground">{new Date(evt.at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {(!orgDetail.timeline || orgDetail.timeline.length === 0) && (
                      <p className="text-muted-foreground text-sm">No recent activity</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="notes" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add internal note…" rows={3} />
                    <Button size="sm" onClick={() => addNoteMutation.mutate()} disabled={!newNote.trim() || addNoteMutation.isPending}>
                      <Plus className="h-3 w-3 mr-1" /> Add Note
                    </Button>
                  </div>
                  {(orgDetail.notes || []).map((n: any) => (
                    <Card key={n.id} className="shadow-sm">
                      <CardContent className="p-3">
                        <p className="text-sm">{n.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
