export interface CheckoutOptions {
  userId: string;
  email: string;
  plan: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  metadata?: any;
}

export interface CheckoutResult {
  checkoutUrl: string;
  reference: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
  status: "successful" | "failed" | "pending";
  metadata?: any;
}
