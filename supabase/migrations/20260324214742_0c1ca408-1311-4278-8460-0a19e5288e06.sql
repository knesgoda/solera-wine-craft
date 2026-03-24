
UPDATE changelogs
SET entries_json = REPLACE(entries_json::text, 'Stripe', 'Paddle')::jsonb
WHERE entries_json::text LIKE '%Stripe%';
