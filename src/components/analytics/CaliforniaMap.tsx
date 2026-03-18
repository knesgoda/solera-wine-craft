import { cn } from "@/lib/utils";

interface CaliforniaMapProps {
  highlightedRegion?: string;
}

// Simplified SVG paths for California wine regions
const REGIONS: Array<{ name: string; path: string; labelX: number; labelY: number }> = [
  {
    name: "Napa Valley",
    path: "M 145 115 L 155 105 L 165 108 L 170 120 L 168 135 L 158 140 L 148 132 Z",
    labelX: 157, labelY: 122,
  },
  {
    name: "Sonoma",
    path: "M 118 108 L 135 100 L 145 115 L 148 132 L 140 145 L 125 140 L 115 125 Z",
    labelX: 130, labelY: 122,
  },
  {
    name: "Central Coast",
    path: "M 105 220 L 120 210 L 135 215 L 140 235 L 145 260 L 135 275 L 120 270 L 108 250 L 100 235 Z",
    labelX: 122, labelY: 245,
  },
  {
    name: "Sierra Foothills",
    path: "M 185 130 L 210 115 L 225 125 L 230 150 L 220 170 L 200 175 L 185 160 L 180 145 Z",
    labelX: 205, labelY: 148,
  },
  {
    name: "Paso Robles",
    path: "M 110 195 L 130 188 L 140 198 L 135 215 L 120 210 L 105 205 Z",
    labelX: 122, labelY: 202,
  },
  {
    name: "Mendocino",
    path: "M 100 75 L 120 65 L 138 72 L 135 90 L 118 98 L 102 92 Z",
    labelX: 118, labelY: 82,
  },
  {
    name: "Lodi",
    path: "M 165 155 L 185 148 L 195 158 L 190 172 L 175 178 L 163 168 Z",
    labelX: 177, labelY: 164,
  },
  {
    name: "Temecula",
    path: "M 170 340 L 190 335 L 200 345 L 195 358 L 180 362 L 168 352 Z",
    labelX: 183, labelY: 349,
  },
];

export function CaliforniaMap({ highlightedRegion }: CaliforniaMapProps) {
  const normalizeRegion = (r: string) => r.toLowerCase().replace(/[^a-z]/g, "");

  return (
    <svg viewBox="60 50 200 330" className="w-full h-full max-h-[400px]" aria-label="California wine regions map">
      {/* California outline */}
      <path
        d="M 90 60 L 130 55 L 160 58 L 200 65 L 240 80 L 250 120 L 245 160 L 240 200 L 235 240 L 225 280 L 210 310 L 195 340 L 185 360 L 165 370 L 145 365 L 130 350 L 115 330 L 105 300 L 95 270 L 88 240 L 85 210 L 82 180 L 80 150 L 78 120 L 82 90 Z"
        fill="hsl(30, 20%, 90%)"
        stroke="hsl(30, 15%, 75%)"
        strokeWidth="1.5"
      />

      {/* Wine regions */}
      {REGIONS.map((region) => {
        const isHighlighted = highlightedRegion && normalizeRegion(region.name) === normalizeRegion(highlightedRegion);
        return (
          <g key={region.name}>
            <path
              d={region.path}
              fill={isHighlighted ? "hsl(36, 64%, 47%)" : "hsl(348, 58%, 26%)"}
              fillOpacity={isHighlighted ? 0.9 : 0.25}
              stroke={isHighlighted ? "hsl(36, 64%, 40%)" : "hsl(348, 58%, 26%)"}
              strokeWidth={isHighlighted ? 2 : 0.8}
              className="transition-all duration-300"
            />
            <text
              x={region.labelX}
              y={region.labelY}
              textAnchor="middle"
              className={cn(
                "text-[6px] font-medium pointer-events-none select-none",
                isHighlighted ? "fill-white" : "fill-foreground/60"
              )}
            >
              {region.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
