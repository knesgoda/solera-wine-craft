import { getTimezoneAbbr } from "@/lib/timezone";
import { Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getOrgTimezone } from "@/lib/timezone";

export function TimezoneIndicator() {
  const abbr = getTimezoneAbbr();
  const full = getOrgTimezone();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-default select-none">
            <Globe className="h-3 w-3" />
            {abbr}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">All times shown in {full.replace(/_/g, " ")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
