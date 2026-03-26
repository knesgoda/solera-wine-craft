import { LogOut, Building } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFacility } from "@/contexts/FacilityContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { TimezoneIndicator } from "@/components/timezone";

export function TopBar() {
  const { organization, profile, signOut } = useAuth();
  const { facilities, selectedFacilityId, setSelectedFacilityId, isMultiFacility } = useFacility();
  const navigate = useNavigate();

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="hidden md:flex" />
        <h2 className="font-display text-lg font-semibold text-foreground truncate">
          {organization?.name || "Solera"}
        </h2>
        {isMultiFacility && (
          <Select value={selectedFacilityId || "all"} onValueChange={(v) => setSelectedFacilityId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <Building className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue placeholder="All Facilities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Facilities</SelectItem>
              {facilities.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
