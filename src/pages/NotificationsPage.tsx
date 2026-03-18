import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCheck, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TYPE_COLORS: Record<string, string> = {
  alert: "bg-destructive/10 text-destructive",
  harvest: "bg-green-100 text-green-800",
  system: "bg-muted text-muted-foreground",
  task: "bg-blue-100 text-blue-800",
};

const NotificationsPage = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = notifications.filter((n: any) => {
    if (typeFilter === "unread") return !n.read;
    if (typeFilter !== "all") return n.type === typeFilter;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllAsRead.mutate()}>
            <CheckCheck className="h-4 w-4 mr-2" /> Mark all as read
          </Button>
        )}
      </div>

      <Tabs value={typeFilter} onValueChange={setTypeFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="alert">Alerts</TabsTrigger>
          <TabsTrigger value="harvest">Harvest</TabsTrigger>
          <TabsTrigger value="task">Tasks</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-display text-lg font-semibold mb-1">No notifications</h3>
            <p className="text-muted-foreground text-sm">
              {typeFilter === "unread" ? "You're all caught up!" : "Nothing here yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n: any) => (
            <Card
              key={n.id}
              className={`border-none shadow-sm cursor-pointer hover:shadow-md transition-shadow ${!n.read ? "ring-1 ring-primary/20" : ""}`}
              onClick={() => { if (!n.read) markAsRead.mutate(n.id); }}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[n.type] || ""}`}>
                        {n.type}
                      </Badge>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-sm text-foreground">{n.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
