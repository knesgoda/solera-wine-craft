import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const email = "kevin.nesgoda@gmail.com";
    const password = "DawkinsMan#2020";

    // Check if user already exists
    const { data: existing } = await supabase.auth.admin.listUsers();
    const alreadyExists = existing?.users?.some((u: any) => u.email === email);
    if (alreadyExists) {
      return new Response(
        JSON.stringify({ message: "User already exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: "Kevin", last_name: "Nesgoda" },
    });
    if (authError) throw authError;

    const userId = authData.user.id;

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: "Solera", tier: "enterprise", onboarding_completed: true })
      .select()
      .single();
    if (orgError) throw orgError;

    // Link profile to org
    await supabase
      .from("profiles")
      .update({ org_id: org.id, first_name: "Kevin", last_name: "Nesgoda" })
      .eq("id", userId);

    // Assign owner role
    await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "owner" });

    return new Response(
      JSON.stringify({ success: true, userId, orgId: org.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
