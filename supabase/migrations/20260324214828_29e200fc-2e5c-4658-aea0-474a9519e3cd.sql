
INSERT INTO changelogs (version, released_at, entries_json)
VALUES (
  '2.0',
  '2026-03-24',
  '[
    {
      "tag": "New",
      "title": "Production Cost Tracking (COGS)",
      "items": [
        "Real-time COGS per gallon, per barrel, and per case for every lot",
        "Three costing methods: apportioned, transactional, and ad hoc",
        "Costs flow automatically through blending operations",
        "Configurable material price list with unit costs",
        "Cost category management with breakdown dashboard",
        "Year-over-year cost comparison and trend analysis",
        "One-click QuickBooks export with configurable account mapping",
        "Lot cost detail with timeline, pie chart, and projections"
      ]
    },
    {
      "tag": "New",
      "title": "Grower Contract Management",
      "items": [
        "Grower registry with contact management",
        "Per-ton and per-acre contract pricing",
        "Multi-metric grading scales: Brix, MOG, TA, pH, berry size, and custom metrics",
        "Tier-based bonus and penalty pricing with reject handling",
        "Harvest intake with weigh tag recording and live grade calculation",
        "Automatic grape cost feed into COGS tracking",
        "Contract financial summaries with PDF and CSV export",
        "Reusable grading scale templates"
      ]
    },
    {
      "tag": "Improved",
      "title": "Platform Updates",
      "items": [
        "Growth tier now includes production cost tracking and QuickBooks export",
        "Enterprise tier now includes grower contract management and harvest intake",
        "Updated features page, pricing page, and comparison pages with new capabilities",
        "Added FAQ entries for production cost tracking and grower contracts"
      ]
    }
  ]'::jsonb
);
