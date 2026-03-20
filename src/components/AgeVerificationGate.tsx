import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import soleraLogo from "@/assets/solera-logo.png";

const STORAGE_KEY = "solera_age_verified";

export function AgeVerificationGate({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const navigate = useNavigate();

  if (verified) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl bg-cream p-8 shadow-2xl text-center space-y-6">
        <img src={soleraLogo} alt="Solera" className="h-16 w-16 mx-auto" />
        <h2 className="text-2xl font-display font-bold text-primary">Are you 21 or older?</h2>
        <p className="text-sm text-muted-foreground">
          You must be of legal drinking age to access our wine store.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/")}
          >
            No
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              localStorage.setItem(STORAGE_KEY, "true");
              setVerified(true);
            }}
          >
            Yes, I'm 21+
          </Button>
        </div>
      </div>
    </div>
  );
}
