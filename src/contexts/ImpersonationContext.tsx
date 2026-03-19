import React, { createContext, useContext, useState, useCallback } from "react";

interface ImpersonationState {
  active: boolean;
  orgId: string | null;
  orgName: string | null;
}

interface ImpersonationContextType extends ImpersonationState {
  startImpersonation: (orgId: string, orgName: string) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  active: false,
  orgId: null,
  orgName: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
});

export const useImpersonation = () => useContext(ImpersonationContext);

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ImpersonationState>(() => {
    try {
      const stored = localStorage.getItem("admin_impersonation");
      if (stored) {
        const parsed = JSON.parse(stored);
        return { active: true, orgId: parsed.orgId, orgName: parsed.orgName };
      }
    } catch {}
    return { active: false, orgId: null, orgName: null };
  });

  const startImpersonation = useCallback((orgId: string, orgName: string) => {
    localStorage.setItem("admin_impersonation", JSON.stringify({ orgId, orgName }));
    setState({ active: true, orgId, orgName });
  }, []);

  const stopImpersonation = useCallback(() => {
    localStorage.removeItem("admin_impersonation");
    setState({ active: false, orgId: null, orgName: null });
  }, []);

  return (
    <ImpersonationContext.Provider value={{ ...state, startImpersonation, stopImpersonation }}>
      {children}
    </ImpersonationContext.Provider>
  );
};
