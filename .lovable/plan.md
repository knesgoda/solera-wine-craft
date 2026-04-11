

# Ask Solera Context-Awareness Test Suite — Plan

## Approach

Deploy a temporary edge function `ask-solera-test` that:
1. Seeds a test org with rich, distinctively named data
2. Creates a test user in that org
3. Sends all 8 questions to the `ask-solera` endpoint using the test user's auth token
4. Parses the SSE stream to extract the full response text
5. Validates each response against org-specific markers
6. Outputs results to `scripts/audit/ask-solera-report.txt`
7. Cleans up all test data

## Seed Data (Distinctive Names for Easy Grep)

| Entity | Details |
|---|---|
| Org | "Ridgecrest Cellars" |
| Vineyard | "Dundee Hills Estate" |
| Block 1 | "Eagle's Nest" — Pinot Noir, Clone 667, 101-14 |
| Block 2 | "Riverview" — Chardonnay, Clone 76, 3309C |
| Block 3 | "Sunset Ridge" — Pinot Noir, Clone 777, 101-14 |
| 2024 Vintage (Block 1) | status: in_cellar, 4.2 tons, lab: Brix=23.8, pH=3.42 |
| 2025 Vintage (Block 2) | status: in_progress, 3.1 tons, lab: Brix=21.4, pH=3.51 |
| 2025 Vintage (Block 3) | status: harvested, 5.0 tons, lab: Brix=22.1, pH=3.38 |
| Vessel | "Tank 7" — stainless, 2000L, linked to 2025 Block 2 vintage |
| SO2 Addition | 50 mL on 2025 Block 2, dated this month |
| Tasks | 2 overdue ("Rack Block 1 barrels", "Order yeast"), 1 pending |

## Validation Per Question

Each response is checked for at least one **org-specific marker** from the seeded data:

| # | Question | Expected markers (any match = PASS) |
|---|---|---|
| 1 | "When should I pick Block 3?" | `Sunset Ridge`, `22.1`, `Block 3` |
| 2 | "Brix trend for Pinot Noir" | `Eagle's Nest` or `Sunset Ridge`, `23.8` or `22.1`, `Pinot Noir` |
| 3 | "Furthest from target Brix" | Any block name + a Brix value |
| 4 | "Lab history for 2024 vintage" | `Eagle's Nest`, `23.8`, `3.42`, `2024` |
| 5 | "SO2 additions this month" | `SO₂` or `SO2`, `50`, `Riverview` or `Block 2` |
| 6 | "Compare 2024 and 2025" | `2024`, `2025`, any block name |
| 7 | "Tank closest to target pH" | `Tank 7`, `3.51` or pH value |
| 8 | "Tasks overdue" | `Rack Block 1` or `Order yeast` |

A response with none of these markers is flagged as **GENERIC** (context injection failure).

## Additional Checks Per Response
- **Latency**: Must complete within 8 seconds (measured from request to last SSE chunk)
- **Non-empty**: Response text must be > 50 characters
- **No errors**: HTTP status must be 200, no `{"error":...}` in body

## SSE Parsing

The endpoint streams Anthropic's SSE format. The test will accumulate `content_block_delta` events to reconstruct the full text:
```
event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
```

## Files

| File | Action |
|---|---|
| `supabase/functions/ask-solera-test/index.ts` | Create (temporary test runner) |
| `scripts/audit/ask-solera-report.txt` | Generated output |

## Execution Flow
1. Deploy `ask-solera-test`
2. Call it via `curl_edge_functions`
3. Save output to report file
4. Delete the temp function

## Exit Criteria
- All 8 responses must be non-empty and error-free
- At least 6 of 8 must contain org-specific markers (PASS)
- Any response flagged GENERIC is a warning; 3+ GENERIC = overall FAIL
- Any API error = immediate FAIL

