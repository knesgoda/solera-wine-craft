import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Grower {
  id: string;
  name: string;
  status: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  tax_id: string | null;
  notes: string | null;
}

interface GrowerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grower?: Grower | null;
}

const emptyForm = {
  name: "",
  status: "active",
  contact_name: "",
  email: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  tax_id: "",
  notes: "",
};

export function GrowerDialog({ open, onOpenChange, grower }: GrowerDialogProps) {
  const { organization, user } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = !!grower;

  const [form, setForm] = useState(emptyForm);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (open) {
      if (grower) {
        setForm({
          name: grower.name || "",
          status: grower.status || "active",
          contact_name: grower.contact_name || "",
          email: grower.email || "",
          phone: grower.phone || "",
          address_line1: grower.address_line1 || "",
          address_line2: grower.address_line2 || "",
          city: grower.city || "",
          state: grower.state || "",
          zip: grower.zip || "",
          country: grower.country || "US",
          tax_id: grower.tax_id || "",
          notes: grower.notes || "",
        });
      } else {
        setForm(emptyForm);
      }
      setNameError("");
      setEmailError("");
    }
  }, [open, grower]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    let valid = true;
    if (!form.name.trim()) {
      setNameError("Grower name is required");
      valid = false;
    } else {
      setNameError("");
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setEmailError("Invalid email address");
      valid = false;
    } else {
      setEmailError("");
    }
    return valid;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        status: form.status as any,
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        country: form.country.trim() || "US",
        tax_id: form.tax_id.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (isEdit && grower) {
        const { error } = await supabase
          .from("growers")
          .update({ ...payload, updated_by: user?.id })
          .eq("id", grower.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("growers")
          .insert({ ...payload, org_id: organization!.id, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["growers"] });
      toast({ title: isEdit ? "Grower updated" : "Grower created", description: `${form.name} has been ${isEdit ? "updated" : "added"}.` });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Something went wrong.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Grower" : "Add Grower"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Business / Grower Name *</Label>
            <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            {nameError && <p className="text-sm text-destructive mt-1">{nameError}</p>}
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="contact_name">Primary Contact Name</Label>
            <Input id="contact_name" value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              {emailError && <p className="text-sm text-destructive mt-1">{emailError}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="address_line1">Address Line 1</Label>
            <Input id="address_line1" value={form.address_line1} onChange={(e) => set("address_line1", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input id="address_line2" value={form.address_line2} onChange={(e) => set("address_line2", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="zip">Zip</Label>
              <Input id="zip" value={form.zip} onChange={(e) => set("zip", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="tax_id">Tax ID</Label>
              <Input id="tax_id" value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">For 1099 reporting purposes</p>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Grower"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
