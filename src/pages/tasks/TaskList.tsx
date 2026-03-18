import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Calendar as CalendarIcon, List, MapPin, Clock, CheckCircle2 } from "lucide-react";
import { format, isPast, isToday, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";

type TaskRow = {
  id: string;
  org_id: string;
  block_id: string | null;
  assigned_to: string | null;
  title: string;
  due_date: string | null;
  status: string;
  instructions: string | null;
  photos: string[] | null;
  gps_lat: number | null;
  gps_lng: number | null;
  offline_queued: boolean;
  created_at: string;
  updated_at: string;
};

export default function TaskList() {
  const { organization } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("org_id", organization!.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as TaskRow[];
    },
    enabled: !!organization?.id,
  });

  const upcoming = tasks.filter(
    (t) => t.status !== "complete" && (!t.due_date || !isPast(parseISO(t.due_date)) || isToday(parseISO(t.due_date)))
  );
  const overdue = tasks.filter(
    (t) => t.status !== "complete" && t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date))
  );
  const completed = tasks.filter((t) => t.status === "complete");

  const statusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-muted text-muted-foreground";
      case "in_progress": return "bg-secondary/20 text-secondary";
      case "complete": return "bg-primary/10 text-primary";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const renderTask = (task: TaskRow) => (
    <Card
      key={task.id}
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/tasks/${task.id}`)}
    >
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{task.title}</p>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {format(parseISO(task.due_date), "MMM d")}
              </span>
            )}
            {(task.gps_lat || task.gps_lng) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                GPS
              </span>
            )}
          </div>
        </div>
        <Badge className={statusColor(task.status)} variant="secondary">
          {task.status.replace("_", " ")}
        </Badge>
      </CardContent>
    </Card>
  );

  const renderList = (items: TaskRow[], empty: string) =>
    items.length === 0 ? (
      <p className="text-muted-foreground text-center py-12">{empty}</p>
    ) : (
      <div className="space-y-2">{items.map(renderTask)}</div>
    );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Task
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <TaskCalendarView tasks={tasks} onTaskClick={(id) => navigate(`/tasks/${id}`)} />
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList className="w-full">
            <TabsTrigger value="upcoming" className="flex-1">
              Upcoming {upcoming.length > 0 && `(${upcoming.length})`}
            </TabsTrigger>
            <TabsTrigger value="overdue" className="flex-1">
              Overdue {overdue.length > 0 && `(${overdue.length})`}
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">
              Completed {completed.length > 0 && `(${completed.length})`}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="mt-4">
            {isLoading ? <p className="text-center py-12 text-muted-foreground">Loading…</p> : renderList(upcoming, "No upcoming tasks")}
          </TabsContent>
          <TabsContent value="overdue" className="mt-4">
            {renderList(overdue, "No overdue tasks 🎉")}
          </TabsContent>
          <TabsContent value="completed" className="mt-4">
            {renderList(completed, "No completed tasks yet")}
          </TabsContent>
        </Tabs>
      )}

      <NewTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
