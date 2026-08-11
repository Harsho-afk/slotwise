const express = require("express");
const { webhook, simulateMockPayment } = require("../controllers/paymentController");

const router = express.Router();

// No requireAuth here — a payment gateway calling our webhook doesn't have
// a user JWT. Trust comes from the HMAC signature, verified inside the
// controller, not from a bearer token.
router.post("/webhook", webhook);

// Demo-only endpoint standing in for the gateway's hosted checkout UI.
router.post("/mock/:orderId/simulate", simulateMockPayment);

module.exports = router;
