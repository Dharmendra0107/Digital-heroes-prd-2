-- Store Razorpay identifiers separately; Stripe fields remain for historical orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS orders_razorpay_order_id_uidx
  ON public.orders (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;
