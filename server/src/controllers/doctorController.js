const prisma = require("../db/prisma");
const { getAvailableSlots } = require("../services/slotService");

// GET /api/v1/doctors — public
async function listDoctors(req, res, next) {
  try {
    const doctors = await prisma.doctor.findMany({
      include: { user: { select: { fullName: true } } },
    });
    return res.json(
      doctors.map((d) => ({
        id: d.id,
        fullName: d.user.fullName,
        specialty: d.specialty,
        slotDurationMinutes: d.slotDurationMinutes,
        consultationFeePaise: d.consultationFeePaise,
      }))
    );
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/doctors/:id/slots?date=YYYY-MM-DD — public
async function getSlots(req, res, next) {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Query param 'date' must be YYYY-MM-DD" });
    }

    const slots = await getAvailableSlots(id, date);
    if (slots === null) {
      return res.status(404).json({ error: "Doctor not found" });
    }
    return res.json({ doctorId: id, date, slots });
  } catch (err) {
    next(err);
  }
}

module.exports = { listDoctors, getSlots };
