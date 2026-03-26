import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateSvg(title: string, description: string): string {
  const escapedTitle = escapeXml(title);
  const escapedDesc = escapeXml(description).slice(0, 120);

  // Wrap title text for long titles
  const maxCharsPerLine = 32;
  const words = escapedTitle.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxCharsPerLine && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + " " + word : word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  const titleY = lines.length > 2 ? 220 : lines.length > 1 ? 250 : 280;
  const titleElements = lines
    .map((line, i) => `<text x="80" y="${titleY + i * 56}" fill="#FFFFFF" font-family="Georgia, serif" font-size="48" font-weight="bold">${line}</text>`)
    .join("\n    ");

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7A1B2E;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4A0E1C;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <!-- Gold accent bar -->
  <rect x="0" y="0" width="1200" height="6" fill="#C9A96E" />
  <rect x="0" y="624" width="1200" height="6" fill="#C9A96E" />
  <!-- Logo circle -->
  <circle cx="120" cy="100" r="36" fill="#C9A96E" opacity="0.9" />
  <text x="108" y="112" fill="#4A0E1C" font-family="Georgia, serif" font-size="28" font-weight="bold">S</text>
  <!-- Brand name -->
  <text x="172" y="112" fill="#FFFFFF" font-family="Georgia, serif" font-size="32" font-weight="bold" opacity="0.9">Solera</text>
  <!-- Title -->
  ${titleElements}
  <!-- Description -->
  <text x="80" y="${titleY + lines.length * 56 + 30}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="22" opacity="0.7">${escapedDesc}</text>
  <!-- Bottom tagline -->
  <text x="80" y="570" fill="#C9A96E" font-family="Arial, sans-serif" font-size="18">solera.vin — From Vine to Bottle to Doorstep</text>
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const title = url.searchParams.get("title") || "Solera";
    const description = url.searchParams.get("description") || "Complete winery management platform";

    const svg = generateSvg(title, description);

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
