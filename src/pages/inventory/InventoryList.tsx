import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ArrowUpDown, Package } from "lucide-react";
import { NewSkuDialog } from "@/components/inventory/NewSkuDialog";

const ALLOCATION_LABELS: Record<string, string> = {
  dtc: "DTC",
  wine_club: "Wine Club",
  wholesale: "Wholesale",
  restaurant: "Restaurant",
  library: "Library",
  custom_crush_client: "Custom Crush Client",
};

type SortKey = "label" | "variety" | "vintage_year" | "cases" | "loose_bottles" | "price" | "allocation_type" | "value";

const InventoryList = () => {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const [showNew, setShowNew] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("label");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterAlloc, setFilterAlloc] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  const { data: skus = [], refetch } = useQuery({
    queryKey: ["inventory-skus", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_skus")
        .select("*")
        .eq("org_id", orgId!)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const years = [...new Set(skus.map((s) => s.vintage_year).filter(Boolean))].sort((a, b) => (b ?? 0) - (a ?? 0));

  const filtered = skus.filter((s) => {
    if (filterAlloc !== "all" && (s as any).allocation_type !== filterAlloc) return false;
    if (filterYear !== "all" && String(s.vintage_year) !== filterYear) return false;
    return true;
  });

  const getValue = (s: any): number => {
    const cases = Number(s.cases) || 0;
    const bpc = Number(s.bottles_per_case) || 12;
    const price = Number(s.price) || 0;
    return cases * bpc * price;
  };

  const sorted = [...filtered].sort((a: any, b: any) => {
    let av: any, bv: any;
    if (sortKey === "value") { av = getValue(a); bv = getValue(b); }
    else if (sortKey === "cases" || sortKey === "loose_bottles" || sortKey === "price" || sortKey === "vintage_year") { av = Number(a[sortKey]) || 0; bv = Number(b[sortKey]) || 0; }
    else { av = (a[sortKey] || "").toLowerCase(); bv = (b[sortKey] || "").toLowerCase(); }
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const totalCases = skus.reduce((sum, s) => sum + (Number(s.cases) || 0), 0);
  const totalValue = skus.reduce((sum, s) => sum + getValue(s), 0);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3" /></span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground mt-1">{totalCases} cases · ${totalValue.toLocaleString()} total value</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-2" />New SKU</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterAlloc} onValueChange={setFilterAlloc}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Allocation Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Allocations</SelectItem>
            {Object.entries(ALLOCATION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-none shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Label" field="label" />
                <SortHeader label="Variety" field="variety" />
                <SortHeader label="Year" field="vintage_year" />
                <SortHeader label="Cases" field="cases" />
                <SortHeader label="Loose" field="loose_bottles" />
                <SortHeader label="$/Bottle" field="price" />
                <SortHeader label="Allocation" field="allocation_type" />
                <SortHeader label="Value" field="value" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((sku: any) => (
                <TableRow key={sku.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {}}>
                  <TableCell>
                    <Link to={`/inventory/${sku.id}`} className="font-medium text-foreground hover:underline">
                      {sku.label || "Untitled"}
                    </Link>
                  </TableCell>
                  <TableCell>{sku.variety || "—"}</TableCell>
                  <TableCell>{sku.vintage_year || "—"}</TableCell>
                  <TableCell>{Number(sku.cases) || 0}</TableCell>
                  <TableCell>{Number(sku.loose_bottles) || 0}</TableCell>
                  <TableCell>${Number(sku.price)?.toFixed(2) || "0.00"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ALLOCATION_LABELS[(sku as any).allocation_type] || sku.allocation_type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">${getValue(sku).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    No SKUs found. Create your first one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewSkuDialog open={showNew} onOpenChange={setShowNew} onCreated={refetch} />
    </div>
  );
};

export default InventoryList;
