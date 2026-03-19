import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Props {
  api: (action: string, payload?: any) => Promise<any>;
}

export function ProductAnalyticsTab({ api }: Props) {
  const { data: paData, isLoading: paLoading } = useQuery({
    queryKey: ["admin-product-analytics"],
    queryFn: () => api("product-analytics"),
  });

  const { data: iaData, isLoading: iaLoading } = useQuery({
    queryKey: ["admin-import-analytics"],
    queryFn: () => api("import-analytics"),
  });

  const modules = paData?.modules || [];
  const featureUsage = paData?.featureUsage || [];
  const sourceStats = iaData?.sourceStats || [];
  const topErrors = iaData?.topErrors || [];

  return (
    <div className="space-y-8">
      {/* Module Adoption */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Module Adoption (Paid Orgs)
        </h2>
        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            {paLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={modules} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="adoption" fill="#6B1B2A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Import Analytics */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Import Analytics
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-white shadow-sm">
            <CardHeader><CardTitle className="text-sm">By Source Type</CardTitle></CardHeader>
            <CardContent className="p-0">
              {iaLoading ? <Skeleton className="h-32 w-full m-4" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Avg Rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceStats.map((s: any) => (
                      <TableRow key={s.source}>
                        <TableCell className="font-medium capitalize">{s.source}</TableCell>
                        <TableCell>{s.total}</TableCell>
                        <TableCell>
                          <Badge variant={s.successRate >= 80 ? "default" : "destructive"}>
                            {s.successRate}%
                          </Badge>
                        </TableCell>
                        <TableCell>{s.avgRows}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm">
            <CardHeader><CardTitle className="text-sm">Top Import Errors</CardTitle></CardHeader>
            <CardContent className="p-0">
              {iaLoading ? <Skeleton className="h-32 w-full m-4" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Error</TableHead>
                      <TableHead>Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topErrors.map((e: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs max-w-xs truncate">{e.message}</TableCell>
                        <TableCell><Badge variant="destructive">{e.count}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {topErrors.length === 0 && (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">No errors</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Feature Usage Over Time */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "#6B1B2A" }}>
          Feature Usage Over Time (8 Weeks)
        </h2>
        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            {paLoading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={featureUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="weekOf" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="labSamples" name="Lab Samples" stroke="#6B1B2A" strokeWidth={2} />
                  <Line type="monotone" dataKey="tasks" name="Tasks" stroke="#C8902A" strokeWidth={2} />
                  <Line type="monotone" dataKey="imports" name="Imports" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="vintages" name="Vintages" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="aiQueries" name="AI Queries" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
