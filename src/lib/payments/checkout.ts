import { PaystackPaymentProvider } from "./paystack";
import { CheckoutOptions } from "./types";

/**
 * Initiates the checkout process for subscription creation using the active provider.
 */
export async function initiateCheckout(options: CheckoutOptions) {
  const provider = new PaystackPaymentProvider();
  return provider.createCheckout(options);
}
