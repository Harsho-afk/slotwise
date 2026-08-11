const prisma = require("../db/prisma");
const { provider } = require("../services/payment/paymentService");
const { MockProvider } = require("../services/payment/MockProvider");
const { sendAppointmentConfirmation } = require("../services/email");

// POST /api/v1/payments/webhook
// This is the ONLY place an appointment moves from pending_payment -> confirmed.
// The frontend calling "it worked" is never trusted for money.
async function webhook(req, res, next) {
  try {
    const signature = req.headers["x-webhook-signature"];
    const rawBody = req.rawBody; // captured by express.json() verify hook, see app.js

    if (!provider.verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const { orderId, status } = provider.parseWebhookEvent(rawBody);

    const payment = await prisma.payment.findFirst({
      where: { providerPaymentId: orderId },
      include: { appointment: true },
    });
    if (!payment) {
      return res.status(404).json({ error: "Unknown order" });
    }

    // Idempotency: if this webhook already resulted in a terminal state,
    // don't double-confirm or double-charge. Real gateways retry webhooks.
    if (payment.status === "paid" || payment.status === "failed") {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    if (status === "paid") {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: { status: "paid" },
        }),
        prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: "confirmed" },
        }),
      ]);

      const patient = await prisma.user.findUnique({ where: { id: payment.appointment.patientId } });
      if (patient) {
        sendAppointmentConfirmation(patient.email, payment.appointment).catch((e) =>
          console.error("Failed to send confirmation email:", e)
        );
      }
    } else {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/payments/mock/:orderId/simulate?outcome=success|failure
// Stands in for the gateway's hosted checkout page. Builds a signed webhook
// payload and fires it at our own /webhook endpoint — it does NOT confirm
// the payment directly, to keep the architecture identical to a real gateway.
async function simulateMockPayment(req, res, next) {
  try {
    const { orderId } = req.params;
    const outcome = req.query.outcome === "failure" ? "failure" : "success";

    const { payloadString, signature } = MockProvider.buildSignedWebhook(orderId, outcome);

    const webhookUrl = `${req.protocol}://${req.get("host")}/api/v1/payments/webhook`;
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signature,
      },
      body: payloadString,
    });

    const result = await webhookRes.json();
    return res.status(webhookRes.status).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { webhook, simulateMockPayment };
