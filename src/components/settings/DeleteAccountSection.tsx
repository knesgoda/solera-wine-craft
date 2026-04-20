import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";

/**
 * Self-serve organization deletion. Owner-only.
 * Triggers a final export (unless skipped), then calls delete-organization edge function.
 */
export default function DeleteAccountSection() {
  const { organization, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmName, setConfirmName] = useState("");
  const [skipExport, setSkipExport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const orgName = organization?.name ?? "";
  const matches = confirmName.trim() === orgName && orgName.length > 0;

  async function handleDelete() {
    if (!matches) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-organization", {
        body: { confirmationName: confirmName.trim(), skipExport },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success("Account deleted. Goodbye.");
      // Sign out and redirect
      await signOut().catch(() => {});
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete account");
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Delete Account
        </CardTitle>
        <CardDescription>
          Permanently delete your organization, all winery data, and every user account.
          This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>All vineyards, vintages, lab samples, fermentation logs, vessels, barrels, costs, customers, orders, and clubs will be erased.</li>
          <li>A final data export (Excel) will be generated and emailed unless you opt out.</li>
          <li>All team members will lose access immediately.</li>
          <li>If you have an active subscription, cancel it in Billing first to avoid further charges.</li>
        </ul>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm account deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Type <span className="font-mono font-semibold text-foreground">{orgName}</span> to confirm.
                This action is permanent.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="confirm-org-name">Organization name</Label>
                <Input
                  id="confirm-org-name"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={orgName}
                  autoComplete="off"
                />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="skip-export"
                  checked={skipExport}
                  onCheckedChange={(v) => setSkipExport(!!v)}
                />
                <Label htmlFor="skip-export" className="text-sm font-normal leading-snug cursor-pointer">
                  Skip final data export (I have already exported my data)
                </Label>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={!matches || submitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitting ? "Deleting…" : "Permanently delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}