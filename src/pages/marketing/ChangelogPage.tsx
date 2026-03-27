import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEOHead";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronUp } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const TAG_COLORS: Record<string, string> = {
  New: "bg-green-100 text-green-800 border-green-200",
  Improved: "bg-blue-100 text-blue-800 border-blue-200",
  Fixed: "bg-secondary/20 text-secondary border-secondary/30",
  Security: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: "In Development",
  planned: "Planned",
  coming_soon: "Under Consideration",
};

const STATUS_COLORS: Record<string, string> = {
  in_progress: "bg-amber-100 text-amber-800 border-amber-300",
  planned: "bg-blue-100 text-blue-800 border-blue-300",
  coming_soon: "bg-gray-100 text-gray-600 border-gray-300",
};

export default function ChangelogPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "roadmap" ? "roadmap" : "changelog";

  const HARDCODED_V25 = {
    id: "v2.5-hardcoded",
    version: "2.5",
    released_at: "2026-03-26",
    entries_json: [
      { tag: "New", title: "Clone & Rootstock Ripening Tracker", items: ["Ripening comparison dashboard — overlay Brix, pH, and TA curves for up to 10 blocks", "Automatic divergence alerts when same-variety blocks drift apart (Pro+)", "Block ripening history sparklines on block detail pages", "Cross-block lab overlay on vintage detail charts (Pro+)"] },
      { tag: "New", title: "Global Timezone Support", items: ["Org-level timezone setting with automatic browser detection", "Timezone-aware display across all modules", "Correct midnight boundary handling for international users"] },
      { tag: "New", title: "Multi-Language Infrastructure", items: ["Internationalization (i18n) framework with per-user language preference", "French translation — first of seven planned languages", "Locale-aware number and date formatting"] },
      { tag: "New", title: "Metric / Imperial Unit Toggle", items: ["Per-org unit preference: liters or gallons, kilograms or pounds", "Automatic conversion across all modules"] },
      { tag: "New", title: "Data Backup & Export", items: ["On-demand CSV or Excel export of all winery data", "SHA-256 integrity checksums on every export", "Scheduled automatic backups — weekly or monthly", "Auto-export on account cancellation with 90-day download window", "Available on every tier — no paywall"] },
      { tag: "Improved", title: "Admin Notification System", items: ["Real-time notifications for new signups and activation milestones", "Subscription lifecycle alerts for payment events"] },
    ],
  };

  const { data: changelogs } = useQuery({
    queryKey: ["changelogs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("changelogs")
        .select("*")
        .order("released_at", { ascending: false });
      return [HARDCODED_V25, ...(data || [])];
    },
  });

  const { data: roadmapItems } = useQuery({
    queryKey: ["roadmap_items"],
    queryFn: async () => {
      const { data } = await supabase.from("roadmap_items").select("*").order("votes", { ascending: false });
      return data || [];
    },
  });

  const queryClient = useQueryClient();

  const voteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("roadmap_votes").insert({
        item_id: itemId,
        voter_ip: "anonymous",
      });
      if (error && error.code === "23505") return; // duplicate vote
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roadmap_items"] }),
  });

  return (
    <>
      <SEOHead
        title="Changelog & Roadmap — Solera"
        description="See what's new in Solera and what's coming next. Vote on upcoming features."
        breadcrumbs={[
          { name: "Home", url: "https://solera.vin" },
          { name: "Changelog", url: "https://solera.vin/changelog" },
        ]}
      />

      <section className="pt-28 pb-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Changelog & Roadmap</h1>
          <p className="text-xl text-primary-foreground/80">See what we've shipped and what's coming next.</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="mb-8">
              <TabsTrigger value="changelog">Changelog</TabsTrigger>
              <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
            </TabsList>

            <TabsContent value="changelog">
              <div className="space-y-12">
                {changelogs?.map((log) => {
                  const entries = (log.entries_json as any[]) || [];
                  return (
                    <div key={log.id} className="relative pl-8 border-l-2 border-primary/20">
                      <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-primary" />
                      <div className="mb-4">
                        <h2 className="font-display text-2xl font-bold text-foreground">
                          Version {log.version}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.released_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      {entries.map((entry: any, i: number) => (
                        <div key={i} className="mb-6">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TAG_COLORS[entry.tag] || "bg-muted text-muted-foreground"}`}
                            >
                              {entry.tag}
                            </span>
                            <h3 className="font-semibold text-foreground">{entry.title}</h3>
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                            {entry.items?.map((item: string, j: number) => (
                              <li key={j}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="roadmap">
              <div className="grid md:grid-cols-3 gap-8">
                {(["in_progress", "coming_soon", "planned"] as const).map((status) => (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="font-display text-xl font-bold text-foreground">
                        {STATUS_LABELS[status]}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {roadmapItems
                        ?.filter((item) => item.status === status)
                        .map((item) => (
                          <Card key={item.id} className="bg-card">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-semibold text-foreground text-sm">{item.title}</h4>
                                {item.phase && (
                                  <Badge variant="outline" className="text-[10px] shrink-0">{item.phase}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">{item.description}</p>
                              <div className="flex items-center justify-between">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 text-xs"
                                  onClick={() => voteMutation.mutate(item.id)}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                  Upvote
                                </Button>
                                <span className="text-xs text-muted-foreground">{item.votes} votes</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-sm text-muted-foreground mt-12">
                Have a feature request? Email{" "}
                <a href="mailto:kevin@solera.vin" className="text-primary hover:underline font-medium">
                  kevin@solera.vin
                </a>{" "}
                — we build what winemakers actually need.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </>
  );
}
