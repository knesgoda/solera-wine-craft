import { useState, useMemo } from "react";
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
  Eye, Plus, Search, ChevronLeft, ChevronRight, Send,
  ArrowUp, ArrowDown, CreditCard, CalendarDays, DollarSign,
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

type SortKey = "name" | "tier" | "userCount" | "vintageCount" | "blockCount" | "labCount" | "taskCount" | "importCount" | "lastActive" | "created_at";

export function CustomersTab({ api, password }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState("main");
  const [newNote, setNewNote] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        {sortKey === field && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </div>
    </TableHead>
  );

  const customers = useMemo(() => {
    let filtered = (data?.customers || []).filter((c: any) => {
      if (search && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (tierFilter !== "all" && (c.tier || "hobbyist") !== tierFilter) return false;
      if (typeFilter !== "all" && (c.type || "") !== typeFilter) return false;
      if (lifecycleFilter !== "all" && c.lifecycle !== lifecycleFilter) return false;
      return true;
    });

    filtered.sort((a: any, b: any) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";
      if (typeof aVal === "number" && typeof bVal === "number") return sortAsc ? aVal - bVal : bVal - aVal;
      return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });

    return filtered;
  }, [data, search, tierFilter, typeFilter, lifecycleFilter, sortKey, sortAsc]);

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

  const sub = orgDetail?.subscription;

  // ─── Create Customer State ───
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ firstName: "", lastName: "", email: "", userPassword: "", orgName: "", tier: "enterprise" });
  const [creatingUser, setCreatingUser] = useState(false);

  // ─── Support Context State ───
  const [supportContext, setSupportContext] = useState<string | null>(null);
  const [loadingSupportCtx, setLoadingSupportCtx] = useState(false);

  const handleCreateUser = async () => {
    setCreatingUser(true);
    try {
      const result = await api("create-user", createUserForm);
      toast.success(`User created! Org ID: ${result.orgId}`);
      setShowCreateUser(false);
      setCreateUserForm({ firstName: "", lastName: "", email: "", userPassword: "", orgName: "", tier: "enterprise" });
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    } catch (e: any) { toast.error(e.message); }
    setCreatingUser(false);
  };

  const handleGenerateSupportCtx = async () => {
    setLoadingSupportCtx(true);
    try {
      const result = await api("support-context", { orgId: selectedOrgId });
      setSupportContext(result.context);
    } catch (e: any) { toast.error(e.message); }
    setLoadingSupportCtx(false);
  };

  return (
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="flex gap-2 items-center">
        <Button variant={activeSubTab === "main" ? "default" : "outline"} size="sm" onClick={() => setActiveSubTab("main")}>
          All Customers
        </Button>
        <Button variant={activeSubTab === "upsell" ? "default" : "outline"} size="sm" onClick={() => setActiveSubTab("upsell")}>
          Upsell Queue
        </Button>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowCreateUser(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Customer
          </Button>
        </div>
      </div>

      {/* Create Customer Modal */}
      <Sheet open={showCreateUser} onOpenChange={setShowCreateUser}>
        <SheetContent className="w-[420px] overflow-auto">
          <SheetHeader className="mb-4"><SheetTitle>Create Customer</SheetTitle></SheetHeader>
          <div className="space-y-3">
            <div><label className="text-xs font-medium">First Name</label><Input value={createUserForm.firstName} onChange={e => setCreateUserForm({...createUserForm, firstName: e.target.value})} /></div>
            <div><label className="text-xs font-medium">Last Name</label><Input value={createUserForm.lastName} onChange={e => setCreateUserForm({...createUserForm, lastName: e.target.value})} /></div>
            <div><label className="text-xs font-medium">Email</label><Input type="email" value={createUserForm.email} onChange={e => setCreateUserForm({...createUserForm, email: e.target.value})} /></div>
            <div><label className="text-xs font-medium">Password</label><Input type="password" value={createUserForm.userPassword} onChange={e => setCreateUserForm({...createUserForm, userPassword: e.target.value})} /></div>
            <div><label className="text-xs font-medium">Org Name</label><Input value={createUserForm.orgName} onChange={e => setCreateUserForm({...createUserForm, orgName: e.target.value})} /></div>
            <div>
              <label className="text-xs font-medium">Tier</label>
              <Select value={createUserForm.tier} onValueChange={v => setCreateUserForm({...createUserForm, tier: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hobbyist">Hobbyist</SelectItem>
                  <SelectItem value="small_boutique">Pro</SelectItem>
                  <SelectItem value="mid_size">Growth</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleCreateUser} disabled={creatingUser || !createUserForm.email || !createUserForm.userPassword}>
              {creatingUser ? "Creating…" : "Create Customer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
          <div className="flex gap-3 items-center flex-wrap">
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
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="winery">Winery</SelectItem>
                <SelectItem value="custom_crush">Custom Crush</SelectItem>
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
                      <SortHeader label="Org Name" field="name" />
                      <SortHeader label="Tier" field="tier" />
                      <SortHeader label="Users" field="userCount" />
                      <SortHeader label="Vintages" field="vintageCount" />
                      <SortHeader label="Blocks" field="blockCount" />
                      <SortHeader label="Lab Samples" field="labCount" />
                      <SortHeader label="Tasks" field="taskCount" />
                      <SortHeader label="Imports" field="importCount" />
                      <SortHeader label="Last Login" field="lastActive" />
                      <SortHeader label="Created" field="created_at" />
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
                        <TableCell>{c.blockCount ?? 0}</TableCell>
                        <TableCell>{c.labCount ?? 0}</TableCell>
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
                  <TabsTrigger value="subscription">Subscription</TabsTrigger>
                  <TabsTrigger value="timeline">Activity</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="support">Support</TabsTrigger>
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

                {/* Subscription Tab */}
                <TabsContent value="subscription" className="space-y-4 mt-4">
                  {sub ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-white shadow-sm">
                          <CardContent className="p-4 flex items-center gap-3">
                            <CreditCard className="h-5 w-5" style={{ color: "#6B1B2A" }} />
                            <div>
                              <p className="text-xs text-muted-foreground">Current Plan</p>
                              <p className="font-bold text-lg capitalize">{sub.plan}</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-white shadow-sm">
                          <CardContent className="p-4 flex items-center gap-3">
                            <DollarSign className="h-5 w-5" style={{ color: "#C8902A" }} />
                            <div>
                              <p className="text-xs text-muted-foreground">MRR</p>
                              <p className="font-bold text-lg">${sub.mrr}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-muted-foreground">Billing Cycle:</span> <span className="capitalize">{sub.billingCycle}</span></div>
                        <div><span className="text-muted-foreground">Next Billing:</span> {sub.nextBilling ? new Date(sub.nextBilling).toLocaleDateString() : "—"}</div>
                        <div><span className="text-muted-foreground">Started:</span> {new Date(sub.startedAt).toLocaleDateString()}</div>
                        <div><span className="text-muted-foreground">Status:</span> <Badge variant={sub.status === "active" ? "default" : "destructive"} className="capitalize">{sub.status}</Badge></div>
                      </div>

                      {sub.cardLast4 && (
                        <div className="border rounded-lg p-3 text-sm">
                          <p className="text-xs text-muted-foreground mb-1">Payment Method</p>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span className="capitalize">{sub.cardBrand}</span>
                            <span>•••• {sub.cardLast4}</span>
                            <span className="text-muted-foreground">Exp {sub.cardExpiry}</span>
                            <Badge variant="outline" className="text-green-700 border-green-300 ml-auto">
                              {sub.cardStatus}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {(orgDetail.upgradeHistory || []).length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Upgrade / Downgrade History</h4>
                          <div className="space-y-2">
                            {orgDetail.upgradeHistory.map((evt: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                                <span>{evt.fromPlan}</span>
                                <span>→</span>
                                <span className="font-medium">{evt.toPlan}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{new Date(evt.date).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No active subscription</p>
                      <p className="text-xs">This org is on the free Hobbyist tier</p>
                    </div>
                  )}
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
