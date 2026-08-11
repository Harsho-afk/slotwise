const crypto = require("crypto");
const { PaymentProvider } = require("./PaymentProvider");

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  throw new Error("PAYMENT_WEBHOOK_SECRET is not set. Refusing to start.");
}

// In-memory order store. Fine for a demo/mock — a real gateway holds this
// state on their side, not ours.
const orders = new Map();

function sign(payloadString) {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(payloadString).digest("hex");
}

class MockProvider extends PaymentProvider {
  async createOrder(amountPaise, appointmentId) {
    const orderId = `mock_order_${crypto.randomUUID()}`;
    orders.set(orderId, { appointmentId, amountPaise, status: "created" });

    // In a real gateway this would be a hosted checkout URL. Here it points
    // at a mock checkout page in the client app that lets the demo user
    // click "Simulate Payment Success/Failure".
    const checkoutUrl = `/mock-checkout?orderId=${orderId}`;
    return { orderId, checkoutUrl };
  }

  // Called by our own /payments/mock/:orderId/simulate route (the "gateway
  // UI"). Builds a signed webhook payload exactly like a real provider would,
  // then POSTs it at our own webhook endpoint — never confirms payment directly.
  buildSignedWebhook(orderId, outcome) {
    const order = orders.get(orderId);
    if (!order) throw new Error("Unknown mock order");

    order.status = outcome === "success" ? "paid" : "failed";

    const payload = {
      orderId,
      status: order.status,
      amountPaise: order.amountPaise,
      timestamp: new Date().toISOString(),
    };
    const payloadString = JSON.stringify(payload);
    const signature = sign(payloadString);

    return { payloadString, signature };
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return false;
    const expected = sign(rawBody);
    // Constant-time comparison to avoid timing attacks.
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  parseWebhookEvent(rawBody) {
    const data = JSON.parse(rawBody);
    return { orderId: data.orderId, status: data.status };
  }

  getOrder(orderId) {
    return orders.get(orderId);
  }
}

module.exports = { MockProvider: new MockProvider() };
