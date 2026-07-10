import { PaystackPaymentProvider } from "./paystack";

/**
 * Verifies a payment reference status using the active provider.
 */
export async function verifyPaymentTransaction(reference: string) {
  const provider = new PaystackPaymentProvider();
  return provider.verifyPayment(reference);
}
