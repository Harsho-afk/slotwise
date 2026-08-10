const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS || 7);

if (!ACCESS_SECRET) {
  // Fail loudly at boot rather than silently signing with `undefined`
  throw new Error("JWT_ACCESS_SECRET is not set. Refusing to start.");
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

// Refresh tokens are opaque random strings, not JWTs — we only ever
// store their hash, so a DB leak doesn't hand out usable tokens.
function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString("hex");
  const hash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash, expiresAt };
}

function hashRefreshToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
};
