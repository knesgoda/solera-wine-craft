
-- Changelogs table for public changelog page
CREATE TABLE public.changelogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  released_at date NOT NULL DEFAULT CURRENT_DATE,
  entries_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.changelogs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read changelogs"
  ON public.changelogs FOR SELECT
  TO anon, authenticated
  USING (true);

-- Roadmap items table
CREATE TABLE public.roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planned',
  phase text,
  votes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read roadmap items"
  ON public.roadmap_items FOR SELECT
  TO anon, authenticated
  USING (true);

-- Roadmap votes table
CREATE TABLE public.roadmap_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.roadmap_items(id) ON DELETE CASCADE NOT NULL,
  voter_ip text NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, voter_ip)
);

ALTER TABLE public.roadmap_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read votes"
  ON public.roadmap_votes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert votes"
  ON public.roadmap_votes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Trigger to increment votes count
CREATE OR REPLACE FUNCTION public.increment_roadmap_votes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.roadmap_items SET votes = votes + 1 WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_roadmap_vote_insert
  AFTER INSERT ON public.roadmap_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_roadmap_votes();

-- Seed changelog data
INSERT INTO public.changelogs (version, released_at, entries_json) VALUES
('1.0', '2026-01-15', '[{"tag":"New","title":"Vineyard Operations","items":["Vineyard and block management","GDD tracking with Open-Meteo weather","Task management with calendar view","Offline-capable field data entry"]},{"tag":"New","title":"Vintage & Lab Tracking","items":["Vintage lifecycle management","Lab sample recording with charts","Anomaly detection via AI","TTB additions tracking"]}]'::jsonb),
('1.1', '2026-01-29', '[{"tag":"New","title":"Cellar & Fermentation","items":["Fermentation vessel management","Barrel inventory with cooperage tracking","Barrel groups and batch operations","Blending trial workbench with star ratings"]},{"tag":"New","title":"Ask Solera AI","items":["Natural language queries over winery data","Conversation history","Context-aware answers using lab, weather, and vintage data"]}]'::jsonb),
('1.2', '2026-02-12', '[{"tag":"New","title":"Data Import Hub","items":["CSV/XLSX upload with AI column mapping","Innovint and VinNow format support","Import progress tracking and error reporting"]},{"tag":"New","title":"Analog Vintage Explorer","items":["Historical vintage comparison by GDD","Regional analog matching","Rating correlation analysis"]}]'::jsonb),
('1.3', '2026-02-26', '[{"tag":"New","title":"DTC Sales & Storefront","items":["Public wine store with Stripe checkout","Inventory SKU management with facility tracking","Order management with fulfillment workflow","Customer database with lifetime value tracking"]},{"tag":"New","title":"Wine Club Management","items":["Club creation with shipment scheduling","Member management with Stripe subscriptions","Batch shipment processing"]}]'::jsonb),
('1.4', '2026-03-05', '[{"tag":"New","title":"Custom Crush Client Portal","items":["Client organization management","Invite-based client onboarding","Client vintage visibility and messaging","Document sharing per vintage"]},{"tag":"New","title":"TTB Compliance","items":["OW-1 report generation","Certificate of Analysis PDF export","ShipCompliant integration for DTC shipping compliance"]}]'::jsonb),
('1.5', '2026-03-12', '[{"tag":"New","title":"Enterprise Features","items":["SSO via SAML 2.0","Multi-facility management","API key management with scoped access","Webhook dispatch system","Audit logging"]},{"tag":"New","title":"Integrations Hub","items":["Commerce7 two-way sync","WineDirect order import","Shopify storefront sync","QuickBooks invoice and expense sync","Google Sheets live sync"]},{"tag":"Improved","title":"Platform Polish","items":["Role-based access control (owner/manager/cellar/field)","Tier enforcement across all modules","Billing management with Stripe portal","SMS alerts via Twilio (Enterprise)"]}]'::jsonb);

-- Seed roadmap data
INSERT INTO public.roadmap_items (title, description, status, phase) VALUES
('Native iOS & Android App', 'Full-featured native mobile app for vineyard walks and cellar checks.', 'in_progress', 'Phase 7'),
('QuickBooks Two-Way Sync', 'Bidirectional sync including payments and refunds from QuickBooks.', 'in_progress', 'Phase 7'),
('Vineyard Drone Integration', 'Import NDVI and aerial imagery from DJI and senseFly drones.', 'coming_soon', 'Phase 8'),
('Multi-Language Support', 'Spanish language support for vineyard field crews.', 'coming_soon', 'Phase 8'),
('Wine Futures & Pre-Release Sales', 'Sell barrel selections and futures before bottling.', 'planned', 'Phase 9'),
('ETS Labs API Integration', 'Auto-import lab results directly from ETS Labs.', 'planned', 'Phase 9'),
('Bulk Wine Marketplace', 'List and discover bulk wine available for purchase between wineries.', 'planned', 'Phase 10');
