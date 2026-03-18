import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Key, Webhook, FileJson } from "lucide-react";

const API_SPEC = {
  openapi: "3.0.3",
  info: { title: "Solera API", version: "1.0.0", description: "Wine operations management API for programmatic access to Solera data." },
  servers: [{ url: "/functions/v1/api-v1", description: "Production" }],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: { BearerAuth: { type: "http", scheme: "bearer", description: "API key from Settings → API Keys" } },
    schemas: {
      Envelope: { type: "object", properties: { data: { type: "object" }, meta: { type: "object", properties: { org_id: { type: "string" }, timestamp: { type: "string" }, version: { type: "string" } } } } },
    },
  },
  paths: {
    "/vintages": {
      get: { summary: "List vintages", tags: ["Vintages"], parameters: [], responses: { "200": { description: "Vintages list" } } },
      post: { summary: "Create vintage", tags: ["Vintages"], requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, variety: { type: "string" }, vintage_year: { type: "integer" } } } } } }, responses: { "201": { description: "Created" } } },
    },
    "/vintages/{id}": { get: { summary: "Get vintage by ID", tags: ["Vintages"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Vintage detail" } } } },
    "/lab_samples": {
      get: { summary: "List lab samples", tags: ["Lab Samples"], parameters: [{ name: "vintage_id", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Lab samples list" } } },
      post: { summary: "Create lab sample", tags: ["Lab Samples"], requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { "201": { description: "Created" } } },
    },
    "/inventory": { get: { summary: "List inventory SKUs", tags: ["Inventory"], responses: { "200": { description: "Inventory list" } } } },
    "/orders": { get: { summary: "List orders", tags: ["Orders"], responses: { "200": { description: "Orders list" } } } },
    "/tasks": { post: { summary: "Create task", tags: ["Tasks"], requestBody: { content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } } } } } }, responses: { "201": { description: "Created" } } } },
    "/analytics/harvest-windows": { get: { summary: "Get harvest window analytics", tags: ["Analytics"], responses: { "200": { description: "Harvest window data" } } } },
  },
};

const endpoints = [
  { method: "GET", path: "/vintages", scope: "read:vintages", desc: "List all vintages" },
  { method: "GET", path: "/vintages/{id}", scope: "read:vintages", desc: "Get vintage by ID" },
  { method: "POST", path: "/vintages", scope: "write:vintages", desc: "Create a vintage" },
  { method: "GET", path: "/lab_samples", scope: "read:lab_samples", desc: "List lab samples (filter by vintage_id)" },
  { method: "POST", path: "/lab_samples", scope: "write:lab_samples", desc: "Create a lab sample" },
  { method: "GET", path: "/inventory", scope: "read:inventory", desc: "List inventory SKUs" },
  { method: "GET", path: "/orders", scope: "read:orders", desc: "List orders" },
  { method: "POST", path: "/tasks", scope: "write:tasks", desc: "Create a task" },
  { method: "GET", path: "/analytics/harvest-windows", scope: "read:analytics", desc: "Harvest window analytics" },
];

const webhookEvents = [
  { event: "vintage.created", desc: "When a new vintage is created" },
  { event: "vintage.updated", desc: "When a vintage is updated" },
  { event: "lab_sample.created", desc: "When a new lab sample is recorded" },
  { event: "harvest_window.entered", desc: "When a block enters harvest window" },
  { event: "task.completed", desc: "When a task is marked complete" },
  { event: "order.created", desc: "When a new order is placed" },
  { event: "order.shipped", desc: "When an order is shipped" },
  { event: "anomaly.detected", desc: "When an anomaly is flagged" },
  { event: "weekly_summary.generated", desc: "When a weekly summary is generated" },
];

export default function Developers() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto py-12 px-6 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-foreground">Solera Developer Docs</h1>
          <p className="text-lg text-muted-foreground">Programmatic access to your wine operations data.</p>
        </div>

        <Tabs defaultValue="endpoints">
          <TabsList>
            <TabsTrigger value="endpoints"><Code className="h-4 w-4 mr-1.5" />Endpoints</TabsTrigger>
            <TabsTrigger value="auth"><Key className="h-4 w-4 mr-1.5" />Authentication</TabsTrigger>
            <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1.5" />Webhooks</TabsTrigger>
            <TabsTrigger value="spec"><FileJson className="h-4 w-4 mr-1.5" />OpenAPI Spec</TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>API Endpoints</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Base URL: <code className="bg-muted px-1.5 py-0.5 rounded">{`{SUPABASE_URL}/functions/v1/api-v1`}</code></p>
                <div className="space-y-3">
                  {endpoints.map((ep) => (
                    <div key={ep.method + ep.path} className="flex items-center gap-3 p-3 border rounded-md">
                      <Badge variant={ep.method === "GET" ? "secondary" : "default"} className="font-mono text-xs w-14 justify-center">{ep.method}</Badge>
                      <code className="text-sm font-mono flex-1">{ep.path}</code>
                      <Badge variant="outline" className="text-xs">{ep.scope}</Badge>
                      <span className="text-sm text-muted-foreground hidden md:block">{ep.desc}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-muted/50 rounded-md">
                  <p className="text-sm font-medium mb-2">Response Envelope</p>
                  <pre className="text-xs font-mono text-muted-foreground">{`{
  "data": [ ... ],
  "meta": {
    "org_id": "uuid",
    "timestamp": "2026-03-18T...",
    "version": "1.0"
  }
}`}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auth">
            <Card>
              <CardHeader><CardTitle>Authentication</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">All API requests require a Bearer token in the Authorization header.</p>
                <pre className="bg-muted p-4 rounded-md text-sm font-mono">{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  {SUPABASE_URL}/functions/v1/api-v1/vintages`}</pre>
                <div className="space-y-2">
                  <h3 className="font-medium">Getting an API Key</h3>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                    <li>Navigate to <strong>Settings → API Keys & Webhooks</strong></li>
                    <li>Click <strong>New API Key</strong></li>
                    <li>Select a label and the scopes you need</li>
                    <li>Copy the key — it's only shown once</li>
                  </ol>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">Rate Limits</h3>
                  <p className="text-sm text-muted-foreground">Default: <strong>1,000 requests/hour</strong> per key. Contact support for higher limits.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks">
            <Card>
              <CardHeader><CardTitle>Webhook Events</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Webhooks deliver real-time event notifications via HTTP POST to your endpoint.</p>
                <div className="space-y-2">
                  {webhookEvents.map((we) => (
                    <div key={we.event} className="flex items-center gap-3 p-3 border rounded-md">
                      <Badge variant="outline" className="font-mono text-xs">{we.event}</Badge>
                      <span className="text-sm text-muted-foreground">{we.desc}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  <h3 className="font-medium">Signature Verification</h3>
                  <p className="text-sm text-muted-foreground">Each webhook includes an <code className="bg-muted px-1 rounded">X-Solera-Signature</code> header (HMAC-SHA256). Verify it with your webhook secret to ensure authenticity.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="spec">
            <Card>
              <CardHeader><CardTitle>OpenAPI 3.0 Specification</CardTitle></CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-md text-xs font-mono max-h-[600px] overflow-auto">{JSON.stringify(API_SPEC, null, 2)}</pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
