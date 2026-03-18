import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ClientMessages() {
  const { clientUser } = useOutletContext<{ clientUser: any }>();
  const qc = useQueryClient();
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: messages = [] } = useQuery({
    queryKey: ["client-portal-messages", clientUser?.client_org_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_messages").select("*").eq("client_org_id", clientUser.client_org_id).order("created_at", { ascending: true });
      if (error) throw error;
      // Mark facility messages as read
      await supabase.from("client_messages").update({ read: true }).eq("client_org_id", clientUser.client_org_id).eq("sender_type", "facility").eq("read", false);
      return data;
    },
    enabled: !!clientUser?.client_org_id,
    refetchInterval: 15000,
  });

  const handleSend = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    try {
      // Use edge function to send as client (needs to also get org_id)
      const { error } = await supabase.functions.invoke("send-client-message", {
        body: { client_org_id: clientUser.client_org_id, message: msgText.trim() },
      });
      if (error) throw error;
      setMsgText("");
      qc.invalidateQueries({ queryKey: ["client-portal-messages"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Messages</h1>
      <Card className="border-none shadow-md">
        <CardContent className="p-4 space-y-4">
          <div className="max-h-[500px] overflow-y-auto space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>
            ) : messages.map((m: any) => (
              <div key={m.id} className={`flex ${m.sender_type === "client" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-lg p-3 text-sm ${m.sender_type === "client" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  <p>{m.message}</p>
                  <p className={`text-xs mt-1 ${m.sender_type === "client" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {format(new Date(m.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Type a message..." className="flex-1" rows={2} />
            <Button onClick={handleSend} disabled={sending || !msgText.trim()} size="icon" className="self-end">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
