import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isPushSupported, requestPushPermission } from "@/lib/pushNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

export function PushPrompt() {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || !isPushSupported()) return;
    if (profile?.push_subscription) return; // Already subscribed
    if (Notification.permission === "granted") return;

    // Show prompt after short delay on first mobile login
    const dismissed = sessionStorage.getItem("push-prompt-dismissed");
    if (dismissed) return;

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, [user, profile]);

  const handleEnable = async () => {
    if (user) await requestPushPermission(user.id);
    setShow(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("push-prompt-dismissed", "true");
    setShow(false);
  };

  const content = (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="p-4 rounded-full bg-primary/10">
          <Bell className="h-8 w-8 text-primary" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground text-center">
        Get harvest window alerts and overdue task reminders even when Solera is closed.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 min-h-[44px]" onClick={handleDismiss}>Not Now</Button>
        <Button className="flex-1 min-h-[44px]" onClick={handleEnable}>Enable</Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={show} onOpenChange={(o) => !o && handleDismiss()}>
        <SheetContent side="bottom" className="pb-safe">
          <SheetHeader>
            <SheetTitle>Enable Notifications</SheetTitle>
            <SheetDescription>Stay informed about your winery</SheetDescription>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={show} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable Notifications</DialogTitle>
          <DialogDescription>Stay informed about your winery</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
