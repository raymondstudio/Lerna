import { PaymentProvider } from "./provider";
import { CheckoutOptions, CheckoutResult, PaymentVerificationResult } from "./types";

export class PaystackPaymentProvider implements PaymentProvider {
  name = "paystack";

  async createCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
    const reference = `PSTK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    return {
      checkoutUrl: `/checkout/mock?provider=paystack&reference=${reference}&amount=${options.amount}`,
      reference
    };
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    return {
      success: true,
      reference,
      amount: 12.00,
      currency: "USD",
      status: "successful",
      metadata: { gateway: "paystack" }
    };
  }

  async refund(reference: string, amount: number): Promise<boolean> {
    return true;
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    return true;
  }
}
