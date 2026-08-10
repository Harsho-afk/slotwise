const express = require("express");
const { signup, login, refresh, logout } = require("../controllers/authController");
const { authLimiter } = require("../middleware/rateLimit");

const router = express.Router();

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);

module.exports = router;
