export type AccountStats = { streak: number | null; questions: number | null; documents: number | null; sessions: number | null; hours: number | null };
export type AccountTicket = { id: string; subject: string; message: string; status: string; created_at: string };
export type AccountDashboard = { stats: AccountStats; tickets: AccountTicket[] | null; warnings: string[] };
export type AccountTransaction = { id: string; created_at: string; reference: string; amount: number; currency: string; status: string };
export type AccountInvoice = { id: string; invoice_number: string; issued_at: string; amount: number; currency: string; status: string; pdf_url: string | null };
export type AccountQuota = {
  plan: string;
  subscription?: { subscriptionStatus?: string; billingCycle?: string; currentPeriodStart?: string; currentPeriodEnd?: string; renewalDate?: string };
  usage?: { aiRequests?: number; dailyAiRequests?: number; quizzes?: number; flashcards?: number; ocrPages?: number; voiceSeconds?: number; storageBytes?: number };
  limits?: { aiRequests?: number; dailyRequests?: number; quizzes?: number; flashcards?: number; ocrPages?: number; voiceSeconds?: number; storage?: number };
  remaining?: { aiRequests?: number; ocrPages?: number; quizzes?: number };
};
