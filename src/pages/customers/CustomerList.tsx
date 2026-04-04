import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const CustomerList = () => {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: { customers, total } = { customers: [], total: 0 }, isError: customersError } = useQuery({
    queryKey: ["customers", orgId, page],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("customers")
        .select("*", { count: "exact" })
        .eq("org_id", orgId!)
        .order("total_spent", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      return { customers: data as any[], total: count || 0 };
    },
    enabled: !!orgId,
  });

  const totalPages = Math.ceil(total / pageSize);

  if (customersError) return <div className="py-12 text-center text-destructive">Failed to load customers. Please refresh the page.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Customers</h1>
        <p className="text-muted-foreground mt-1">{total} customers</p>
      </div>

      <Card className="border-none shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/customers/${c.id}`} className="font-medium text-foreground hover:underline">
                      {c.first_name} {c.last_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell>{c.total_orders}</TableCell>
                  <TableCell className="font-medium">${Number(c.total_spent).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      icon={Users}
                      title="No customers yet"
                      description="Customers will appear here when orders are synced or added manually."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerList;
