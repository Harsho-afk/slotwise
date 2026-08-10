const rateLimit = require("express-rate-limit");

// General API limit — generous, just to blunt abuse/scraping.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tight limit specifically for login/signup — this is what actually
// slows down credential-stuffing / brute force, separate from account lockout.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

module.exports = { generalLimiter, authLimiter };
