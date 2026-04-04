import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", payment_failed: "Payment Failed", paid: "Paid",
  processing: "Processing", shipped: "Shipped", delivered: "Delivered", refunded: "Refunded",
};

const CustomerDetail = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-detail", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", customerId!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!customerId,
  });

  useEffect(() => {
    if (customer) setNotes(customer.notes || "");
  }, [customer]);

  const { data: orders = [] } = useQuery({
    queryKey: ["customer-orders", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, inventory_skus:sku_id(label)")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!customerId,
  });

  const saveNotes = async () => {
    try {
      await supabase.from("customers").update({ notes }).eq("id", customerId!);
      toast.success("Notes saved");
      setEditingNotes(false);
      qc.invalidateQueries({ queryKey: ["customer-detail", customerId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!customer) return <div className="p-8 text-muted-foreground">Customer not found</div>;

  const address = customer.address_json as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{customer.first_name} {customer.last_name}</h1>
          <p className="text-muted-foreground">{customer.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold font-display">{customer.total_orders}</p></CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Spent</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold font-display">${Number(customer.total_spent).toLocaleString()}</p></CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Customer Since</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold font-display">{format(new Date(customer.created_at), "MMM yyyy")}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader><CardTitle className="font-display">Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{customer.email}</span></div>
            {customer.phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{customer.phone}</span></div>}
            {address && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground mb-1">Address</p>
                <p>{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p>{address.city}, {address.state} {address.zip}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Notes</CardTitle>
            {!editingNotes && <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>Edit</Button>}
          </CardHeader>
          <CardContent>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNotes}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{customer.notes || "No notes yet"}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Order History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o: any) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/orders/${o.id}`)}>
                  <TableCell>{format(new Date(o.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>{o.inventory_skus?.label || "—"}</TableCell>
                  <TableCell>{o.quantity_bottles}</TableCell>
                  <TableCell className="font-medium">${Number(o.total).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="secondary">{STATUS_LABELS[o.status] || o.status}</Badge></TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No orders</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerDetail;
