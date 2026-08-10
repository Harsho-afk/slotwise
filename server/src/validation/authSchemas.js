const { z } = require("zod");

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(255),
  phone: z.string().max(30).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

module.exports = { signupSchema, loginSchema };
