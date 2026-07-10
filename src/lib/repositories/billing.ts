import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface TransactionInput {
  provider: string;
  reference: string;
  amount: number;
  currency?: string;
  status: "pending" | "processing" | "successful" | "failed" | "refunded" | "cancelled";
  payment_method?: string;
  metadata?: any;
}

export interface InvoiceInput {
  transaction_id?: string | null;
  invoice_number: string;
  amount: number;
  currency?: string;
  status?: "draft" | "pending" | "paid" | "refunded" | "void" | "cancelled";
  paid_at?: string | null;
  pdf_url?: string | null;
}

// 1. Transactions repository methods
export async function createTransaction(userId: string, tx: TransactionInput) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .insert({
      user_id: userId,
      provider: tx.provider,
      reference: tx.reference,
      amount: tx.amount,
      currency: tx.currency || "NGN",
      status: tx.status,
      payment_method: tx.payment_method || null,
      metadata: tx.metadata || {},
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTransaction(reference: string, updates: Partial<TransactionInput>) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .update(updates)
    .eq("reference", reference)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeTransaction(reference: string, metadata?: any) {
  const supabase = await createSupabaseServerClient();
  const updates: any = { status: "successful", updated_at: new Date().toISOString() };
  if (metadata) {
    updates.metadata = metadata;
  }

  const { data, error } = await supabase
    .from("billing_transactions")
    .update(updates)
    .eq("reference", reference)
    .select()
    .single();

  if (error) throw error;

  // Log audit event
  if (data) {
    await supabase.from("audit_logs").insert({
      user_id: data.user_id,
      action: "payment_completed",
      details: { reference, amount: data.amount, currency: data.currency }
    });
  }

  return data;
}

export async function failTransaction(reference: string, errorMsg?: string) {
  const supabase = await createSupabaseServerClient();
  const updates: any = { status: "failed", updated_at: new Date().toISOString() };
  if (errorMsg) {
    updates.metadata = { error: errorMsg };
  }

  const { data, error } = await supabase
    .from("billing_transactions")
    .update(updates)
    .eq("reference", reference)
    .select()
    .single();

  if (error) throw error;

  // Log audit event
  if (data) {
    await supabase.from("audit_logs").insert({
      user_id: data.user_id,
      action: "payment_failed",
      details: { reference, amount: data.amount, error: errorMsg }
    });
  }

  return data;
}

// 2. Invoices repository methods
export async function createInvoice(userId: string, invoice: InvoiceInput) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      transaction_id: invoice.transaction_id || null,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      currency: invoice.currency || "NGN",
      status: invoice.status || "draft",
      paid_at: invoice.paid_at || null,
      pdf_url: invoice.pdf_url || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Log audit event
  if (data) {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "invoice_generated",
      details: { invoice_number: invoice.invoice_number, amount: invoice.amount }
    });
  }

  return data;
}

export async function getInvoices(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getBillingHistory(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getSubscriptionHistory(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subscription_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// 3. Coupons repository methods
export async function validateCoupon(code: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("coupon_codes")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return { valid: false, reason: "Coupon not found or inactive" };
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, reason: "Coupon has expired" };
  }

  // Check redemptions
  if (data.max_redemptions && data.redemption_count >= data.max_redemptions) {
    return { valid: false, reason: "Coupon redemption limit reached" };
  }

  return { valid: true, coupon: data };
}

export async function redeemCoupon(userId: string, code: string) {
  const supabase = await createSupabaseServerClient();
  const validation = await validateCoupon(code);
  
  if (!validation.valid || !validation.coupon) {
    throw new Error(validation.reason || "Invalid coupon");
  }

  const coupon = validation.coupon;

  // Increment redemption count
  const { data, error } = await supabase
    .from("coupon_codes")
    .update({ redemption_count: coupon.redemption_count + 1 })
    .eq("code", coupon.code)
    .select()
    .single();

  if (error) throw error;

  // Log audit event
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "coupon_redeemed",
    details: { code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value }
  });

  return data;
}

// 4. Usage repository methods
export async function getUsage(userId: string, dateStr?: string) {
  const supabase = await createSupabaseServerClient();
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);
  
  const { data, error } = await supabase
    .from("subscription_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("usage_date", targetDate)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateUsage(
  userId: string,
  dateStr: string,
  increments: {
    aiRequests?: number;
    uploads?: number;
    storageBytes?: number;
    quizzes?: number;
    flashcards?: number;
    ocrPages?: number;
    voiceSeconds?: number;
  }
) {
  const supabase = await createSupabaseServerClient();
  const today = dateStr || new Date().toISOString().slice(0, 10);

  for (const [key, value] of Object.entries(increments)) {
    if (value && value > 0) {
      const { error } = await supabase.rpc("increment_subscription_usage", {
        target_user_id: userId,
        target_date: today,
        field_name: key,
        increment_amount: value,
      });
      if (error) throw error;
    }
  }

  return true;
}

// 5. Immutable usage ledger (usage_events)
export async function recordUsageLedgerEvent(userId: string, resourceType: string, amount: number, metadata?: any) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("usage_events")
    .insert({
      user_id: userId,
      resource_type: resourceType,
      amount,
      metadata: metadata || {}
    })
    .select()
    .single();

  if (error) throw error;

  // Map ledger event to daily usage cache increments
  const cacheKeyMap: Record<string, string> = {
    "AI request": "aiRequests",
    "ai_request": "aiRequests",
    "chat": "aiRequests",
    "Quiz generated": "quizzes",
    "quiz": "quizzes",
    "Puzzle generated": "quizzes", // Puzzle generator counts towards quizzes or separate (let's increment quizzes)
    "Flashcards generated": "flashcards",
    "flashcard": "flashcards",
    "Upload": "uploads",
    "upload": "uploads",
    "OCR": "ocrPages",
    "ocr": "ocrPages",
    "Voice": "voiceSeconds",
    "voice": "voiceSeconds"
  };

  const cacheField = cacheKeyMap[resourceType] || resourceType;
  const validFields = ["aiRequests", "uploads", "quizzes", "flashcards", "ocrPages", "voiceSeconds"];
  
  if (validFields.includes(cacheField)) {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.rpc("increment_subscription_usage", {
      target_user_id: userId,
      target_date: today,
      field_name: cacheField,
      increment_amount: Math.ceil(amount),
    });
  }

  return data;
}

// 6. Webhooks repository methods
export async function createWebhookEvent(provider: string, eventId: string, eventType: string, payload: any) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("billing_webhook_events")
    .insert({
      provider,
      event_id: eventId,
      event_type: eventType,
      payload: payload || {}
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function processWebhookEvent(provider: string, eventId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("billing_webhook_events")
    .update({
      processed: true,
      processed_at: new Date().toISOString()
    })
    .eq("provider", provider)
    .eq("event_id", eventId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
