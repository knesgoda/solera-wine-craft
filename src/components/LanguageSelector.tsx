import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LanguageSelectorProps {
  /** Compact mode for auth pages — just a globe icon */
  compact?: boolean;
}

export function LanguageSelector({ compact }: LanguageSelectorProps) {
  const { i18n } = useTranslation();
  const auth = useAuthSafe();

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  const handleChange = async (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("solera_language", code);

    // Persist to profile if logged in
    if (auth?.profile?.id) {
      await supabase
        .from("profiles")
        .update({ language: code } as any)
        .eq("id", auth.profile.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} className={compact ? "h-8 w-8" : "gap-1.5"}>
          <Globe className="h-4 w-4" />
          {!compact && <span className="text-sm">{currentLang.nativeLabel}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            className={i18n.language === lang.code ? "bg-accent" : ""}
          >
            <span className="flex-1">{lang.nativeLabel}</span>
            {i18n.language === lang.code && (
              <span className="text-xs text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Safe wrapper that doesn't throw if used outside AuthProvider (e.g., on login page) */
function useAuthSafe() {
  try {
    return useAuth();
  } catch {
    return null;
  }
}
