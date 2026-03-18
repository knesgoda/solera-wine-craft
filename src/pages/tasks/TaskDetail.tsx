import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Clock, MapPin, ImagePlus, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useRef, useState } from "react";
import { toast } from "sonner";

export default function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { organization } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const { data: block } = useQuery({
    queryKey: ["block", task?.block_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocks")
        .select("name, vineyard_id, vineyards(name)")
        .eq("id", task!.block_id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!task?.block_id,
  });

  const markComplete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "complete" as any })
        .eq("id", taskId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task marked as complete");
    },
  });

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${organization!.id}/${taskId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("task-photos")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("task-photos")
        .getPublicUrl(path);

      const currentPhotos = task?.photos || [];
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ photos: [...currentPhotos, urlData.publicUrl] })
        .eq("id", taskId!);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      toast.success("Photo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Task not found.</p>
        <Button variant="link" onClick={() => navigate("/tasks")}>Back to tasks</Button>
      </div>
    );
  }

  const statusLabel = task.status === "complete" ? "Complete" : task.status === "in_progress" ? "In Progress" : "Pending";

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-32 md:pb-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">{task.title}</CardTitle>
            <Badge variant="secondary">{statusLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {task.due_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Due {format(parseISO(task.due_date), "MMMM d, yyyy")}</span>
            </div>
          )}

          {block && (
            <div className="text-sm">
              <span className="text-muted-foreground">Block:</span>{" "}
              <span className="font-medium text-foreground">{block.name}</span>
              {block.vineyards?.name && (
                <span className="text-muted-foreground"> · {block.vineyards.name}</span>
              )}
            </div>
          )}

          {(task.gps_lat || task.gps_lng) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{task.gps_lat}, {task.gps_lng}</span>
            </div>
          )}

          {task.instructions && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Instructions</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.instructions}</p>
            </div>
          )}

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Photos</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImagePlus className="h-4 w-4 mr-2" />}
                Add Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadPhoto(file);
                  e.target.value = "";
                }}
              />
            </div>
            {task.photos && task.photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {task.photos.map((url: string, i: number) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Task photo ${i + 1}`}
                    className="rounded-lg object-cover aspect-square w-full"
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No photos yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mobile-friendly complete button */}
      {task.status !== "complete" && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 p-4 md:static md:p-0 md:mt-4">
          <Button
            className="w-full h-14 md:h-10 text-lg md:text-sm"
            onClick={() => markComplete.mutate()}
            disabled={markComplete.isPending}
          >
            {markComplete.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-5 w-5 mr-2" />
            )}
            Mark Complete
          </Button>
        </div>
      )}
    </div>
  );
}
