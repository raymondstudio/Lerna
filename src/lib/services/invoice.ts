import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface InvoiceMetadata {
  invoiceNumber: string;
  amount: number;
  currency: string;
  issuedAt: string;
  paidAt?: string;
  userName: string;
  userEmail: string;
  planName: string;
}

/**
 * Generates a unique, formatted invoice number.
 */
export function generateInvoiceNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${random}`;
}

/**
 * Prepares an invoice row configuration.
 */
export function produceInvoiceObject(
  userId: string,
  amount: number,
  currency: string,
  transactionId?: string
) {
  return {
    user_id: userId,
    transaction_id: transactionId || null,
    invoice_number: generateInvoiceNumber(),
    amount,
    currency: currency || "NGN",
    status: "draft" as const,
    issued_at: new Date().toISOString(),
    pdf_url: null,
  };
}

/**
 * Prepares readable metadata for client UI rendering or PDF creation.
 */
export function preparePdfMetadata(invoice: Record<string, unknown>, userProfile: Record<string, unknown>): InvoiceMetadata {
  return {
    invoiceNumber: String(invoice.invoice_number || invoice.invoiceNumber || ""),
    amount: Number(invoice.amount || 0),
    currency: String(invoice.currency || "NGN"),
    issuedAt: String(invoice.issued_at || invoice.issuedAt || new Date().toISOString()),
    paidAt: typeof (invoice.paid_at ?? invoice.paidAt) === "string" ? String(invoice.paid_at ?? invoice.paidAt) : undefined,
    userName: userProfile
      ? `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim() || String(userProfile.name || "User")
      : "Lerna User",
    userEmail: String(userProfile?.email || ""),
    planName: String(userProfile?.plan || "Free"),
  };
}
