/**
 * Interface every payment provider must implement.
 * A real gateway (RazorpayProvider, StripeProvider) drops in later
 * without touching any route or controller code — only paymentService.js
 * needs to swap which implementation it instantiates.
 *
 * createOrder(amountPaise, appointmentId) -> { orderId, checkoutUrl }
 * verifyWebhookSignature(rawBody, signature) -> boolean
 * parseWebhookEvent(rawBody) -> { orderId, status: 'paid' | 'failed' }
 */
class PaymentProvider {
  async createOrder(_amountPaise, _appointmentId) {
    throw new Error("createOrder not implemented");
  }
  verifyWebhookSignature(_rawBody, _signature) {
    throw new Error("verifyWebhookSignature not implemented");
  }
  parseWebhookEvent(_rawBody) {
    throw new Error("parseWebhookEvent not implemented");
  }
}

module.exports = { PaymentProvider };
