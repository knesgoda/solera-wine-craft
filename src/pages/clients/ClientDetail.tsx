import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Send, Loader2, Mail, Wine, MessageSquare, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ClientDetail = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.org_id;
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const { data: client } = useQuery({
    queryKey: ["client-org", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_orgs").select("*").eq("id", clientId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const { data: vintages = [] } = useQuery({
    queryKey: ["client-vintages", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vintages").select("*, blocks(name)").eq("client_org_id", clientId!).order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!clientId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["client-messages", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_messages").select("*").eq("client_org_id", clientId!).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const handleSendMessage = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("client_messages").insert({
        org_id: orgId!,
        client_org_id: clientId!,
        sender_type: "facility",
        sender_id: user?.id,
        message: msgText.trim(),
      });
      if (error) throw error;
      setMsgText("");
      qc.invalidateQueries({ queryKey: ["client-messages", clientId] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const handleInvite = async () => {
    if (!client?.contact_email) { toast.error("Client has no contact email"); return; }
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke("invite-client", {
        body: { client_org_id: clientId, email: client.contact_email },
      });
      if (error) throw error;
      toast.success(`Invite sent to ${client.contact_email}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setInviting(false); }
  };

  const handleGenerateReport = async () => {
    if (!dateRange.from || !dateRange.to) { toast.error("Select a date range"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-billing-report", {
        body: { client_org_id: clientId, from: dateRange.from, to: dateRange.to },
      });
      if (error) throw error;
      // Download the PDF
      if (data?.pdf_url) {
        window.open(data.pdf_url, "_blank");
      }
      toast.success("Billing report generated");
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  if (!client) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground">{client.name}</h1>
          <p className="text-sm text-muted-foreground">{client.contact_name} · {client.contact_email}</p>
        </div>
        <Button variant="outline" onClick={handleInvite} disabled={inviting}>
          <Mail className="h-4 w-4 mr-2" />{inviting ? "Sending..." : "Send Invite"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-md">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{vintages.length}</p>
            <p className="text-sm text-muted-foreground">Vintages</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{vintages.filter((v: any) => v.status === "in_progress" || v.status === "in_cellar").length}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{messages.length}</p>
            <p className="text-sm text-muted-foreground">Messages</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vintages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vintages" className="gap-2"><Wine className="h-4 w-4" />Vintages</TabsTrigger>
          <TabsTrigger value="messages" className="gap-2"><MessageSquare className="h-4 w-4" />Messages</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><FileText className="h-4 w-4" />Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="vintages">
          <Card className="border-none shadow-md">
            <CardContent className="p-0">
              {vintages.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No vintages assigned to this client.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Year</TableHead><TableHead>Block</TableHead><TableHead>Status</TableHead><TableHead>Contract</TableHead><TableHead>COA</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {vintages.map((v: any) => (
                      <TableRow key={v.id} className="cursor-pointer" onClick={() => navigate(`/vintages/${v.id}`)}>
                        <TableCell className="font-medium">{v.year}</TableCell>
                        <TableCell>{v.blocks?.name || "—"}</TableCell>
                        <TableCell><Badge variant="secondary" className="capitalize">{v.status}</Badge></TableCell>
                        <TableCell>{v.contract_status ? <Badge variant="outline" className={`capitalize ${v.contract_status === "pending" ? "bg-yellow-100 text-yellow-900 border-yellow-300" : v.contract_status === "expired" ? "bg-red-100 text-red-900 border-red-300" : "bg-green-100 text-green-900 border-green-300"}`}>{String(v.contract_status).replace(/_/g, " ")}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{v.coa_status ? <Badge variant="outline" className={`capitalize ${v.coa_status === "not_requested" ? "bg-muted text-muted-foreground border-border" : v.coa_status === "pending_lab" ? "bg-yellow-100 text-yellow-900 border-yellow-300" : v.coa_status === "ready" ? "bg-blue-100 text-blue-900 border-blue-300" : "bg-green-100 text-green-900 border-green-300"}`}>{String(v.coa_status).replace(/_/g, " ")}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card className="border-none shadow-md">
            <CardContent className="p-4 space-y-4">
              <div className="max-h-96 overflow-y-auto space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>
                ) : messages.map((m: any) => (
                  <div key={m.id} className={`flex ${m.sender_type === "facility" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg p-3 text-sm ${m.sender_type === "facility" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      <p>{m.message}</p>
                      <p className={`text-xs mt-1 ${m.sender_type === "facility" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {format(new Date(m.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Type a message..." className="flex-1" rows={2} />
                <Button onClick={handleSendMessage} disabled={sending || !msgText.trim()} size="icon" className="self-end">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card className="border-none shadow-md">
            <CardHeader><CardTitle className="font-display">Generate Billing Report</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>From</Label><Input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} /></div>
                <div><Label>To</Label><Input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} /></div>
              </div>
              <Button onClick={handleGenerateReport} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate Report
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetail;
