import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Loader2, Pencil, Plus, Trash2, Phone, Mail, MapPin, FileText, Scale as ScaleIcon } from "lucide-react";
import { GrowerDialog } from "@/components/growers/GrowerDialog";
import { SEOHead } from "@/components/SEOHead";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  inactive: "bg-muted text-muted-foreground",
  prospect: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const CONTRACT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800",
  fulfilled: "bg-blue-100 text-blue-800",
  cancelled: "bg-destructive/10 text-destructive",
  expired: "bg-amber-100 text-amber-800",
};

const WEIGH_TAG_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  graded: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  disputed: "bg-destructive/10 text-destructive",
  paid: "bg-muted text-muted-foreground",
};

export default function GrowerDetail() {
  const { id } = useParams<{ id: string }>();
  const { organization, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [contactForm, setContactForm] = useState<{ name: string; role: string; email: string; phone: string } | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const { data: grower, isLoading } = useQuery({
    queryKey: ["grower", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("growers").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["grower-contracts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grower_contracts")
        .select("*")
        .eq("grower_id", id!)
        .order("vintage_year", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["grower-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grower_contacts")
        .select("*")
        .eq("grower_id", id!)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: weighTags = [] } = useQuery({
    queryKey: ["grower-weigh-tags", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weigh_tags")
        .select("*, grower_contracts(contract_number), blocks(name)")
        .eq("grower_id", id!)
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Stats
  const totalContracts = contracts.length;
  const activeContracts = contracts.filter((c: any) => c.status === "active").length;
  const totalTonsDelivered = contracts.reduce((sum: number, c: any) => sum + (Number(c.total_delivered_tons) || 0), 0);
  const totalValue = contracts.reduce((sum: number, c: any) => sum + (Number(c.total_contract_value) || 0), 0);

  // Contact mutations
  const addContactMutation = useMutation({
    mutationFn: async (contact: { name: string; role: string; email: string; phone: string; is_primary?: boolean }) => {
      const { error } = await supabase.from("grower_contacts").insert({
        org_id: organization!.id,
        grower_id: id!,
        name: contact.name.trim(),
        role: contact.role.trim() || null,
        email: contact.email.trim() || null,
        phone: contact.phone.trim() || null,
        is_primary: contact.is_primary || false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grower-contacts", id] });
      setContactForm(null);
      toast({ title: "Contact added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, ...fields }: any) => {
      const { error } = await supabase.from("grower_contacts").update(fields).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grower-contacts", id] });
      setEditingContactId(null);
      setContactForm(null);
      toast({ title: "Contact updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from("grower_contacts").delete().eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grower-contacts", id] });
      toast({ title: "Contact removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (contactId: string) => {
      // Unset all primary first
      await supabase.from("grower_contacts").update({ is_primary: false }).eq("grower_id", id!);
      const { error } = await supabase.from("grower_contacts").update({ is_primary: true }).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grower-contacts", id] });
      toast({ title: "Primary contact updated" });
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!grower) {
    return <div className="py-16 text-center text-muted-foreground">Grower not found.</div>;
  }

  return (
    <div className="space-y-6">
      <SEOHead title={`${grower.name} | Growers | Solera`} description="Grower detail" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/growers">Growers</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{grower.name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold">{grower.name}</h1>
          <Badge variant="secondary" className={STATUS_COLORS[grower.status] || ""}>{grower.status}</Badge>
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit Grower
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="contracts">Contracts ({contracts.length})</TabsTrigger>
          <TabsTrigger value="weigh-tags">Weigh Tags ({weighTags.length})</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Contracts", value: totalContracts },
              { label: "Active Contracts", value: activeContracts },
              { label: "Total Tons Delivered", value: totalTonsDelivered.toFixed(2) },
              { label: "Total Value", value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>Grower Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {grower.contact_name && (
                <div className="flex items-center gap-2"><span className="text-muted-foreground">Contact:</span> {grower.contact_name}</div>
              )}
              {grower.email && (
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {grower.email}</div>
              )}
              {grower.phone && (
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {grower.phone}</div>
              )}
              {(grower.address_line1 || grower.city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    {grower.address_line1 && <div>{grower.address_line1}</div>}
                    {grower.address_line2 && <div>{grower.address_line2}</div>}
                    {(grower.city || grower.state || grower.zip) && (
                      <div>{[grower.city, grower.state].filter(Boolean).join(", ")} {grower.zip}</div>
                    )}
                  </div>
                </div>
              )}
              {grower.tax_id && (
                <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Tax ID: {grower.tax_id}</div>
              )}
              {grower.notes && (
                <div className="col-span-full">
                  <span className="text-muted-foreground">Notes:</span>
                  <p className="mt-1">{grower.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACTS TAB */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => { setContactForm({ name: "", role: "", email: "", phone: "" }); setEditingContactId(null); }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Contact
            </Button>
          </div>

          {contactForm && !editingContactId && (
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input placeholder="Name *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
                  <Input placeholder="Role" value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} />
                  <Input placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                  <Input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" disabled={!contactForm.name.trim() || addContactMutation.isPending} onClick={() => addContactMutation.mutate(contactForm)}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setContactForm(null)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {contacts.length === 0 && !contactForm ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <p className="mb-2">No contacts yet.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setContactForm({ name: "", role: "", email: "", phone: "" })}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Contact
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="hidden sm:table-cell">Phone</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c: any) => (
                    <TableRow key={c.id}>
                      {editingContactId === c.id && contactForm ? (
                        <>
                          <TableCell><Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} /></TableCell>
                          <TableCell><Input value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} /></TableCell>
                          <TableCell className="hidden sm:table-cell"><Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></TableCell>
                          <TableCell className="hidden sm:table-cell"><Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => updateContactMutation.mutate({ contactId: c.id, name: contactForm.name.trim(), role: contactForm.role.trim() || null, email: contactForm.email.trim() || null, phone: contactForm.phone.trim() || null })}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingContactId(null); setContactForm(null); }}>Cancel</Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.role || "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell">{c.email || "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell">{c.phone || "—"}</TableCell>
                          <TableCell>
                            {c.is_primary ? (
                              <Badge>Primary</Badge>
                            ) : (
                              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setPrimaryMutation.mutate(c.id)}>Set Primary</Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => { setEditingContactId(c.id); setContactForm({ name: c.name, role: c.role || "", email: c.email || "", phone: c.phone || "" }); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteContactMutation.mutate(c.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* CONTRACTS TAB */}
        <TabsContent value="contracts" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => navigate(`/growers/contracts/new?grower_id=${id}`)}>
              <Plus className="mr-2 h-4 w-4" /> New Contract
            </Button>
          </div>

          {contracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <ScaleIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="mb-2">No contracts yet for this grower.</p>
              <Button size="sm" variant="outline" onClick={() => navigate(`/growers/contracts/new?grower_id=${id}`)}>
                <Plus className="mr-2 h-4 w-4" /> Create Contract
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Vintage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Pricing</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Base Price</TableHead>
                    <TableHead className="text-right">Delivered Tons</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c: any) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/growers/contracts/${c.id}`)}>
                      <TableCell className="font-medium">{c.contract_number || "—"}</TableCell>
                      <TableCell>{c.vintage_year}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={CONTRACT_STATUS_COLORS[c.status] || ""}>{c.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{c.pricing_unit === "per_ton" ? "Per Ton" : "Per Acre"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-right">${Number(c.base_price_per_unit).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(c.total_delivered_tons).toFixed(2)}</TableCell>
                      <TableCell className="text-right">${Number(c.total_contract_value).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* WEIGH TAGS TAB */}
        <TabsContent value="weigh-tags" className="space-y-4">
          {weighTags.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <ScaleIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p>No weigh tags recorded for this grower yet.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Contract</TableHead>
                    <TableHead className="hidden sm:table-cell">Block</TableHead>
                    <TableHead className="text-right">Net Tons</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Final Price</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weighTags.map((wt: any) => (
                    <TableRow key={wt.id}>
                      <TableCell className="font-medium">{wt.tag_number}</TableCell>
                      <TableCell>{wt.delivery_date}</TableCell>
                      <TableCell className="hidden sm:table-cell">{wt.grower_contracts?.contract_number || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{wt.blocks?.name || "—"}</TableCell>
                      <TableCell className="text-right">{wt.net_tons != null ? Number(wt.net_tons).toFixed(2) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={WEIGH_TAG_STATUS_COLORS[wt.status] || ""}>{wt.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {wt.final_price_per_unit != null ? `$${Number(wt.final_price_per_unit).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {wt.total_value != null ? `$${Number(wt.total_value).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <GrowerDialog open={editOpen} onOpenChange={setEditOpen} grower={grower} />
    </div>
  );
}
