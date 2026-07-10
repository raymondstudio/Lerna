-- Migration: Subscription, Billing, Invoices, Coupons, and Usage Cache (Phase 2 Foundation)

-- 1. Extend public.subscriptions with additional columns if missing
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start timestamptz DEFAULT now();
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end timestamptz DEFAULT (now() + interval '1 year');
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS grace_period_until timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS subscription_status text CHECK (subscription_status IN ('trial', 'active', 'grace', 'expired', 'cancelled', 'suspended')) DEFAULT 'active';

-- 2. Create subscription_history table
CREATE TABLE IF NOT EXISTS public.subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_plan text,
  new_plan text,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and define security policies for subscription_history
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history_select_own" ON public.subscription_history;
CREATE POLICY "history_select_own" ON public.subscription_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "history_admin_all" ON public.subscription_history;
CREATE POLICY "history_admin_all" ON public.subscription_history
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.subscription_history TO authenticated;
GRANT ALL ON public.subscription_history TO service_role;

-- 3. Create billing_transactions table
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  reference text UNIQUE NOT NULL,
  amount numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'successful', 'failed', 'refunded', 'cancelled')),
  payment_method text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and define security policies for billing_transactions
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_select_own" ON public.billing_transactions;
CREATE POLICY "transactions_select_own" ON public.billing_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_admin_all" ON public.billing_transactions;
CREATE POLICY "transactions_admin_all" ON public.billing_transactions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.billing_transactions TO authenticated;
GRANT ALL ON public.billing_transactions TO service_role;

-- 4. Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.billing_transactions(id) ON DELETE SET NULL,
  invoice_number text UNIQUE NOT NULL,
  amount numeric(10, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'paid', 'refunded', 'void', 'cancelled')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and define security policies for invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select_own" ON public.invoices;
CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "invoices_admin_all" ON public.invoices;
CREATE POLICY "invoices_admin_all" ON public.invoices
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

-- 5. Create coupon_codes table
CREATE TABLE IF NOT EXISTS public.coupon_codes (
  code text PRIMARY KEY,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(10, 2) NOT NULL,
  max_redemptions integer,
  redemption_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and define security policies for coupon_codes
ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons_select_all" ON public.coupon_codes;
CREATE POLICY "coupons_select_all" ON public.coupon_codes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "coupons_admin_all" ON public.coupon_codes;
CREATE POLICY "coupons_admin_all" ON public.coupon_codes
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.coupon_codes TO authenticated;
GRANT ALL ON public.coupon_codes TO service_role;

-- 6. Create subscription_usage (Daily usage cache) table
CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT current_date,
  ai_requests integer NOT NULL DEFAULT 0,
  uploads integer NOT NULL DEFAULT 0,
  storage_bytes bigint NOT NULL DEFAULT 0,
  quizzes integer NOT NULL DEFAULT 0,
  flashcards integer NOT NULL DEFAULT 0,
  ocr_pages integer NOT NULL DEFAULT 0,
  voice_usage_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

-- Enable RLS and define security policies for subscription_usage
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_select_own" ON public.subscription_usage;
CREATE POLICY "usage_select_own" ON public.subscription_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usage_admin_all" ON public.subscription_usage;
CREATE POLICY "usage_admin_all" ON public.subscription_usage
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.subscription_usage TO authenticated;
GRANT ALL ON public.subscription_usage TO service_role;

-- 7. Create usage_events table (ledger of all usages)
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  amount numeric(10, 2) NOT NULL DEFAULT 1.00,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and define security policies for usage_events
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_events_select_own" ON public.usage_events;
CREATE POLICY "usage_events_select_own" ON public.usage_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usage_events_admin_all" ON public.usage_events;
CREATE POLICY "usage_events_admin_all" ON public.usage_events
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

GRANT SELECT, INSERT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;

-- 8. Create billing_webhook_events table
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  event_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

-- Enable RLS and define security policies for billing_webhook_events
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events_admin_all" ON public.billing_webhook_events;
CREATE POLICY "webhook_events_admin_all" ON public.billing_webhook_events
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

GRANT ALL ON public.billing_webhook_events TO service_role;

-- 9. Automatic Updated At trigger function and triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_billing_transactions_updated_at ON public.billing_transactions;
CREATE TRIGGER trigger_update_billing_transactions_updated_at
BEFORE UPDATE ON public.billing_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_invoices_updated_at ON public.invoices;
CREATE TRIGGER trigger_update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_coupon_codes_updated_at ON public.coupon_codes;
CREATE TRIGGER trigger_update_coupon_codes_updated_at
BEFORE UPDATE ON public.coupon_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_subscription_usage_updated_at ON public.subscription_usage;
CREATE TRIGGER trigger_update_subscription_usage_updated_at
BEFORE UPDATE ON public.subscription_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_webhook_events_updated_at ON public.billing_webhook_events;
CREATE TRIGGER trigger_update_webhook_events_updated_at
BEFORE UPDATE ON public.billing_webhook_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Auto-log subscription change trigger function
CREATE OR REPLACE FUNCTION public.log_subscription_change()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.subscription_history (user_id, old_plan, new_plan, reason, changed_by)
    VALUES (NEW.user_id, NULL, NEW.plan, 'Initial plan assignment', auth.uid());
    
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (NEW.user_id, 'subscription_changed', jsonb_build_object('old_plan', null, 'new_plan', NEW.plan, 'reason', 'Initial plan assignment'));
  ELSIF (TG_OP = 'UPDATE' AND OLD.plan IS DISTINCT FROM NEW.plan) THEN
    INSERT INTO public.subscription_history (user_id, old_plan, new_plan, reason, changed_by)
    VALUES (NEW.user_id, OLD.plan, NEW.plan, 'Plan updated', auth.uid());

    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (NEW.user_id, 'subscription_changed', jsonb_build_object('old_plan', OLD.plan, 'new_plan', NEW.plan, 'reason', 'Plan updated'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_subscription_change ON public.subscriptions;
CREATE TRIGGER trigger_log_subscription_change
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.log_subscription_change();

-- 11. Atomic increment trigger helper for subscription usage cache
CREATE OR REPLACE FUNCTION public.increment_subscription_usage(
  target_user_id uuid,
  target_date date,
  field_name text,
  increment_amount integer
)
RETURNS boolean
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.subscription_usage (
    user_id,
    usage_date,
    ai_requests,
    uploads,
    quizzes,
    flashcards,
    ocr_pages,
    voice_usage_seconds
  )
  VALUES (
    target_user_id,
    target_date,
    CASE WHEN field_name = 'aiRequests' THEN increment_amount ELSE 0 END,
    CASE WHEN field_name = 'uploads' THEN increment_amount ELSE 0 END,
    CASE WHEN field_name = 'quizzes' THEN increment_amount ELSE 0 END,
    CASE WHEN field_name = 'flashcards' THEN increment_amount ELSE 0 END,
    CASE WHEN field_name = 'ocrPages' THEN increment_amount ELSE 0 END,
    CASE WHEN field_name = 'voiceSeconds' THEN increment_amount ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date) DO UPDATE
  SET
    ai_requests = CASE WHEN field_name = 'aiRequests' THEN public.subscription_usage.ai_requests + increment_amount ELSE public.subscription_usage.ai_requests END,
    uploads = CASE WHEN field_name = 'uploads' THEN public.subscription_usage.uploads + increment_amount ELSE public.subscription_usage.uploads END,
    quizzes = CASE WHEN field_name = 'quizzes' THEN public.subscription_usage.quizzes + increment_amount ELSE public.subscription_usage.quizzes END,
    flashcards = CASE WHEN field_name = 'flashcards' THEN public.subscription_usage.flashcards + increment_amount ELSE public.subscription_usage.flashcards END,
    ocr_pages = CASE WHEN field_name = 'ocrPages' THEN public.subscription_usage.ocr_pages + increment_amount ELSE public.subscription_usage.ocr_pages END,
    voice_usage_seconds = CASE WHEN field_name = 'voiceSeconds' THEN public.subscription_usage.voice_usage_seconds + increment_amount ELSE public.subscription_usage.voice_usage_seconds END,
    updated_at = now();

  RETURN true;
END;
$$;
