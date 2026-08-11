const { MockProvider } = require("./MockProvider");

// Swap this line for a real provider later — nothing else in the app changes:
// const provider = process.env.PAYMENT_PROVIDER === "razorpay"
//   ? new RazorpayProvider()
//   : MockProvider;
const provider = MockProvider;

module.exports = { provider };
