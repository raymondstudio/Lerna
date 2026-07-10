import { CheckoutOptions, CheckoutResult, PaymentVerificationResult } from "./types";

export interface PaymentProvider {
  name: string;
  createCheckout(options: CheckoutOptions): Promise<CheckoutResult>;
  verifyPayment(reference: string): Promise<PaymentVerificationResult>;
  refund(reference: string, amount: number): Promise<boolean>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
}
