CREATE TABLE public.subscription_plan_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  razorpay_plan_id TEXT NOT NULL UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  razorpay_subscription_id TEXT NOT NULL UNIQUE,
  razorpay_plan_id TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  status TEXT NOT NULL CHECK (
    status IN (
      'created',
      'authenticated',
      'active',
      'pending',
      'halted',
      'paused',
      'cancelled',
      'completed',
      'expired'
    )
  ),
  current_start TIMESTAMPTZ,
  current_end TIMESTAMPTZ,
  charge_at TIMESTAMPTZ,
  cancel_at_cycle_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX customer_subscriptions_customer_status_idx
  ON public.customer_subscriptions (customer_id, status);

CREATE UNIQUE INDEX customer_subscriptions_one_current_per_customer_uidx
  ON public.customer_subscriptions (customer_id)
  WHERE status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'paused');

ALTER TABLE public.subscription_plan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own subscriptions"
  ON public.customer_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = customer_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

GRANT SELECT ON public.customer_subscriptions TO authenticated;
GRANT ALL ON public.subscription_plan_settings TO service_role;
GRANT ALL ON public.customer_subscriptions TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_plan_settings FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.customer_subscriptions FROM PUBLIC, anon, authenticated;
