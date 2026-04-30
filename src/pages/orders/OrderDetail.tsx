import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Truck, RefreshCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { FormattedDateTime } from "@/components/timezone";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", payment_failed: "Payment Failed", paid: "Paid",
  processing: "Processing", shipped: "Shipped", delivered: "Delivered", refunded: "Refunded",
};

const NEXT_STATUSES: Record<string, string[]> = {
  paid: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
};

const OrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const [showShipDialog, setShowShipDialog] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [refunding, setRefunding] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-detail", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, inventory_skus:sku_id(label, variety, vintage_year)")
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!orderId,
  });

  const handleStatusUpdate = async (newStatus: string) => {
    if (newStatus === "shipped" && !trackingNumber.trim()) {
      toast.error("Tracking number is required for shipped status");
      return;
    }
    setUpdating(true);
    try {
      const { error } = await supabase.functions.invoke("update-order", {
        body: { order_id: orderId, new_status: newStatus, tracking_number: trackingNumber || null },
      });
      if (error) throw error;
      toast.success(`Order updated to ${STATUS_LABELS[newStatus]}`);
      qc.invalidateQueries({ queryKey: ["order-detail", orderId] });
      setShowShipDialog(false);
      setTrackingNumber("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRefund = async () => {
    setRefunding(true);
    try {
      const { error } = await supabase.functions.invoke("update-order", {
        body: { order_id: orderId, new_status: "refunded" },
      });
      if (error) throw error;
      toast.success("Refund processed");
      qc.invalidateQueries({ queryKey: ["order-detail", orderId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRefunding(false);
    }
  };

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!order) return <div className="p-8 text-muted-foreground">Order not found</div>;

  const nextStatuses = NEXT_STATUSES[order.status] || [];
  const address = order.customer_address_json as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground">Order #{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground"><FormattedDateTime date={order.created_at} format="full" /></p>
        </div>
        <Badge className="text-sm">{STATUS_LABELS[order.status] || order.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader><CardTitle className="font-display">Order Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span>{order.inventory_skus?.label || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Variety</span><span>{order.inventory_skus?.variety || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Vintage</span><span>{order.inventory_skus?.vintage_year || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span>{order.quantity_bottles} bottles</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Unit Price</span><span>${Number(order.unit_price).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${Number(order.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>${Number(order.shipping_cost).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>Total</span><span>${Number(order.total).toFixed(2)}</span></div>
            {order.tracking_number && <div className="flex justify-between"><span className="text-muted-foreground">Tracking</span><span>{order.tracking_number}</span></div>}
            {order.source && order.source !== "manual" && <div className="flex justify-between"><span className="text-muted-foreground">Source</span><Badge variant="secondary" className="capitalize">{order.source}</Badge></div>}
            {(order.stripe_session_id) && <div className="flex justify-between"><span className="text-muted-foreground">Wine Club Ref (legacy)</span><span className="text-xs truncate max-w-[200px]">{order.stripe_session_id}</span></div>}
            {order.compliance_status && order.compliance_status !== "unchecked" && (
              <div className="flex justify-between"><span className="text-muted-foreground">Compliance</span>
                <Badge variant={order.compliance_status === "passed" ? "default" : "destructive"} className="capitalize">{order.compliance_status}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader><CardTitle className="font-display">Customer</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{order.customer_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{order.customer_email}</span></div>
            {address && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground mb-1">Shipping Address</p>
                <p>{address.line1}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p>{address.city}, {address.state} {address.zip}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader><CardTitle className="font-display">Actions</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          {nextStatuses.map((ns) => (
            <Button
              key={ns}
              onClick={() => ns === "shipped" ? setShowShipDialog(true) : handleStatusUpdate(ns)}
              disabled={updating}
            >
              <Truck className="h-4 w-4 mr-2" />
              Mark as {STATUS_LABELS[ns]}
            </Button>
          ))}
          {(order.status === "paid" || order.status === "processing") && (
            <Button variant="destructive" onClick={handleRefund} disabled={refunding}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              {refunding ? "Processing..." : "Refund"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showShipDialog} onOpenChange={setShowShipDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Ship Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tracking Number *</Label>
              <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Enter tracking number" />
            </div>
            <Button onClick={() => handleStatusUpdate("shipped")} disabled={updating || !trackingNumber.trim()} className="w-full">
              {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
              Confirm Shipment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderDetail;
