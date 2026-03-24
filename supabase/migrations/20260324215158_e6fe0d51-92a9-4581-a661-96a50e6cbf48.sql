
-- Remove placeholder roadmap items
DELETE FROM roadmap_votes WHERE item_id IN (SELECT id FROM roadmap_items);
DELETE FROM roadmap_items;

-- Insert real roadmap items
INSERT INTO roadmap_items (title, description, status, phase, votes) VALUES
('Barcode Scanning for Vessels & Barrels', 'Scan QR codes or barcodes on barrels and tanks with your phone to instantly view contents, lab data, and work order history. Submit work order completions by scan.', 'in_progress', 'Pro+', 0),
('Visual Winery & Vineyard Map', 'Interactive, data-aware floor plan of your winery and vineyard. See tanks, barrels, and blocks with live status overlays for contents, Brix, temperature, and task assignments. Drag-and-drop layout editor.', 'in_progress', 'Pro+', 0),
('Custom Crush Billing by Operation', 'Line-item service billing for custom crush clients. Configurable rate cards for barrel washing, pump-overs, forklift moves, additions, analysis, and storage. Operations auto-populate the client invoice as performed.', 'planned', 'Enterprise', 0),
('Lab Instrument Direct Integrations', 'Direct data ingestion from ETS Labs, OenoFoss/FOSS, Wine Scan, and ChemWell analyzers. Lab results auto-matched to the correct lot and vessel. Eliminates manual transcription.', 'planned', 'Enterprise add-on', 0),
('Amphora / Fermsoft Data Import', 'Dedicated importer for Amphora CSV and spreadsheet exports. Migrates vintage records, lab logs, vessel and barrel inventory, and vineyard block data. Zero-friction migration for Amphora users.', 'planned', 'Pro+', 0),
('AgCode Field Crew Import', 'Import spray logs, task history, and field crew data from AgCode for vineyard managers transitioning from ag-focused tools.', 'coming_soon', 'TBD', 0),
('Xero Accounting Integration', 'In addition to QuickBooks, support COGS and expense export to Xero for wineries using Xero as their accounting platform.', 'coming_soon', 'Growth+', 0);
