import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Plug, ShoppingCart, Truck, ShieldCheck, Wine, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const integrations = [
  {
    key: "commerce7",
    name: "Commerce7",
    description: "Sync inventory and import orders from Commerce7 POS and e-commerce.",
    icon: ShoppingCart,
    path: "/settings/integrations/commerce7",
    table: "commerce7_config" as const,
  },
  {
    key: "winedirect",
    name: "WineDirect",
    description: "Import orders from WineDirect fulfillment platform.",
    icon: Wine,
    path: "/settings/integrations/winedirect",
    table: "winedirect_config" as const,
  },
  {
    key: "shopify",
    name: "Shopify",
    description: "Push product catalog and sync inventory to your Shopify store.",
    icon: ExternalLink,
    path: "/settings/integrations/shopify",
    table: "shopify_config" as const,
  },
  {
    key: "shipcompliant",
    name: "ShipCompliant",
    description: "Automated DTC compliance checks before shipping orders.",
    icon: ShieldCheck,
    path: "/settings/integrations/shipcompliant",
    table: "shipcompliant_config" as const,
  },
];

const IntegrationsHub = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const orgId = profile?.org_id;

  const { data: configs } = useQuery({
    queryKey: ["integration-configs", orgId],
    queryFn: async () => {
      const [c7, wd, sh, sc] = await Promise.all([
        supabase.from("commerce7_config").select("active, last_synced_at").eq("org_id", orgId!).maybeSingle(),
        supabase.from("winedirect_config").select("active, last_synced_at").eq("org_id", orgId!).maybeSingle(),
        supabase.from("shopify_config").select("active, last_synced_at").eq("org_id", orgId!).maybeSingle(),
        supabase.from("shipcompliant_config").select("active").eq("org_id", orgId!).maybeSingle(),
      ]);
      return {
        commerce7: c7.data,
        winedirect: wd.data,
        shopify: sh.data,
        shipcompliant: sc.data,
      };
    },
    enabled: !!orgId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Integrations</h1>
        <p className="text-muted-foreground">Connect third-party platforms to sync data with Solera.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((int) => {
          const cfg = configs?.[int.key as keyof typeof configs] as any;
          const isActive = cfg?.active;
          const lastSync = cfg?.last_synced_at;

          return (
            <Card key={int.key} className="border-none shadow-md">
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <int.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-lg">{int.name}</CardTitle>
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {isActive ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">{int.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {lastSync ? `Last synced ${format(new Date(lastSync), "MMM d, h:mm a")}` : "Never synced"}
                </div>
                <Button variant={isActive ? "outline" : "default"} onClick={() => navigate(int.path)}>
                  <Plug className="h-4 w-4 mr-2" />
                  {isActive ? "Settings" : "Connect"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default IntegrationsHub;
