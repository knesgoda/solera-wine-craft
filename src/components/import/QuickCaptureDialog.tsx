import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTierGate } from "@/hooks/useTierGate";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface QuickCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vintageId?: string;
}

export function QuickCaptureDialog({ open, onOpenChange, vintageId }: QuickCaptureDialogProps) {
  const navigate = useNavigate();
  const { profile, organization } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [multiPage, setMultiPage] = useState(false);
  const proGate = useTierGate("small_boutique");

  const processFile = async (file: File) => {
    if (!profile?.org_id) return;
    setUploading(true);

    try {
      // Upload to storage
      const orgId = profile.org_id;
      const filePath = `${orgId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("handwritten-imports")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Create session
      const { data: session, error: sessionErr } = await supabase
        .from("handwritten_import_sessions")
        .insert({
          org_id: orgId,
          created_by: profile.id,
          page_count: 1,
        } as any)
        .select("id")
        .single();
      if (sessionErr) throw sessionErr;

      // Call extraction
      const { data: extraction, error: extractErr } = await supabase.functions.invoke(
        "extract-handwritten-notes",
        {
          body: {
            imageBase64: base64,
            mimeType: file.type || "image/jpeg",
            orgId,
            sessionId: session.id,
          },
        }
      );
      if (extractErr) throw extractErr;

      onOpenChange(false);
      navigate("/import/handwritten", {
        state: {
          sessionId: session.id,
          extractionData: extraction,
          imageUrl: filePath,
          vintageId,
        },
      });
    } catch (err: any) {
      console.error("Quick capture error:", err);
      toast.error(err.message || "Failed to process image");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Handwritten Notes</DialogTitle>
        </DialogHeader>

        {uploading ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processing image with AI…</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="h-6 w-6" />
                <span className="text-sm">Take Photo</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm">Upload Image</span>
              </Button>
            </div>

            {proGate.allowed && (
              <div className="flex items-center gap-2">
                <Switch id="multi-page" checked={multiPage} onCheckedChange={setMultiPage} />
                <Label htmlFor="multi-page" className="text-sm">Scan Multiple Pages</Label>
              </div>
            )}

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/heic,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
