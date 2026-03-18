import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";

interface Sample {
  sampled_at: string;
  brix: number | null;
  ph: number | null;
}

interface Props {
  samples: Sample[];
}

export function LabChart({ samples }: Props) {
  const data = samples.map((s) => ({
    date: format(parseISO(s.sampled_at), "MMM d"),
    brix: s.brix,
    ph: s.ph,
  }));

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
          <YAxis yAxisId="brix" orientation="left" tick={{ fontSize: 12 }} label={{ value: "Brix°", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
          <YAxis yAxisId="ph" orientation="right" tick={{ fontSize: 12 }} domain={[2.5, 4.5]} label={{ value: "pH", angle: 90, position: "insideRight", style: { fontSize: 11 } }} />
          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
          <Legend />
          <Line yAxisId="brix" type="monotone" dataKey="brix" name="Brix°" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ r: 3 }} />
          <Line yAxisId="ph" type="monotone" dataKey="ph" name="pH" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
