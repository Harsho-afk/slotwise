const argon2 = require("argon2");
const prisma = require("../db/prisma");
const { signupSchema, loginSchema } = require("../validation/authSchemas");
const {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} = require("../services/tokenService");

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const REFRESH_COOKIE_NAME = "refresh_token";

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/v1/auth", // only sent to auth endpoints that need it
};

function genericAuthError(res) {
  // Never reveal whether the email exists — same message either way.
  return res.status(401).json({ error: "Invalid email or password" });
}

async function issueTokensAndRespond(req, res, user) {
  const accessToken = signAccessToken(user);
  const { raw, hash, expiresAt } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt },
  });

  res.cookie(REFRESH_COOKIE_NAME, raw, {
    ...REFRESH_COOKIE_OPTS,
    expires: expiresAt,
  });

  return res.status(200).json({
    accessToken,
    user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
  });
}

// POST /api/v1/auth/signup — patient self-registration only.
// Staff/admin accounts are created by an admin via /api/v1/admin/doctors,
// never through this endpoint.
async function signup(req, res, next) {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { email, password, fullName, phone } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Same status/shape as a "successful" validation error — don't leak existence.
      return res.status(409).json({ error: "Could not create account with these details" });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone,
        role: "patient",
      },
    });

    return issueTokensAndRespond(req, res, user);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/login — all roles.
async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return genericAuthError(res);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({
        error: "Account temporarily locked due to failed login attempts. Try again later.",
      });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      const failedCount = user.failedLoginCount + 1;
      const shouldLock = failedCount >= MAX_FAILED_LOGINS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: shouldLock ? 0 : failedCount,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });

      return genericAuthError(res);
    }

    // Successful login — reset failure counter.
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }

    return issueTokensAndRespond(req, res, user);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/refresh — rotates the refresh token on every use.
async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawToken) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    const tokenHash = hashRefreshToken(rawToken);
    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      // If a revoked/expired token is replayed, clear the cookie defensively.
      res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTS);
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    // Rotate: revoke the old one, issue a new one. Limits blast radius if leaked.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return issueTokensAndRespond(req, res, stored.user);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/logout — revokes the current refresh token.
async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (rawToken) {
      const tokenHash = hashRefreshToken(rawToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revoked: false },
        data: { revoked: true },
      });
    }
    res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTS);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh, logout };
