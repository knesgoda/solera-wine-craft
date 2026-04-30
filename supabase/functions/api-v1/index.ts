import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function envelope(data: unknown, orgId: string) {
  return { data, meta: { org_id: orgId, timestamp: new Date().toISOString(), version: "1.0" } };
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Auth: Bearer token
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");
  const keyHash = await hashKey(token);

  // Lookup key
  const { data: apiKey, error: keyError } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .single();

  if (keyError || !apiKey) {
    return jsonResponse({ error: "Invalid or revoked API key" }, 401);
  }

  // Update last_used_at
  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);

  const orgId = apiKey.org_id;
  const scopes: string[] = apiKey.scopes || [];

  // Parse route
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Expected: functions/v1/api-v1/vintages or functions/v1/api-v1/vintages/[id]
  // Find "api-v1" index and take everything after
  const apiIdx = pathParts.indexOf("api-v1");
  const routeParts = apiIdx >= 0 ? pathParts.slice(apiIdx + 1) : [];
  const resource = routeParts[0] || "";
  const resourceId = routeParts[1] || null;
  const method = req.method;

  try {
    // GET /vintages
    if (resource === "vintages" && method === "GET" && !resourceId) {
      if (!scopes.includes("read:vintages")) return jsonResponse({ error: "Insufficient scope" }, 403);
      const { data } = await supabase.from("vintages").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(100);
      return jsonResponse(envelope(data, orgId));
    }

    // GET /vintages/:id
    if (resource === "vintages" && method === "GET" && resourceId) {
      if (!scopes.includes("read:vintages")) return jsonResponse({ error: "Insufficient scope" }, 403);
      const { data } = await supabase.from("vintages").select("*").eq("id", resourceId).eq("org_id", orgId).single();
      return jsonResponse(envelope(data, orgId));
    }

    // POST /vintages
    if (resource === "vintages" && method === "POST") {
      if (!scopes.includes("write:vintages")) return jsonResponse({ error: "Insufficient scope" }, 403);
      const body = await req.json();
      const { data, error } = await supabase.from("vintages").insert({ ...body, org_id: orgId }).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse(envelope(data, orgId), 201);
    }

    // GET /lab_samples
    if (resource === "lab_samples" && method === "GET") {
      if (!scopes.includes("read:lab_samples")) return jsonResponse({ error: "Insufficient scope" }, 403);
      const vintageId = url.searchParams.get("vintage_id");
      let query = supabase.from("lab_samples").select("*, vintages!inner(org_id)").eq("vintages.org_id", orgId).order("sampled_at", { ascending: false }).limit(100);
      if (vintageId) query = query.eq("vintage_id", vintageId);
      const { data } = await query;
      return jsonResponse(envelope(data, orgId));
    }

    // POST /lab_samples
    if (resource === "lab_samples" && method === "POST") {
      if (!scopes.includes("write:lab_samples")) return jsonResponse({ error: "Insufficient scope" }, 403);
      const body = await req.json();
      const { data, error } = await supabase.from("lab_samples").insert(body).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse(envelope(data, orgId), 201);
    }

    // GET /inventory
    if (resource === "inventory" && method === "GET") {
      if (!scopes.includes("read:inventory")) return jsonResponse({ error: "Insufficient scope" }, 403);
      const { data } = await supabase.from("inventory_skus").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(100);
      return jsonResponse(envelope(data, orgId));
    }

    // GET /orders
    if (resource === "orders" && method === "GET") {
      if (!scopes.includes("read:orders")) return jsonResponse({ error: "Insufficient scope" }, 403);
      const { data } = await supabase.from("orders").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(100);
      return jsonResponse(envelope(data, orgId));
    }

    // POST /tasks
    if (resource === "tasks" && method === "POST") {
      if (!scopes.includes("write:tasks")) return jsonResponse({ error: "Insufficient scope" }, 403);
      const body = await req.json();
      const { data, error } = await supabase.from("tasks").insert({ ...body, org_id: orgId }).select().single();
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse(envelope(data, orgId), 201);
    }

    // GET /analytics/harvest-windows
    if (resource === "analytics" && routeParts[1] === "harvest-windows" && method === "GET") {
      if (!scopes.includes("read:analytics")) return jsonResponse({ error: "Insufficient scope" }, 403);
      const { data } = await supabase.from("vintages").select("id, name, variety, harvest_date, tons").eq("org_id", orgId).not("harvest_date", "is", null).order("harvest_date", { ascending: false }).limit(100);
      return jsonResponse(envelope(data, orgId));
    }

    return jsonResponse({ error: "Not found", available_routes: ["vintages", "lab_samples", "inventory", "orders", "tasks", "analytics/harvest-windows"] }, 404);
  } catch (err) {
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
