const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { generalLimiter } = require("./middleware/rateLimit");
const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// Behind a reverse proxy (Render/Railway/Nginx) — needed for correct
// secure-cookie / rate-limit behavior based on the real client IP.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true, // refresh token cookie needs this
  })
);
app.use(cookieParser());

// Capture the raw request body so the payment webhook can verify its
// HMAC signature against the exact bytes that were sent — signature
// verification against a re-serialized JSON object is not reliable.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);

app.use(generalLimiter);

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/doctors", doctorRoutes);
app.use("/api/v1/appointments", appointmentRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/admin", adminRoutes);

// 404 for anything else under /api
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Central error handler — never leak stack traces in production (§8 checklist).
app.use((err, req, res, _next) => {
  console.error(err);
  const isProd = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({
    error: isProd ? "Internal server error" : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
});

module.exports = app;
