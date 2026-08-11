const prisma = require("../db/prisma");
const { createAppointmentSchema } = require("../validation/schemas");
const { provider } = require("../services/payment/paymentService");
const { sendAppointmentConfirmation } = require("../services/email");

const CANCEL_CUTOFF_HOURS = 2;

// POST /api/v1/appointments — patient only. Status starts pending_payment.
async function createAppointment(req, res, next) {
  try {
    const parsed = createAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { doctorId, slotStart } = parsed.data;

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const start = new Date(slotStart);
    if (start.getTime() < Date.now()) {
      return res.status(400).json({ error: "Cannot book a slot in the past" });
    }
    const end = new Date(start.getTime() + doctor.slotDurationMinutes * 60 * 1000);

    try {
      const appointment = await prisma.appointment.create({
        data: {
          patientId: req.user.id,
          doctorId,
          slotStart: start,
          slotEnd: end,
          status: "pending_payment",
        },
      });
      return res.status(201).json(appointment);
    } catch (err) {
      // Unique constraint on (doctorId, slotStart) — the DB, not app logic,
      // is what actually stops a double-booking race.
      if (err.code === "P2002") {
        return res.status(409).json({ error: "That slot was just booked by someone else" });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/appointments/:id/pay — creates a payment order for this appointment.
async function payForAppointment(req, res, next) {
  try {
    const { id } = req.params;
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true },
    });

    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    if (appointment.patientId !== req.user.id && req.user.role === "patient") {
      return res.status(403).json({ error: "Not your appointment" });
    }
    if (appointment.status !== "pending_payment") {
      return res.status(409).json({ error: `Appointment is already '${appointment.status}'` });
    }

    const { orderId, checkoutUrl } = await provider.createOrder(
      appointment.doctor.consultationFeePaise,
      appointment.id
    );

    await prisma.payment.create({
      data: {
        appointmentId: appointment.id,
        provider: "mock",
        providerPaymentId: orderId,
        amountPaise: appointment.doctor.consultationFeePaise,
        status: "created",
      },
    });

    return res.json({ orderId, checkoutUrl });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/appointments/:id — patient cancels, respecting cutoff window.
async function cancelAppointment(req, res, next) {
  try {
    const { id } = req.params;
    const appointment = await prisma.appointment.findUnique({ where: { id } });

    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    const isOwner = appointment.patientId === req.user.id;
    const isStaff = ["doctor", "admin"].includes(req.user.role);
    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: "Not your appointment" });
    }

    if (["cancelled", "completed", "no_show"].includes(appointment.status)) {
      return res.status(409).json({ error: `Cannot cancel a '${appointment.status}' appointment` });
    }

    // Patients are subject to the cutoff window; staff/admin can override.
    if (req.user.role === "patient") {
      const hoursUntilSlot = (appointment.slotStart.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilSlot < CANCEL_CUTOFF_HOURS) {
        return res.status(409).json({
          error: `Appointments can't be changed within ${CANCEL_CUTOFF_HOURS} hours of the slot`,
        });
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/appointments/me — patient's own appointments.
async function myAppointments(req, res, next) {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { patientId: req.user.id },
      include: { doctor: { include: { user: { select: { fullName: true } } } } },
      orderBy: { slotStart: "desc" },
    });
    return res.json(appointments);
  } catch (err) {
    next(err);
  }
}

module.exports = { createAppointment, payForAppointment, cancelAppointment, myAppointments };
