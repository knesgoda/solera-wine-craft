import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://solera.vin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface QBConfig {
  id: string;
  org_id: string;
  realm_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expiry: string;
  sync_invoices: boolean;
  sync_expenses: boolean;
  sync_inventory_value: boolean;
}

async function refreshTokenIfNeeded(
  supabase: any,
  config: QBConfig,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const expiry = new Date(config.token_expiry);
  const now = new Date();

  // Refresh if token expires within 5 minutes
  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return config.access_token_encrypted; // Still valid
  }

  const refreshToken = config.refresh_token_encrypted;
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const resp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  if (!resp.ok) {
    // Refresh token may be expired (180 days)
    await supabase
      .from("quickbooks_config")
      .update({ active: false })
      .eq("id", config.id);

    // Log the failure
    await supabase.from("integration_sync_logs").insert({
      org_id: config.org_id,
      integration: "quickbooks",
      sync_type: "token_refresh",
      status: "error",
      errors: 1,
      error_details: "Refresh token expired. Please reconnect QuickBooks.",
    });

    throw new Error("QuickBooks refresh token expired. Reconnection required.");
  }

  const tokens = await resp.json();
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from("quickbooks_config")
    .update({
      access_token_encrypted: tokens.access_token,
      refresh_token_encrypted: tokens.refresh_token,
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("id", config.id);

  return tokens.access_token;
}

async function syncInvoices(supabase: any, config: QBConfig, accessToken: string) {
  let synced = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  // Get shipped orders without a quickbooks_invoice_id
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("*")
    .eq("org_id", config.org_id)
    .eq("status", "shipped")
    .is("quickbooks_invoice_id", null)
    .limit(50);

  if (ordersErr || !orders?.length) {
    return { synced: 0, errors: 0, errorDetails: [] };
  }

  const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${config.realm_id}`;

  for (const order of orders) {
    try {
      const invoice = {
        CustomerRef: { value: order.customer_email },
        Line: [
          {
            Amount: order.subtotal,
            DetailType: "SalesItemLineDetail",
            SalesItemLineDetail: {
              Qty: order.quantity_cases || order.quantity_bottles || 1,
              UnitPrice: order.unit_price,
            },
            Description: `Order ${order.id.slice(0, 8)}`,
          },
        ],
        BillEmail: { Address: order.customer_email },
      };

      const resp = await fetch(`${baseUrl}/invoice?minorversion=65`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        body: JSON.stringify(invoice),
      });

      if (resp.ok) {
        const result = await resp.json();
        await supabase
          .from("orders")
          .update({ quickbooks_invoice_id: result.Invoice.Id })
          .eq("id", order.id);
        synced++;
      } else {
        const errText = await resp.text();
        errors++;
        errorDetails.push(`Order ${order.id.slice(0, 8)}: ${errText.slice(0, 100)}`);
      }
    } catch (e: any) {
      errors++;
      errorDetails.push(`Order ${order.id.slice(0, 8)}: ${e.message}`);
    }
  }

  return { synced, errors, errorDetails };
}

async function syncExpenses(supabase: any, config: QBConfig, accessToken: string) {
  let synced = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  const { data: additions, error: addErr } = await supabase
    .from("ttb_additions")
    .select("*")
    .eq("org_id", config.org_id)
    .is("quickbooks_expense_id", null)
    .limit(50);

  if (addErr || !additions?.length) {
    return { synced: 0, errors: 0, errorDetails: [] };
  }

  const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${config.realm_id}`;

  for (const addition of additions) {
    try {
      const amount = (addition.cost_per_unit || 0) * (addition.amount || 0);
      if (amount <= 0) continue;

      const purchase = {
        PaymentType: "Cash",
        TotalAmt: amount,
        Line: [
          {
            Amount: amount,
            DetailType: "AccountBasedExpenseLineDetail",
            AccountBasedExpenseLineDetail: {
              AccountRef: { value: "1" }, // Default expense account
            },
            Description: `${addition.addition_type} - ${addition.amount} ${addition.unit}`,
          },
        ],
      };

      const resp = await fetch(`${baseUrl}/purchase?minorversion=65`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        body: JSON.stringify(purchase),
      });

      if (resp.ok) {
        const result = await resp.json();
        await supabase
          .from("ttb_additions")
          .update({ quickbooks_expense_id: result.Purchase.Id })
          .eq("id", addition.id);
        synced++;
      } else {
        const errText = await resp.text();
        errors++;
        errorDetails.push(`Addition ${addition.id.slice(0, 8)}: ${errText.slice(0, 100)}`);
      }
    } catch (e: any) {
      errors++;
      errorDetails.push(`Addition ${addition.id.slice(0, 8)}: ${e.message}`);
    }
  }

  return { synced, errors, errorDetails };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { org_id } = await req.json();

    const { data: config, error: cfgErr } = await supabase
      .from("quickbooks_config")
      .select("*")
      .eq("org_id", org_id)
      .eq("active", true)
      .maybeSingle();

    if (cfgErr || !config) {
      return new Response(JSON.stringify({ error: "QuickBooks not configured or inactive" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID") || "";
    const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET") || "";

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabase, config, clientId, clientSecret);

    let totalSynced = 0;
    let totalErrors = 0;
    const allErrorDetails: string[] = [];

    // Sync invoices
    if (config.sync_invoices) {
      const inv = await syncInvoices(supabase, config, accessToken);
      totalSynced += inv.synced;
      totalErrors += inv.errors;
      allErrorDetails.push(...inv.errorDetails);
    }

    // Sync expenses
    if (config.sync_expenses) {
      const exp = await syncExpenses(supabase, config, accessToken);
      totalSynced += exp.synced;
      totalErrors += exp.errors;
      allErrorDetails.push(...exp.errorDetails);
    }

    // Update last_synced_at
    await supabase
      .from("quickbooks_config")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", config.id);

    // Write sync log
    await supabase.from("integration_sync_logs").insert({
      org_id,
      integration: "quickbooks",
      sync_type: "full",
      status: totalErrors > 0 ? "partial" : "success",
      records_synced: totalSynced,
      errors: totalErrors,
      error_details: allErrorDetails.length ? allErrorDetails.join("; ") : null,
    });

    return new Response(
      JSON.stringify({ synced: totalSynced, errors: totalErrors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
