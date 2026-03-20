import { useState, useEffect, useMemo } from "react";
import { AgeVerificationGate } from "@/components/AgeVerificationGate";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Plus, Minus, X, Wine, Loader2, GlassWater } from "lucide-react";
import { toast } from "sonner";

interface CartItem {
  sku_id: string;
  label: string;
  variety: string | null;
  vintage_year: number | null;
  unit_price: number;
  quantity: number;
  label_image_url: string | null;
}

const ALLOCATION_LABELS: Record<string, string> = {
  dtc: "DTC", wine_club: "Wine Club", wholesale: "Wholesale",
  restaurant: "Restaurant", library: "Library", custom_crush_client: "Custom Crush Client",
};

const PublicStore = () => {
  const [ageVerified, setAgeVerified] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  // Checkout form
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custAddress, setCustAddress] = useState({ line1: "", line2: "", city: "", state: "", zip: "" });

  // Check localStorage for age verification
  useEffect(() => {
    if (localStorage.getItem("solera_age_verified") === "true") {
      setAgeVerified(true);
    }
  }, []);

  // Get first enabled storefront config (public/anon access)
  const { data: storeConfig } = useQuery({
    queryKey: ["public-store-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storefront_config")
        .select("*")
        .eq("enabled", true)
        .limit(1)
        .single();
      if (error) return null;
      return data as any;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["public-store-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_skus")
        .select("*")
        .eq("active", true)
        .eq("allocation_type", "dtc");
      if (error) throw error;
      return data as any[];
    },
    enabled: ageVerified,
  });

  const { data: wineClubs = [] } = useQuery({
    queryKey: ["public-wine-clubs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wine_clubs")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data as any[];
    },
    enabled: ageVerified,
  });

  const [joiningClub, setJoiningClub] = useState<string | null>(null);
  const [clubName, setClubName] = useState("");
  const [clubEmail, setClubEmail] = useState("");
  const [clubAddress, setClubAddress] = useState({ line1: "", city: "", state: "", zip: "" });

  const handleJoinClub = async (club: any) => {
    if (!clubName.trim() || !clubEmail.trim()) {
      toast.error("Please fill in name and email");
      return;
    }
    try {
      const orgId = storeConfig?.org_id;
      if (!orgId) throw new Error("Store not configured");
      const { data, error } = await supabase.functions.invoke("club-subscribe", {
        body: {
          org_id: orgId,
          club_id: club.id,
          customer_name: clubName,
          customer_email: clubEmail,
          shipping_address: clubAddress.line1 ? clubAddress : null,
          success_url: `${window.location.origin}/store?club_success=true`,
          cancel_url: `${window.location.origin}/store?club_canceled=true`,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start subscription");
    }
  };

  const FREQ_LABELS: Record<string, string> = {
    monthly: "Monthly", bimonthly: "Every 2 Months", quarterly: "Quarterly",
    twice_yearly: "Twice a Year", annual: "Annually",
  };

  const addToCart = (sku: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.sku_id === sku.id);
      if (existing) {
        return prev.map((c) => c.sku_id === sku.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        sku_id: sku.id,
        label: sku.label,
        variety: sku.variety,
        vintage_year: sku.vintage_year,
        unit_price: Number(sku.price) || 0,
        quantity: 1,
        label_image_url: sku.label_image_url,
      }];
    });
    toast.success("Added to cart");
  };

  const updateQty = (skuId: string, delta: number) => {
    setCart((prev) => prev.map((c) => c.sku_id === skuId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  };

  const removeFromCart = (skuId: string) => {
    setCart((prev) => prev.filter((c) => c.sku_id !== skuId));
  };

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.unit_price * c.quantity, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);

  const handleCheckout = async () => {
    if (!custName.trim() || !custEmail.trim()) {
      toast.error("Please fill in name and email");
      return;
    }
    setCheckingOut(true);
    try {
      const orgId = storeConfig?.org_id;
      if (!orgId) throw new Error("Store not configured");

      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          org_id: orgId,
          customer_name: custName,
          customer_email: custEmail,
          customer_address: custAddress.line1 ? custAddress : null,
          line_items: cart.map((c) => ({
            sku_id: c.sku_id,
            label: c.label,
            variety: c.variety,
            vintage_year: c.vintage_year,
            unit_price: c.unit_price,
            quantity: c.quantity,
          })),
          success_url: `${window.location.origin}/store?success=true`,
          cancel_url: `${window.location.origin}/store?canceled=true`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleAgeConfirm = () => {
    localStorage.setItem("solera_age_verified", "true");
    setAgeVerified(true);
  };

  const handleAgeExit = () => {
    window.location.href = "https://www.google.com";
  };

  // Show success/canceled messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Order placed successfully! Check your email for confirmation.");
      setCart([]);
      window.history.replaceState({}, "", "/store");
    } else if (params.get("canceled") === "true") {
      toast.info("Checkout canceled");
      window.history.replaceState({}, "", "/store");
    } else if (params.get("club_success") === "true") {
      toast.success("Welcome to the wine club! Check your email for details.");
      window.history.replaceState({}, "", "/store");
    } else if (params.get("club_canceled") === "true") {
      toast.info("Club signup canceled");
      window.history.replaceState({}, "", "/store");
    }
  }, []);

  // Age gate
  if (!ageVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-xl">
          <CardContent className="p-8 text-center space-y-6">
            <Wine className="h-16 w-16 mx-auto text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground">Age Verification</h1>
            <p className="text-muted-foreground">You must be 21 years of age or older to enter this site.</p>
            <p className="text-sm font-medium text-foreground">I confirm I am 21 years of age or older</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={handleAgeConfirm} size="lg">Enter</Button>
              <Button variant="outline" onClick={handleAgeExit} size="lg">Exit</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const storeName = storeConfig?.store_name || "Wine Shop";

  return (
    <AgeVerificationGate>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {storeConfig?.store_logo_url && (
              <img src={storeConfig.store_logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
            )}
            <h1 className="text-xl font-display font-bold text-foreground">{storeName}</h1>
          </div>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-display">Your Cart</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4 flex-1">
                {cart.length === 0 && <p className="text-muted-foreground text-center py-8">Cart is empty</p>}
                {cart.map((item) => (
                  <div key={item.sku_id} className="flex gap-3 items-center p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">${item.unit_price.toFixed(2)}/bottle</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.sku_id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(item.sku_id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.sku_id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {cart.length > 0 && (
                <div className="mt-6 border-t pt-4 space-y-4">
                  <div className="flex justify-between font-medium">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <Button className="w-full" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>
                    Checkout
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
        {storeConfig?.store_description && (
          <div className="max-w-7xl mx-auto px-4 pb-3">
            <p className="text-sm text-muted-foreground">{storeConfig.store_description}</p>
          </div>
        )}
      </header>

      {/* Product grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((sku: any) => (
            <Card key={sku.id} className="border-none shadow-md hover:shadow-lg transition-shadow overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {sku.label_image_url ? (
                  <img src={sku.label_image_url} alt={sku.label} className="w-full h-full object-cover" />
                ) : (
                  <Wine className="h-16 w-16 text-muted-foreground/30" />
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-display font-semibold text-foreground">{sku.label}</h3>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  {sku.variety && <span>{sku.variety}</span>}
                  {sku.vintage_year && <span>· {sku.vintage_year}</span>}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-lg font-bold text-foreground">${Number(sku.price)?.toFixed(2)}</span>
                  <Button size="sm" onClick={() => addToCart(sku)}>
                    <Plus className="h-4 w-4 mr-1" />Add to Cart
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {products.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Wine className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No wines available at this time</p>
          </div>
        )}

        {/* Wine Club Section */}
        {wineClubs.length > 0 && (
          <div className="mt-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold text-foreground flex items-center justify-center gap-2">
                <GlassWater className="h-6 w-6 text-primary" /> Join Our Wine Club
              </h2>
              <p className="text-muted-foreground mt-2">Exclusive selections delivered to your door</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wineClubs.map((club: any) => (
                <Card key={club.id} className="border-none shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="font-display">{club.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {club.description && <p className="text-sm text-muted-foreground">{club.description}</p>}
                    <div className="text-sm space-y-1">
                      <p><span className="text-muted-foreground">Frequency:</span> {FREQ_LABELS[club.frequency] || club.frequency}</p>
                      <p><span className="text-muted-foreground">Bottles:</span> {club.bottles_per_shipment} per shipment</p>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xl font-bold text-foreground">${Number(club.price_per_shipment).toFixed(2)}</span>
                      <Button onClick={() => setJoiningClub(club.id)}>Join Club</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Club Signup Dialog */}
      <Dialog open={!!joiningClub} onOpenChange={(open) => !open && setJoiningClub(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Join Wine Club</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Full Name *</Label><Input value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="John Smith" /></div>
            <div><Label>Email *</Label><Input type="email" value={clubEmail} onChange={(e) => setClubEmail(e.target.value)} placeholder="john@example.com" /></div>
            <div className="space-y-2">
              <Label>Shipping Address</Label>
              <Input placeholder="Address" value={clubAddress.line1} onChange={(e) => setClubAddress({ ...clubAddress, line1: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="City" value={clubAddress.city} onChange={(e) => setClubAddress({ ...clubAddress, city: e.target.value })} />
                <Input placeholder="State" value={clubAddress.state} onChange={(e) => setClubAddress({ ...clubAddress, state: e.target.value })} />
                <Input placeholder="ZIP" value={clubAddress.zip} onChange={(e) => setClubAddress({ ...clubAddress, zip: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" onClick={() => { const club = wineClubs.find((c: any) => c.id === joiningClub); if (club) handleJoinClub(club); }}>
              Subscribe — ${Number(wineClubs.find((c: any) => c.id === joiningClub)?.price_per_shipment || 0).toFixed(2)}/shipment
            </Button>
            <p className="text-xs text-muted-foreground text-center">You'll be redirected to Stripe for secure payment</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Checkout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3 border-b pb-4">
              {cart.map((item) => (
                <div key={item.sku_id} className="flex justify-between text-sm">
                  <span>{item.label} × {item.quantity}</span>
                  <span className="font-medium">${(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold pt-2">
                <span>Total</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="John Smith" />
              </div>
              <div className="col-span-2">
                <Label>Email *</Label>
                <Input type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="john@example.com" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Shipping Address</Label>
              <Input placeholder="Address Line 1" value={custAddress.line1} onChange={(e) => setCustAddress({ ...custAddress, line1: e.target.value })} />
              <Input placeholder="Address Line 2" value={custAddress.line2} onChange={(e) => setCustAddress({ ...custAddress, line2: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="City" value={custAddress.city} onChange={(e) => setCustAddress({ ...custAddress, city: e.target.value })} />
                <Input placeholder="State" value={custAddress.state} onChange={(e) => setCustAddress({ ...custAddress, state: e.target.value })} />
                <Input placeholder="ZIP" value={custAddress.zip} onChange={(e) => setCustAddress({ ...custAddress, zip: e.target.value })} />
              </div>
            </div>

            <Button onClick={handleCheckout} disabled={checkingOut || cart.length === 0} className="w-full" size="lg">
              {checkingOut ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : `Pay $${subtotal.toFixed(2)}`}
            </Button>
            <p className="text-xs text-muted-foreground text-center">You'll be redirected to Stripe for secure payment</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t text-center">
        <p className="text-sm text-muted-foreground">
          Powered by <a href="https://solera.vin" className="text-primary hover:underline font-medium">Solera</a> — Winery management from vine to bottle to doorstep.
        </p>
      </footer>
    </div>
    </AgeVerificationGate>
  );

export default PublicStore;
