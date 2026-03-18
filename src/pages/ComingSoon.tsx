import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";

const routeNames: Record<string, string> = {
  "/vineyard-ops": "Vineyard Ops",
  "/vintages": "Vintages",
  "/cellar": "Cellar",
  "/ask-solera": "Ask Solera",
  "/sales": "Sales",
  "/data-import": "Data Import",
  "/settings": "Settings",
};

const ComingSoon = () => {
  const { pathname } = useLocation();
  const name = routeNames[pathname] || "This Module";

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Construction className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-display font-bold text-foreground">{name}</h1>
      <p className="text-muted-foreground mt-2 max-w-sm">
        This module is under development and will be available in a future update.
      </p>
    </div>
  );
};

export default ComingSoon;
