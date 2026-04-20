import { useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function ClientDocuments() {
  const { clientUser } = useOutletContext<{ clientUser: any }>();

  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", clientUser?.client_org_id],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("client-documents").list(clientUser.client_org_id, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientUser?.client_org_id,
  });

  const openSignedUrl = async (name: string) => {
    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(`${clientUser.client_org_id}/${name}`, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "Could not open document", description: error?.message ?? "Unknown error", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold text-foreground">Documents</h1>
      <Card className="border-none shadow-md">
        <CardContent className="p-4">
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No documents available yet.</div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(doc.created_at), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openSignedUrl(doc.name)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
