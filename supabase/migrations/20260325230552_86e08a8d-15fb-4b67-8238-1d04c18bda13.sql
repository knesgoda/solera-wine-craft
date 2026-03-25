-- Document legacy Stripe columns as deprecated (kept for historical data, replaced by Paddle equivalents)
COMMENT ON COLUMN public.organizations.stripe_customer_id IS 'DEPRECATED — legacy Stripe column. Use paddle_customer_id instead.';
COMMENT ON COLUMN public.organizations.stripe_subscription_id IS 'DEPRECATED — legacy Stripe column. Use paddle_subscription_id instead.';
COMMENT ON COLUMN public.orders.stripe_payment_intent_id IS 'DEPRECATED — legacy Stripe column, retained for historical order records.';