const argon2 = require("argon2");
const prisma = require("../db/prisma");
const { createDoctorSchema, updateAppointmentStatusSchema } = require("../validation/schemas");

// POST /api/v1/admin/doctors — admin creates a doctor account.
// Staff never self-register (see §1 of the spec).
async function createDoctor(req, res, next) {
  try {
    const parsed = createDoctorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const {
      email,
      password,
      fullName,
      phone,
      specialty,
      slotDurationMinutes,
      consultationFeePaise,
      availability,
    } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "A user with that email already exists" });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const doctor = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, fullName, phone, role: "doctor", isVerified: true },
      });
      const doc = await tx.doctor.create({
        data: {
          userId: user.id,
          specialty,
          slotDurationMinutes,
          consultationFeePaise,
        },
      });
      if (availability.length > 0) {
        await tx.doctorAvailability.createMany({
          data: availability.map((a) => ({
            doctorId: doc.id,
            weekday: a.weekday,
            startTime: new Date(`1970-01-01T${a.startTime}:00.000Z`),
            endTime: new Date(`1970-01-01T${a.endTime}:00.000Z`),
          })),
        });
      }
      return doc;
    });

    return res.status(201).json(doctor);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/admin/appointments — admin/doctor view, filterable.
async function listAppointments(req, res, next) {
  try {
    const { doctorId, date, patientId, status } = req.query;
    const where = {};

    // A doctor can only see their own schedule; admin can see everyone's.
    if (req.user.role === "doctor") {
      const doctorRecord = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (!doctorRecord) return res.status(403).json({ error: "No doctor profile for this user" });
      where.doctorId = doctorRecord.id;
    } else if (doctorId) {
      where.doctorId = doctorId;
    }

    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      where.slotStart = { gte: dayStart, lt: dayEnd };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true, email: true, phone: true } },
        doctor: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { slotStart: "asc" },
    });

    return res.json(appointments);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/admin/appointments/:id — mark complete/no-show/etc.
async function updateAppointmentStatus(req, res, next) {
  try {
    const { id } = req.params;
    const parsed = updateAppointmentStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // A doctor may only update their own patients' appointments.
    if (req.user.role === "doctor") {
      const doctorRecord = await prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (!doctorRecord || doctorRecord.id !== appointment.doctorId) {
        return res.status(403).json({ error: "Not your appointment" });
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: parsed.data.status },
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/admin/stats — basic dashboard numbers.
async function stats(req, res, next) {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [bookingsThisWeek, completedThisWeek, noShowThisWeek] = await Promise.all([
      prisma.appointment.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.appointment.count({ where: { status: "completed", slotStart: { gte: weekAgo } } }),
      prisma.appointment.count({ where: { status: "no_show", slotStart: { gte: weekAgo } } }),
    ]);

    const finishedThisWeek = completedThisWeek + noShowThisWeek;
    const noShowRate = finishedThisWeek > 0 ? noShowThisWeek / finishedThisWeek : 0;

    return res.json({ bookingsThisWeek, completedThisWeek, noShowThisWeek, noShowRate });
  } catch (err) {
    next(err);
  }
}

module.exports = { createDoctor, listAppointments, updateAppointmentStatus, stats };
