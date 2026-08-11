const { z } = require("zod");

const createAppointmentSchema = z.object({
  doctorId: z.string().uuid(),
  slotStart: z.string().datetime(), // ISO 8601
});

const createDoctorSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(255),
  phone: z.string().max(30).optional(),
  specialty: z.string().max(255).optional(),
  slotDurationMinutes: z.number().int().min(5).max(180).default(20),
  consultationFeePaise: z.number().int().positive(),
  availability: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/), // "09:00"
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .optional()
    .default([]),
});

const updateAppointmentStatusSchema = z.object({
  status: z.enum(["completed", "no_show", "confirmed", "cancelled"]),
});

module.exports = {
  createAppointmentSchema,
  createDoctorSchema,
  updateAppointmentStatusSchema,
};
