import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Facility {
  id: string;
  name: string;
  facility_type: string;
  address: string | null;
  region: string | null;
  active: boolean;
}

interface FacilityContextType {
  facilities: Facility[];
  selectedFacilityId: string | null; // null = "All Facilities"
  setSelectedFacilityId: (id: string | null) => void;
  isMultiFacility: boolean;
  loading: boolean;
}

const FacilityContext = createContext<FacilityContextType>({
  facilities: [],
  selectedFacilityId: null,
  setSelectedFacilityId: () => {},
  isMultiFacility: false,
  loading: true,
});

export const useFacility = () => useContext(FacilityContext);

export const FacilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, organization } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isEnterprise = organization?.tier === "enterprise";

  useEffect(() => {
    if (!profile?.org_id || !isEnterprise) {
      setLoading(false);
      return;
    }

    supabase
      .from("facilities")
      .select("id, name, facility_type, address, region, active")
      .eq("parent_org_id", profile.org_id)
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        setFacilities((data as any[]) || []);
        setLoading(false);
      });
  }, [profile?.org_id, isEnterprise]);

  const isMultiFacility = isEnterprise && facilities.length >= 2;

  return (
    <FacilityContext.Provider value={{ facilities, selectedFacilityId, setSelectedFacilityId, isMultiFacility, loading }}>
      {children}
    </FacilityContext.Provider>
  );
};
