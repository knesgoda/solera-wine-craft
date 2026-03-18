import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, Beaker, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { NewTrialDialog } from "@/components/cellar/NewTrialDialog";

export default function BlendingTrials() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: trials = [], isLoading } = useQuery({
    queryKey: ["blending-trials", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blending_trials")
        .select("*, vintages(year)")
        .eq("org_id", organization!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Blending Trials</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Trial
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : trials.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4"><Beaker className="h-10 w-10 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold mb-2">No blending trials yet</h3>
            <p className="text-muted-foreground mb-4">Create your first blend trial to start experimenting</p>
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Trial</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {trials.map((t: any) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/cellar/blending/${t.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{t.name}</p>
                    {t.finalized && <Badge className="bg-primary/10 text-primary" variant="secondary">Finalized</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {t.vintages && <span>{t.vintages.year} Vintage</span>}
                    {t.total_volume_liters && <span>{t.total_volume_liters}L</span>}
                    <span>{format(parseISO(t.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>
                {t.stars && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < t.stars ? "text-secondary fill-secondary" : "text-muted"}`}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewTrialDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
