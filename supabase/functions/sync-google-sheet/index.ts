import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

async function fetchSheetData(sheetId: string, tabName: string, accessToken: string) {
  const url = `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(tabName)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.values || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action } = body;

    if (action === "fetch_headers") {
      // Fetch headers and sample rows for mapping preview
      const { sheet_id, tab_name } = body;

      // Get the user's Google access token from auth
      const authHeader = req.headers.get("Authorization");
      let accessToken = "";

      if (authHeader) {
        const jwt = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(jwt);
        if (user) {
          // Try to get provider token from identities
          const googleIdentity = user.identities?.find((i: any) => i.provider === "google");
          if (googleIdentity?.identity_data?.provider_token) {
            accessToken = googleIdentity.identity_data.provider_token;
          }
        }
      }

      if (!accessToken) {
        // Try using a service account or stored token
        return new Response(JSON.stringify({
          error: "Google authentication required. Please sign in with Google first.",
          headers: [],
          sampleRows: [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rows = await fetchSheetData(sheet_id, tab_name, accessToken);
      const headers = rows[0] || [];
      const sampleRows = rows.slice(1, 6);

      return new Response(JSON.stringify({ headers, sampleRows }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sync") {
      const { connection_id } = body;

      // Get connection details
      const { data: conn, error: connErr } = await supabase
        .from("google_sheet_connections")
        .select("*")
        .eq("id", connection_id)
        .single();

      if (connErr || !conn) throw new Error("Connection not found");

      // Create sync log entry
      const { data: logEntry } = await supabase
        .from("sync_logs")
        .insert({ connection_id, status: "running" as any })
        .select("id")
        .single();

      try {
        // For now, use the stored access token or try provider token
        let accessToken = conn.google_access_token;

        if (!accessToken) {
          // Try from auth header
          const authHeader = req.headers.get("Authorization");
          if (authHeader) {
            const jwt = authHeader.replace("Bearer ", "");
            const { data: { user } } = await supabase.auth.getUser(jwt);
            if (user) {
              const googleIdentity = user.identities?.find((i: any) => i.provider === "google");
              if (googleIdentity?.identity_data?.provider_token) {
                accessToken = googleIdentity.identity_data.provider_token;
              }
            }
          }
        }

        if (!accessToken) {
          throw new Error("No Google access token available. Please reconnect Google.");
        }

        const rows = await fetchSheetData(conn.google_sheet_id, conn.tab_name, accessToken);
        if (rows.length < 2) {
          await supabase.from("sync_logs").update({
            status: "success" as any, rows_synced: 0,
          }).eq("id", logEntry!.id);

          return new Response(JSON.stringify({ rows_synced: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const headers = rows[0];
        const dataRows = rows.slice(1);

        // Get saved mappings for this org
        const { data: mappings } = await supabase
          .from("import_mappings")
          .select("*")
          .eq("org_id", conn.org_id);

        // Build header-to-field map
        const fieldMap: Record<string, { table: string; field: string }> = {};
        for (const m of (mappings || [])) {
          if (m.target_table && m.target_field) {
            fieldMap[m.source_column] = { table: m.target_table, field: m.target_field };
          }
        }

        let rowsSynced = 0;
        let conflicts = 0;
        let errors = 0;

        // Group rows by target table
        const tableRows: Record<string, any[]> = {};

        for (const row of dataRows) {
          const record: Record<string, Record<string, any>> = {};

          for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const mapping = fieldMap[header];
            if (!mapping) continue;

            if (!record[mapping.table]) record[mapping.table] = {};
            record[mapping.table][mapping.field] = row[i] || null;
          }

          for (const [table, data] of Object.entries(record)) {
            if (!tableRows[table]) tableRows[table] = [];
            tableRows[table].push({ ...data, org_id: conn.org_id });
          }
        }

        // Upsert to each target table
        for (const [table, rows] of Object.entries(tableRows)) {
          try {
            const { error: upsertErr } = await supabase.from(table).insert(rows);
            if (upsertErr) {
              console.error(`Upsert error for ${table}:`, upsertErr);
              errors += rows.length;
            } else {
              rowsSynced += rows.length;
            }
          } catch (e) {
            console.error(`Table ${table} error:`, e);
            errors += rows.length;
          }
        }

        // Update sync log
        const status = errors > 0 ? (rowsSynced > 0 ? "partial" : "failed") : "success";
        await supabase.from("sync_logs").update({
          status: status as any,
          rows_synced: rowsSynced,
          conflicts,
          errors,
        }).eq("id", logEntry!.id);

        // Update last_synced_at
        await supabase.from("google_sheet_connections").update({
          last_synced_at: new Date().toISOString(),
        }).eq("id", connection_id);

        return new Response(JSON.stringify({ rows_synced: rowsSynced, conflicts, errors, status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        // Update log as failed
        if (logEntry?.id) {
          await supabase.from("sync_logs").update({
            status: "failed" as any,
            error_details: (err as Error).message,
          }).eq("id", logEntry.id);
        }
        throw err;
      }
    }

    if (action === "scheduled_sync") {
      // Called by cron - process all active scheduled connections
      const now = new Date();
      const hour = now.getUTCHours();

      let query = supabase
        .from("google_sheet_connections")
        .select("id")
        .eq("active", true);

      // Hourly connections always run; daily connections run at midnight UTC
      if (hour === 0) {
        query = query.in("sync_schedule", ["hourly", "daily"]);
      } else {
        query = query.eq("sync_schedule", "hourly");
      }

      const { data: conns } = await query;
      const results = [];

      for (const conn of (conns || [])) {
        try {
          // Re-invoke this function for each connection
          const syncUrl = `${supabaseUrl}/functions/v1/sync-google-sheet`;
          const res = await fetch(syncUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ action: "sync", connection_id: conn.id }),
          });
          const data = await res.json();
          results.push({ connection_id: conn.id, ...data });
        } catch (e) {
          results.push({ connection_id: conn.id, error: (e as Error).message });
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
