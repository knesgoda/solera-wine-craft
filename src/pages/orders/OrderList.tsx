import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingBag } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  payment_failed: "bg-red-100 text-red-800",
  paid: "bg-green-100 text-green-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-200 text-green-900",
  refunded: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", payment_failed: "Payment Failed", paid: "Paid",
  processing: "Processing", shipped: "Shipped", delivered: "Delivered", refunded: "Refunded",
};

const OrderList = () => {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", orgId, filterStatus, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("*, inventory_skus:sku_id(label)")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);

      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const totalRevenue = orders.filter((o: any) => o.status === "paid" || o.status === "processing" || o.status === "shipped" || o.status === "delivered")
    .reduce((s: number, o: any) => s + Number(o.total), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground mt-1">{orders.length} orders · ${totalRevenue.toLocaleString()} revenue</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" placeholder="To" />
      </div>

      <Card className="border-none shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell>{format(new Date(order.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <Link to={`/orders/${order.id}`} className="font-medium text-foreground hover:underline">
                      {order.customer_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{order.inventory_skus?.label || "—"}</TableCell>
                  <TableCell>{order.quantity_bottles}</TableCell>
                  <TableCell className="font-medium">${Number(order.total).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[order.status] || ""}>{STATUS_LABELS[order.status] || order.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />No orders yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderList;
