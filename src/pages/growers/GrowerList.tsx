import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Wheat, Loader2 } from "lucide-react";
import { GrowerDialog } from "@/components/growers/GrowerDialog";
import { SEOHead } from "@/components/SEOHead";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  inactive: "bg-muted text-muted-foreground",
  prospect: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export default function GrowerList() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const { data, isLoading, isError: growersError } = useQuery({
    queryKey: ["growers", organization?.id, statusFilter, search, page],
    queryFn: async () => {
      let query = supabase
        .from("growers")
        .select("*, grower_contracts(id, status)", { count: "exact" })
        .eq("org_id", organization!.id)
        .order("name");

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      }
      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,contact_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
      }
      query = query.range(page * pageSize, (page + 1) * pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { growers: data || [], total: count || 0 };
    },
    enabled: !!organization?.id,
  });

  const growers = data?.growers || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const getActiveContractCount = (grower: any) =>
    (grower.grower_contracts || []).filter((c: any) => c.status === "active").length;

  if (growersError) return <div className="py-12 text-center text-destructive">Failed to load growers. Please refresh the page.</div>;

  return (
    <div className="space-y-6">
      <SEOHead title="Growers | Solera" description="Manage grape growers and purchase agreements" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Growers</h1>
          <p className="text-sm text-muted-foreground">Manage grape growers and purchase contracts</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Grower
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, contact, or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : growers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-lg">
          <Wheat className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No growers yet</h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md">
            Add your first grower to start managing grape purchase contracts.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Grower
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Primary Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Active Contracts</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {growers.map((g: any) => (
                  <TableRow
                    key={g.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/growers/${g.id}`)}
                  >
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{g.contact_name || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{g.phone || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{g.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[g.status] || ""}>
                        {g.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{getActiveContractCount(g)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/growers/${g.id}`); }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      <GrowerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
