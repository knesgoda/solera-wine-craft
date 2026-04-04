import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowUpDown, Wine } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { format, parseISO } from "date-fns";
import { NewVintageDialog } from "@/components/vintages/NewVintageDialog";

const statusColors: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-secondary/20 text-secondary",
  harvested: "bg-primary/15 text-primary",
  in_cellar: "bg-accent/20 text-accent-foreground",
  bottled: "bg-primary/10 text-primary",
  released: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  harvested: "Harvested",
  in_cellar: "In Cellar",
  bottled: "Bottled",
  released: "Released",
};

type SortKey = "year" | "status" | "harvest_date";

export default function VintageList() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("year");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: vintages = [], isLoading, isError: vintagesError } = useQuery({
    queryKey: ["vintages", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vintages")
        .select("*, blocks(name)")
        .eq("org_id", organization!.id)
        .order("year", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organization?.id,
  });

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(key === "year" ? false : true); }
  };

  const sorted = [...vintages].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "year") cmp = a.year - b.year;
    else if (sortBy === "status") cmp = (a.status || "").localeCompare(b.status || "");
    else if (sortBy === "harvest_date") cmp = (a.harvest_date || "").localeCompare(b.harvest_date || "");
    return sortAsc ? cmp : -cmp;
  });

  if (vintagesError) return <div className="py-12 text-center text-destructive">Failed to load vintages. Please refresh the page.</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Vintages</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Vintage
        </Button>
      </div>

      {/* Sort controls */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["year", "status", "harvest_date"] as SortKey[]).map((key) => (
          <Button
            key={key}
            variant={sortBy === key ? "default" : "outline"}
            size="sm"
            onClick={() => toggleSort(key)}
          >
            {key === "harvest_date" ? "Harvest Date" : key.charAt(0).toUpperCase() + key.slice(1)}
            <ArrowUpDown className="h-3 w-3 ml-1" />
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Loading…</p>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Wine}
          title="No vintages yet"
          description="Create your first vintage to start tracking fermentation, lab data, and cellar operations."
          actionLabel="Add Vintage"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/vintages/${v.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {v.year} {v.blocks?.name && `· ${v.blocks.name}`}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {v.harvest_date && <span>Harvest: {format(parseISO(v.harvest_date), "MMM d, yyyy")}</span>}
                    {v.tons_harvested && <span>{v.tons_harvested}t</span>}
                  </div>
                </div>
                <Badge className={statusColors[v.status] || ""} variant="secondary">
                  {statusLabels[v.status] || v.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewVintageDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
